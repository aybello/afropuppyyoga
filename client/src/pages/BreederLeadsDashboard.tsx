import { useState } from "react";
import { useLocation } from "wouter";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Search, Dog, MapPin, ExternalLink, AlertCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700", qualified: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700", replied: "bg-purple-100 text-purple-700",
  interested: "bg-orange-100 text-orange-700", negotiating: "bg-pink-100 text-pink-700",
  booked: "bg-green-100 text-green-700", not_interested: "bg-red-100 text-red-700",
  disqualified: "bg-gray-100 text-gray-500", no_response: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New", qualified: "Qualified", contacted: "Contacted", replied: "Replied",
  interested: "Interested", negotiating: "Negotiating", booked: "Booked",
  not_interested: "Not Interested", disqualified: "Disqualified", no_response: "No Response",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">—</span>;
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : score >= 40 ? "text-orange-500" : "text-red-500";
  const label = score >= 80 ? "Strong" : score >= 60 ? "Good" : score >= 40 ? "Moderate" : "Weak";
  return <span className={`font-semibold text-sm ${color}`}>{score} <span className="font-normal text-xs">({label})</span></span>;
}

export default function BreederLeadsDashboard() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showKijijiSearch, setShowKijijiSearch] = useState(false);
  const [kijijiKeyword, setKijijiKeyword] = useState("Golden Retriever puppies");
  const [kijijiLocation, setKijijiLocation] = useState("gta");
  const [kijijiResults, setKijijiResults] = useState<any[]>([]);
  const [importingUrl, setImportingUrl] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [newLead, setNewLead] = useState({ breed: "", sellerName: "", phoneNumber: "", email: "", city: "", puppyCount: "", listingUrl: "", internalNotes: "" });

  const { data: stats, isLoading: statsLoading } = trpc.breederLeads.stats.useQuery();
  const { data: leads, isLoading: leadsLoading, refetch } = trpc.breederLeads.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
    limit: 100,
  });

  const createMutation = trpc.breederLeads.create.useMutation({
    onSuccess: () => { toast.success("Lead created"); setShowAddModal(false); refetch(); setNewLead({ breed: "", sellerName: "", phoneNumber: "", email: "", city: "", puppyCount: "", listingUrl: "", internalNotes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const searchKijijiMutation = trpc.breederLeads.searchKijiji.useMutation({
    onSuccess: (data) => setKijijiResults(data),
    onError: (e) => toast.error(e.message),
  });

  const importUrlMutation = trpc.breederLeads.importFromUrl.useMutation({
    onSuccess: (data) => {
      if (data.duplicate) toast.warning("This listing is already in your leads");
      else toast.success(`Lead imported! Score: ${data.qualification?.score}/100`);
      refetch(); setImportingUrl("");
    },
    onError: (e) => { toast.error(e.message); setImportingUrl(""); },
  });

  const handleImport = (url: string) => { setImportingUrl(url); importUrlMutation.mutate({ url }); };

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Breeder Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Discover, qualify, and convert new breeders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowKijijiSearch(true)}><Search className="w-4 h-4 mr-2" />Search Kijiji</Button>
            <Button onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4 mr-2" />Add Lead</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {statsLoading ? Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-20" />) : stats && (<>
            {[
              { label: "New Leads", value: stats.new, color: "text-slate-700", filter: "new" },
              { label: "Qualified", value: stats.qualified, color: "text-blue-600", filter: "qualified" },
              { label: "Awaiting Reply", value: stats.awaitingResponse, color: "text-yellow-600", filter: "contacted" },
              { label: "Interested", value: stats.interested, color: "text-orange-500", filter: "interested" },
              { label: "Booked", value: stats.booked, color: "text-green-600", filter: "booked" },
              { label: "Conversion", value: `${stats.conversionRate}%`, color: "text-primary", filter: null },
            ].map(({ label, value, color, filter }) => (
              <Card key={label} className={filter ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={() => filter && setStatusFilter(filter)}>
                <CardContent className="p-4">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </CardContent>
              </Card>
            ))}
          </>)}
        </div>

        {stats && stats.followUpsDueToday > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 font-medium">{stats.followUpsDueToday} follow-up{stats.followUpsDueToday > 1 ? "s" : ""} due today</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search breed, seller, city..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || search) && <Button variant="ghost" onClick={() => { setStatusFilter("all"); setSearch(""); }}>Clear</Button>}
        </div>

        {/* URL import bar */}
        <div className="flex gap-2 mb-4">
          <Input placeholder="Paste a Kijiji listing URL to import..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="flex-1" />
          <Button variant="outline" disabled={!importUrl || importUrlMutation.isPending} onClick={() => { handleImport(importUrl); setImportUrl(""); }}>
            {importUrlMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {["Breed", "Puppies", "Location", "Score", "Status", "Source", "Last Contact", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsLoading ? Array.from({length:5}).map((_,i) => (
                  <tr key={i} className="border-b">{Array.from({length:8}).map((_,j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                )) : leads && leads.length > 0 ? leads.map(lead => (
                  <tr key={lead.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/admin/breeder-leads/${lead.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lead.breed}</div>
                      {lead.sellerName && <div className="text-xs text-muted-foreground">{lead.sellerName}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">{lead.puppyCount ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" />{lead.city ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={lead.qualificationScore} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.pipelineStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[lead.pipelineStatus] ?? lead.pipelineStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{lead.source}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString("en-CA") : "Never"}</td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm">View →</Button></td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Dog className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div>No leads yet. Search Kijiji or add one manually.</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Breed *", key: "breed", placeholder: "Golden Retriever" },
                { label: "Seller Name", key: "sellerName", placeholder: "Jane Smith" },
                { label: "Phone", key: "phoneNumber", placeholder: "416-555-0100" },
                { label: "Email", key: "email", placeholder: "breeder@email.com" },
                { label: "City", key: "city", placeholder: "Hamilton" },
                { label: "Puppy Count", key: "puppyCount", placeholder: "8" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(newLead as any)[key]} onChange={e => setNewLead(p => ({...p, [key]: e.target.value}))} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input placeholder="Any initial notes..." value={newLead.internalNotes} onChange={e => setNewLead(p => ({...p, internalNotes: e.target.value}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button disabled={!newLead.breed || createMutation.isPending} onClick={() => createMutation.mutate({
              breed: newLead.breed, sellerName: newLead.sellerName || undefined, phoneNumber: newLead.phoneNumber || undefined,
              email: newLead.email || undefined, city: newLead.city || undefined,
              puppyCount: newLead.puppyCount ? parseInt(newLead.puppyCount) : undefined,
              internalNotes: newLead.internalNotes || undefined, source: "manual",
            })}>
              {createMutation.isPending ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kijiji Search Modal */}
      <Dialog open={showKijijiSearch} onOpenChange={setShowKijijiSearch}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Search Kijiji Listings</DialogTitle></DialogHeader>
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Breed</label>
                <Select value={kijijiKeyword} onValueChange={setKijijiKeyword}>
                  <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Golden Retriever puppies">Golden Retriever</SelectItem>
                    <SelectItem value="Bernese Mountain Dog puppies">Bernese Mountain Dog</SelectItem>
                    <SelectItem value="German Shepherd puppies">German Shepherd</SelectItem>
                    <SelectItem value="Labrador puppies">Labrador Retriever</SelectItem>
                    <SelectItem value="Goldendoodle puppies">Goldendoodle</SelectItem>
                    <SelectItem value="Cane Corso puppies">Cane Corso</SelectItem>
                    <SelectItem value="French Bulldog puppies">French Bulldog</SelectItem>
                    <SelectItem value="Poodle puppies">Poodle</SelectItem>
                    <SelectItem value="Husky puppies">Husky</SelectItem>
                    <SelectItem value="Corgi puppies">Corgi</SelectItem>
                    <SelectItem value="Australian Shepherd puppies">Australian Shepherd</SelectItem>
                    <SelectItem value="Border Collie puppies">Border Collie</SelectItem>
                    <SelectItem value="Cavalier King Charles puppies">Cavalier King Charles</SelectItem>
                    <SelectItem value="Shih Tzu puppies">Shih Tzu</SelectItem>
                    <SelectItem value="Pomeranian puppies">Pomeranian</SelectItem>
                    <SelectItem value="Doberman puppies">Doberman</SelectItem>
                    <SelectItem value="Rottweiler puppies">Rottweiler</SelectItem>
                    <SelectItem value="Great Dane puppies">Great Dane</SelectItem>
                    <SelectItem value="Samoyed puppies">Samoyed</SelectItem>
                    <SelectItem value="Mini Pinscher puppies">Mini Pinscher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                <Select value={kijijiLocation} onValueChange={setKijijiLocation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kitchener">Near Kitchener (100km)</SelectItem>
                    <SelectItem value="hamilton">Near Hamilton (100km)</SelectItem>
                    <SelectItem value="oakville">Near Oakville (100km)</SelectItem>
                    <SelectItem value="gta">GTA / All (100km)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={!kijijiKeyword || searchKijijiMutation.isPending} onClick={() => searchKijijiMutation.mutate({ keyword: kijijiKeyword, location: kijijiLocation })}>
              {searchKijijiMutation.isPending ? "Searching..." : "Search"}
            </Button>
          </div>
          {kijijiResults.length > 0 && (
            <div className="space-y-2">
              {kijijiResults.map((listing: any) => (
                <div key={listing.id} className="border rounded-lg p-3 flex items-start gap-3">
                  {listing.imageUrls?.[0] && <img src={listing.imageUrls[0]} alt="" className="w-16 h-16 object-cover rounded shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{listing.title}</div>
                    <div className="text-xs text-muted-foreground">{listing.location?.city}, {listing.location?.province}</div>
                    {listing.price && <div className="text-xs text-green-600">${(listing.price/100).toFixed(0)}</div>}
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{listing.description?.slice(0, 120)}...</div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1">
                    {listing.alreadyImported ? (
                      <span className="text-xs text-muted-foreground">Imported</span>
                    ) : (
                      <Button size="sm" disabled={importingUrl === listing.url || importUrlMutation.isPending} onClick={() => handleImport(listing.url)}>
                        {importingUrl === listing.url ? "..." : "Import"}
                      </Button>
                    )}
                    <a href={listing.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="w-full"><ExternalLink className="w-3 h-3" /></Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
