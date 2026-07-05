/* ============================================================
   PuppySchedule — Admin tool to schedule which breed & breeder
   attends each Saturday/Sunday class at each location.
   ============================================================ */
import { useState, useMemo } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Plus, Pencil, Trash2, MapPin, PawPrint, Loader2, Dog } from "lucide-react";
import { toast } from "sonner";

const LOCATIONS = ["Kitchener", "Hamilton", "Oakville"] as const;
type Location = typeof LOCATIONS[number];

const LOCATION_COLORS: Record<Location, string> = {
  Kitchener: "bg-pink-50 text-pink-700 border-pink-200",
  Hamilton: "bg-purple-50 text-purple-700 border-purple-200",
  Oakville: "bg-amber-50 text-amber-700 border-amber-200",
};

const DAY_COLORS: Record<string, string> = {
  Saturday: "bg-blue-50 text-blue-700 border-blue-200",
  Sunday: "bg-green-50 text-green-700 border-green-200",
};

const EMPTY_FORM = {
  classDate: "",
  dayOfWeek: "" as "Saturday" | "Sunday" | "",
  location: "" as Location | "",
  breed: "",
  breederId: 0,
  breederName: "",
  notes: "",
};

/** Returns only Saturdays and Sundays for the next 12 weeks */
function getUpcomingWeekends(): { date: string; label: string; day: "Saturday" | "Sunday" }[] {
  const results: { date: string; label: string; day: "Saturday" | "Sunday" }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 84; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 6 || dow === 0) {
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      results.push({ date: iso, label, day: dow === 6 ? "Saturday" : "Sunday" });
    }
  }
  return results;
}

