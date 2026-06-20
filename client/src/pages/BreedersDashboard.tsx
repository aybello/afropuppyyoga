/* ============================================================
   BreedersDashboard — Admin page for managing the breeder database
   Features: Search, filter by contract status, add/edit/delete breeders
   ============================================================ */
import { useState } from "react";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PawPrint, Plus, Search, Pencil, Trash2, Phone, Mail, Instagram, ChevronDown, ChevronUp } from "lucide-react";


type ContractStatus = "No contract yet" | "Contract sent" | "Contract completed";

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  "No contract yet": "bg-gray-100 text-gray-700 border-gray-200",
  "Contract sent": "bg-amber-50 text-amber-700 border-amber-200",
  "Contract completed": "bg-green-50 text-green-700 border-green-200",
};

const EMPTY_FORM = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  instagram: "",
  breed: "",
  litterTimeline: "",
  typicalRate: "",
  transport: "",
  contractStatus: "No contract yet" as ContractStatus,
  notes: "",
  isActive: 1,
};

export default function BreedersDashboard() {
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      alert(`Error: ${title}${description ? " — " + description : ""}`);
    }
    // success toasts are silent
  };

  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBreeder, setEditBreeder] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: breeders = [], isLoading } = trpc.breeders.list.useQuery({
    search: search || undefined,
    contractStatus: filterStatus as any,
  });

  const addMutation = trpc.breeders.add.useMutation({
    onSuccess: () => {
      utils.breeders.list.invalidate();
      setShowAddModal(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Breeder added successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = trpc.breeders.update.useMutation({
    onSuccess: () => {
      utils.breeders.list.invalidate();
      setEditBreeder(null);
      toast({ title: "Breeder updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.breeders.delete.useMutation({
    onSuccess: () => {
      utils.breeders.list.invalidate();
      setDeleteConfirm(null);
      toast({ title: "Breeder removed" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(b: any) {
    setForm({
      name: b.name ?? "",
      contactName: b.contactName ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      instagram: b.instagram ?? "",
      breed: b.breed ?? "",
      litterTimeline: b.litterTimeline ?? "",
      typicalRate: b.typicalRate ?? "",
      transport: b.transport ?? "",
      contractStatus: b.contractStatus ?? "No contract yet",
      notes: b.notes ?? "",
      isActive: b.isActive ?? 1,
    });
    setEditBreeder(b);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Breeder name is required", variant: "destructive" });
      return;
    }
    if (editBreeder) {
      updateMutation.mutate({ id: editBreeder.id, ...form });
    } else {
      addMutation.mutate(form);
    }
  }

  const contractCounts = {
    all: breeders.length,
    "No contract yet": breeders.filter((b: any) => b.contractStatus === "No contract yet").length,
    "Contract sent": breeders.filter((b: any) => b.contractStatus === "Contract sent").length,
    "Contract completed": breeders.filter((b: any) => b.contractStatus === "Contract completed").length,
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 bg-[#C2185B] rounded-full" />
              <span className="font-body text-xs font-semibold text-[#C2185B] uppercase tracking-widest">Admin</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-[#1A0A12]">Breeder Database</h1>
            <p className="font-body text-sm text-[#6B4C3B] mt-1">Manage and track your breeder relationships</p>
          </div>
          <Button
            onClick={() => { setForm({ ...EMPTY_FORM }); setShowAddModal(true); }}
            className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body font-semibold gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Breeder
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: contractCounts.all, color: "text-[#1A0A12]" },
            { label: "No Contract", value: contractCounts["No contract yet"], color: "text-gray-600" },
            { label: "Contract Sent", value: contractCounts["Contract sent"], color: "text-amber-600" },
            { label: "Contracted", value: contractCounts["Contract completed"], color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#F0D0DC] p-4">
              <p className="font-body text-xs text-[#6B4C3B] uppercase tracking-wider mb-1">{label}</p>
              <p className={`font-display text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B2252]" />
            <Input
              placeholder="Search by name, breed, contact, email, or Instagram..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-[#F0D0DC] bg-white font-body focus-visible:ring-[#C2185B]"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-52 border-[#F0D0DC] bg-white font-body">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="No contract yet">No Contract Yet</SelectItem>
              <SelectItem value="Contract sent">Contract Sent</SelectItem>
              <SelectItem value="Contract completed">Contract Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Breeder List */}
        {isLoading ? (
          <div className="text-center py-16 text-[#6B4C3B] font-body">Loading breeders...</div>
        ) : breeders.length === 0 ? (
          <div className="text-center py-16">
            <PawPrint className="w-12 h-12 text-[#F0D0DC] mx-auto mb-3" />
            <p className="font-body text-[#6B4C3B]">No breeders found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {breeders.map((b: any) => {
              const isExpanded = expandedId === b.id;
              return (
                <div key={b.id} className="bg-white rounded-xl border border-[#F0D0DC] overflow-hidden">
                  {/* Row header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FFF5F8] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FFF0F4] flex items-center justify-center shrink-0">
                      <PawPrint className="w-4 h-4 text-[#C2185B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-semibold text-[#1A0A12] text-sm">{b.name}</span>
                        {b.breed && (
                          <span className="font-body text-xs text-[#6B4C3B] bg-[#FFF5F8] px-2 py-0.5 rounded-full border border-[#F0D0DC]">{b.breed}</span>
                        )}
                      </div>
                      <p className="font-body text-xs text-[#8B6B5A] truncate mt-0.5">{b.contactName || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-body text-xs font-medium px-2.5 py-1 rounded-full border ${CONTRACT_STATUS_COLORS[b.contractStatus as ContractStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {b.contractStatus}
                      </span>
                      {b.typicalRate && (
                        <span className="font-body text-xs text-[#6B4C3B] hidden sm:inline">${b.typicalRate}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8B2252]" /> : <ChevronDown className="w-4 h-4 text-[#8B2252]" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-[#F0D0DC] px-4 py-4 bg-[#FEFAF4]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        {b.phone && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Phone</p>
                              <p className="font-body text-sm text-[#1A0A12]">{b.phone}</p>
                            </div>
                          </div>
                        )}
                        {b.email && (
                          <div className="flex items-start gap-2">
                            <Mail className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Email</p>
                              <a href={`mailto:${b.email}`} className="font-body text-sm text-[#C2185B] hover:underline">{b.email}</a>
                            </div>
                          </div>
                        )}
                        {b.instagram && (
                          <div className="flex items-start gap-2">
                            <Instagram className="w-3.5 h-3.5 text-[#C2185B] mt-0.5 shrink-0" />
                            <div>
                              <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Instagram</p>
                              <p className="font-body text-sm text-[#1A0A12]">{b.instagram}</p>
                            </div>
                          </div>
                        )}
                        {b.litterTimeline && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Litter Timeline</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.litterTimeline}</p>
                          </div>
                        )}
                        {b.typicalRate && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Typical Rate</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.typicalRate.startsWith("$") ? b.typicalRate : `$${b.typicalRate}`}</p>
                          </div>
                        )}
                        {b.transport && (
                          <div>
                            <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider">Transport</p>
                            <p className="font-body text-sm text-[#1A0A12]">{b.transport}</p>
                          </div>
                        )}
                      </div>
                      {b.notes && (
                        <div className="mb-4">
                          <p className="font-body text-xs text-[#8B6B5A] uppercase tracking-wider mb-1">Notes</p>
                          <p className="font-body text-sm text-[#1A0A12] bg-white rounded-lg p-3 border border-[#F0D0DC]">{b.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#F0D0DC] text-[#C2185B] hover:bg-[#FFF0F4] font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 font-body gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(b.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={showAddModal || !!editBreeder} onOpenChange={(open) => { if (!open) { setShowAddModal(false); setEditBreeder(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              {editBreeder ? "Edit Breeder" : "Add New Breeder"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breeder / Kennel Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Taco Yorkies" />
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Contact Info</Label>
              <Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="Name, phone, email, IG handle..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="647-000-0000" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Email</Label>
                <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="breeder@email.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="@handle" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Breed(s)</Label>
                <Input value={form.breed} onChange={(e) => setForm(f => ({ ...f, breed: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Goldendoodles" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Litter Timeline</Label>
                <Input value={form.litterTimeline} onChange={(e) => setForm(f => ({ ...f, litterTimeline: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Spring 2026" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Typical Rate</Label>
                <Input value={form.typicalRate} onChange={(e) => setForm(f => ({ ...f, typicalRate: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. 500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Transport</Label>
                <Input value={form.transport} onChange={(e) => setForm(f => ({ ...f, transport: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body" placeholder="e.g. Breeder" />
              </div>
              <div>
                <Label className="font-body text-sm text-[#1A0A12] font-semibold">Contract Status</Label>
                <Select value={form.contractStatus} onValueChange={(v) => setForm(f => ({ ...f, contractStatus: v as ContractStatus }))}>
                  <SelectTrigger className="mt-1 border-[#F0D0DC] font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No contract yet">No Contract Yet</SelectItem>
                    <SelectItem value="Contract sent">Contract Sent</SelectItem>
                    <SelectItem value="Contract completed">Contract Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="font-body text-sm text-[#1A0A12] font-semibold">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 border-[#F0D0DC] font-body resize-none" rows={3} placeholder="Any additional notes..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setEditBreeder(null); }} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending || updateMutation.isPending}
              className="bg-[#C2185B] hover:bg-[#A01550] text-white font-body"
            >
              {addMutation.isPending || updateMutation.isPending ? "Saving..." : editBreeder ? "Save Changes" : "Add Breeder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-[#1A0A12]">Remove Breeder?</DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-[#6B4C3B]">This will permanently remove this breeder from the database. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="font-body border-[#F0D0DC]">Cancel</Button>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-body"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