export default function PuppySchedule() {
  const weekends = useMemo(() => getUpcomingWeekends(), []);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data: schedules = [], isLoading } = trpc.puppySchedule.list.useQuery();
  const { data: breeders = [] } = trpc.breeders.list.useQuery();

  const createMutation = trpc.puppySchedule.create.useMutation({
    onSuccess: () => {
      utils.puppySchedule.list.invalidate();
      toast.success("Class scheduled!");
      setShowDialog(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.puppySchedule.update.useMutation({
    onSuccess: () => {
      utils.puppySchedule.list.invalidate();
      toast.success("Schedule updated!");
      setShowDialog(false);
      setEditId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.puppySchedule.delete.useMutation({
    onSuccess: () => {
      utils.puppySchedule.list.invalidate();
      toast.success("Removed from schedule.");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowDialog(true);
  }

  function openEdit(s: typeof schedules[0]) {
    setForm({
      classDate: s.classDate,
      dayOfWeek: s.dayOfWeek,
      location: s.location as Location,
      breed: s.breed,
      breederId: s.breederId,
      breederName: s.breederName,
      notes: s.notes ?? "",
    });
    setEditId(s.id);
    setShowDialog(true);
  }

  function handleDateChange(dateStr: string) {
    const weekend = weekends.find(w => w.date === dateStr);
    setForm(f => ({
      ...f,
      classDate: dateStr,
      dayOfWeek: weekend?.day ?? "",
    }));
  }

  function handleBreederChange(breederId: string) {
    const b = breeders.find(b => b.id === Number(breederId));
    setForm(f => ({
      ...f,
      breederId: Number(breederId),
      breederName: b?.name ?? "",
      breed: f.breed || b?.breed || "",
    }));
  }

  function handleSubmit() {
    if (!form.classDate || !form.dayOfWeek || !form.location || !form.breed || !form.breederId) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (editId !== null) {
      updateMutation.mutate({
        id: editId,
        classDate: form.classDate,
        dayOfWeek: form.dayOfWeek as "Saturday" | "Sunday",
        location: form.location as Location,
        breed: form.breed,
        breederId: form.breederId,
        breederName: form.breederName,
        notes: form.notes || undefined,
      });
    } else {
      createMutation.mutate({
        classDate: form.classDate,
        dayOfWeek: form.dayOfWeek as "Saturday" | "Sunday",
        location: form.location as Location,
        breed: form.breed,
        breederId: form.breederId,
        breederName: form.breederName,
        notes: form.notes || undefined,
      });
    }
  }

  const filtered = filterLocation === "all"
    ? schedules
    : schedules.filter(s => s.location === filterLocation);

  // Group by date for calendar-style display
  const grouped = filtered.reduce<Record<string, typeof schedules>>((acc, s) => {
    if (!acc[s.classDate]) acc[s.classDate] = [];
    acc[s.classDate].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const activeBreeders = breeders.filter((b: any) => b.isActive === 1);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-[#C2185B] rounded-full" />
              <span className="text-[#C2185B] font-body text-xs font-bold tracking-widest uppercase">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">Puppy Class Schedule</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">
              Assign breeds and breeders to Saturday & Sunday classes across all locations.
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-5"
          >
            <Plus size={16} className="mr-1" /> Schedule Class
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Scheduled", value: schedules.length },
            { label: "Kitchener", value: schedules.filter(s => s.location === "Kitchener").length },
            { label: "Hamilton", value: schedules.filter(s => s.location === "Hamilton").length },
            { label: "Oakville", value: schedules.filter(s => s.location === "Oakville").length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
              <div className="font-display text-2xl font-bold text-[#C2185B]">{value}</div>
              <div className="font-body text-xs text-[#6B4C3B] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", ...LOCATIONS].map(loc => (
            <button
              key={loc}
              onClick={() => setFilterLocation(loc)}
              className={`px-4 py-1.5 rounded-full font-body text-sm font-semibold border transition-all ${
                filterLocation === loc
                  ? "bg-[#C2185B] text-white border-[#C2185B]"
                  : "bg-white text-[#6B4C3B] border-[#F0D0DC] hover:border-[#C2185B]"
              }`}
            >
              {loc === "all" ? "All Locations" : loc}
            </button>
          ))}
        </div>

        {/* Schedule list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#6B4C3B]">
            <Loader2 className="animate-spin mr-2" size={20} /> Loading schedule...
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#F0D0DC]">
            <Dog size={48} className="mx-auto text-[#F0D0DC] mb-3" />
            <p className="font-display text-lg text-[#1A0A12] font-semibold">No classes scheduled yet</p>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">Click "Schedule Class" to add your first entry.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => {
              const entries = grouped[date];
              const d = new Date(date + "T12:00:00");
              const dateLabel = d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              const dayOfWeek = entries[0].dayOfWeek;
              return (
                <div key={date} className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
                  {/* Date header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <CalendarDays size={18} className="text-[#C2185B]" />
                    <span className="font-display font-bold text-[#1A0A12] text-base">{dateLabel}</span>
                    <Badge className={`text-xs font-body border ${DAY_COLORS[dayOfWeek]}`}>{dayOfWeek}</Badge>
                  </div>
                  {/* Entries for this date */}
                  <div className="divide-y divide-[#F0D0DC]">
                    {entries.map(s => (
                      <div key={s.id} className="flex items-start gap-4 px-5 py-4">
                        <div className="w-9 h-9 rounded-full bg-[#FFF0F4] flex items-center justify-center shrink-0 mt-0.5">
                          <PawPrint size={18} className="text-[#C2185B]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-body font-semibold text-[#1A0A12]">{s.breed}</span>
                            <Badge className={`text-xs font-body border ${LOCATION_COLORS[s.location as Location]}`}>
                              <MapPin size={10} className="mr-1" />{s.location}
                            </Badge>
                          </div>
                          <div className="font-body text-sm text-[#6B4C3B]">
                            Breeder: <span className="font-semibold text-[#1A0A12]">{s.breederName}</span>
                          </div>
                          {s.notes && (
                            <div className="font-body text-xs text-[#9E7B6B] mt-1 italic">{s.notes}</div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg hover:bg-[#FFF0F4] text-[#6B4C3B] hover:text-[#C2185B] transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B4C3B] hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md bg-[#FEFAF4] border-[#F0D0DC]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              {editId !== null ? "Edit Scheduled Class" : "Schedule a Class"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Class Date <span className="text-red-500">*</span></Label>
              <Select value={form.classDate} onValueChange={handleDateChange}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue placeholder="Select a Saturday or Sunday" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {weekends.map(w => (
                    <SelectItem key={w.date} value={w.date}>
                      <span className={`inline-block w-20 text-xs font-semibold mr-2 ${w.day === "Saturday" ? "text-blue-600" : "text-green-600"}`}>{w.day}</span>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.dayOfWeek && (
                <p className="text-xs text-[#6B4C3B] mt-1 font-body">
                  Day: <span className="font-semibold">{form.dayOfWeek}</span>
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Location <span className="text-red-500">*</span></Label>
              <Select value={form.location} onValueChange={v => setForm(f => ({ ...f, location: v as Location }))}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breeder */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breeder <span className="text-red-500">*</span></Label>
              <Select value={form.breederId ? String(form.breederId) : ""} onValueChange={handleBreederChange}>
                <SelectTrigger className="mt-1 border-[#F0D0DC] font-body text-sm">
                  <SelectValue placeholder="Select breeder" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {activeBreeders.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}{b.breed ? ` — ${b.breed}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Breed */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breed <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1 border-[#F0D0DC] font-body text-sm"
                placeholder="e.g. Golden Retriever, Cavapoo"
                value={form.breed}
                onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
              />
              <p className="text-xs text-[#9E7B6B] mt-1 font-body">Auto-filled from breeder profile — edit if different.</p>
            </div>

            {/* Notes */}
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Notes <span className="text-[#9E7B6B] font-normal">(optional)</span></Label>
              <Textarea
                className="mt-1 border-[#F0D0DC] font-body text-sm resize-none"
                placeholder="e.g. 4 puppies, drop-off at 9:30 AM"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="font-body border-[#F0D0DC]">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-[#C2185B] hover:bg-[#AD1457] text-white font-body font-semibold rounded-full px-6"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={14} className="animate-spin mr-2" />}
              {editId !== null ? "Save Changes" : "Schedule Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1A0A12]">Remove from schedule?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[#6B4C3B]">
              This will remove this class entry from the schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body border-[#F0D0DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-600 hover:bg-red-700 text-white font-body"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
