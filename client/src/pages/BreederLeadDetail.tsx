import { useState } from "react";
import { useParams, useLocation } from "wouter";
import AdminNav from "@/components/AdminNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Phone, Mail, ExternalLink, MessageSquare, Send, CheckCircle, Dog, Star, AlertTriangle, UserPlus, StickyNote } from "lucide-react";

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

export default function BreederLeadDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "0");
  const { user, loading: authLoading } = useAuth();
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState<"outreach" | "notes" | "timeline">("outreach");

  const { data, isLoading, error, refetch } = trpc.breederLeads.getById.useQuery({ id }, { enabled: id > 0 && !!user, retry: false });
  const lead = data?.lead;

  const updateMutation = trpc.breederLeads.update.useMutation({ onSuccess: () => { toast.success("Updated"); refetch(); }, onError: (e) => toast.error(e.message) });
  const generateMutation = trpc.breederLeads.generateOutreach.useMutation({
    onSuccess: (d) => { setSmsMessage(d.message); setEmailBody(d.message); setEmailSubject("Partnership Opportunity — AfroPuppyYoga 🐾"); },
    onError: (e) => toast.error(e.message),
  });
  const smsMutation = trpc.breederLeads.sendSms.useMutation({ onSuccess: () => { toast.success("SMS sent!"); setSmsMessage(""); refetch(); }, onError: (e) => toast.error(e.message) });
  const emailMutation = trpc.breederLeads.sendEmail.useMutation({ onSuccess: () => { toast.success("Email sent!"); setEmailBody(""); setEmailSubject(""); refetch(); }, onError: (e) => toast.error(e.message) });
  const noteMutation = trpc.breederLeads.addNote.useMutation({ onSuccess: () => { toast.success("Note saved"); setNoteText(""); refetch(); }, onError: (e) => toast.error(e.message) });
  const convertMutation = trpc.breederLeads.convertToBreeder.useMutation({
    onSuccess: () => { toast.success("Converted! Redirecting..."); setTimeout(() => navigate("/admin/breeders"), 1500); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.breederLeads.delete.useMutation({ onSuccess: () => { toast.success("Deleted"); navigate("/admin/breeder-leads"); }, onError: (e) => toast.error(e.message) });

  if (authLoading || isLoading) return <div className="min-h-screen bg-background"><AdminNav /><div className="max-w-5xl mx-auto px-4 py-8 space-y-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-32" />)}</div></div>;
  if (!user) return <div className="min-h-screen bg-background"><AdminNav /><div className="max-w-5xl mx-auto px-4 py-8 text-center text-muted-foreground">Please log in to view this page.</div></div>;
  if (error) return <div className="min-h-screen bg-background"><AdminNav /><div className="max-w-5xl mx-auto px-4 py-8 text-center text-red-500">Error loading lead: {error.message}</div></div>;
  if (!lead) return <div className="min-h-screen bg-background"><AdminNav /><div className="max-w-5xl mx-auto px-4 py-8 text-center text-muted-foreground">Lead not found.</div></div>;

  const reasons: string[] = (() => { try { return JSON.parse(lead.qualificationReasons ?? "[]"); } catch { return []; } })();
  const warnings: string[] = (() => { try { return JSON.parse(lead.disqualificationReasons ?? "[]"); } catch { return []; } })();
  const imageUrls: string[] = (() => { try { return JSON.parse(lead.listingImageUrls ?? "[]"); } catch { return []; } })();

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/breeder-leads")}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
            <div>
              <h1 className="text-xl font-bold">{lead.breed}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.pipelineStatus] ?? "bg-gray-100"}`}>{STATUS_LABELS[lead.pipelineStatus] ?? lead.pipelineStatus}</span>
                <span className="text-xs text-muted-foreground capitalize">{lead.source}</span>
                <span className="text-xs text-muted-foreground">Added {new Date(lead.createdAt).toLocaleDateString("en-CA")}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={lead.pipelineStatus} onValueChange={v => updateMutation.mutate({ id, pipelineStatus: v })}>
              <SelectTrigger className="w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABELS).map(([s,l]) => <SelectItem key={s} value={s}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={convertMutation.isPending}
              onClick={() => { if (confirm("Convert this lead to a breeder?")) convertMutation.mutate({ id }); }}>
              <UserPlus className="w-4 h-4 mr-2" />{convertMutation.isPending ? "Converting..." : "Convert to Breeder"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Opportunity</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Dog className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{lead.breed}</span></div>
                {lead.puppyCount && <div className="text-muted-foreground">{lead.puppyCount} puppies</div>}
                {lead.puppyAge && <div className="text-muted-foreground">{lead.puppyAge}</div>}
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-3 h-3" />{lead.city ?? "—"}{lead.province ? `, ${lead.province}` : ""}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.sellerName && <div className="font-medium">{lead.sellerName}</div>}
                {lead.phoneNumber && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3 h-3" />{lead.phoneNumber}</div>}
                {lead.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3 h-3" />{lead.email}</div>}
                {!lead.phoneNumber && !lead.email && <div className="text-muted-foreground text-xs">No contact info on file</div>}
              </CardContent>
            </Card>
            {lead.qualificationScore !== null && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Qualification</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className="text-3xl font-bold mb-2">{lead.qualificationScore}<span className="text-base font-normal text-muted-foreground">/100</span></div>
                  {reasons.map((r,i) => <div key={i} className="flex items-start gap-1 text-green-700 text-xs mb-1"><CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />{r}</div>)}
                  {warnings.map((w,i) => <div key={i} className="flex items-start gap-1 text-amber-600 text-xs mb-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w}</div>)}
                </CardContent>
              </Card>
            )}
            {lead.listingUrl && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Source Listing</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  {lead.listingTitle && <div className="font-medium mb-1 text-xs">{lead.listingTitle}</div>}
                  {imageUrls[0] && <img src={imageUrls[0]} alt="" className="w-full h-32 object-cover rounded mb-2" />}
                  {lead.listingDescription && <div className="text-xs text-muted-foreground line-clamp-4 mb-2">{lead.listingDescription}</div>}
                  <a href={lead.listingUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full text-xs"><ExternalLink className="w-3 h-3 mr-1" />View on Kijiji</Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="col-span-2 space-y-4">
            <div className="flex border-b">
              {(["outreach", "notes", "timeline"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "outreach" && (
              <div className="space-y-4">
                <Button variant="outline" size="sm" onClick={() => generateMutation.mutate({ id })} disabled={generateMutation.isPending}>
                  ✨ {generateMutation.isPending ? "Generating..." : "Generate Introduction"}
                </Button>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" />Send SMS</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea placeholder="Type your message..." value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={5} className="text-sm" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{lead.phoneNumber ?? "No phone on file"}</span>
                      <Button size="sm" disabled={!smsMessage || !lead.phoneNumber || smsMutation.isPending}
                        onClick={() => smsMutation.mutate({ id, message: smsMessage, phone: lead.phoneNumber! })}>
                        <Send className="w-3 h-3 mr-1" />{smsMutation.isPending ? "Sending..." : "Send SMS"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" />Send Email</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Input placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="text-sm" />
                    <Textarea placeholder="Message body..." value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="text-sm" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{lead.email ?? "No email on file"}</span>
                      <Button size="sm" disabled={!emailBody || !emailSubject || !lead.email || emailMutation.isPending}
                        onClick={() => emailMutation.mutate({ id, to: lead.email!, subject: emailSubject, body: emailBody })}>
                        <Send className="w-3 h-3 mr-1" />{emailMutation.isPending ? "Sending..." : "Send Email"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {data?.messages && data.messages.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Communication History</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {data.messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.direction === "outbound" ? "flex-row-reverse" : ""}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <div className="text-xs opacity-70 mb-1">{msg.channel.toUpperCase()} · {new Date(msg.sentAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                            <div className="whitespace-pre-wrap">{msg.body}</div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <Textarea placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} className="text-sm" />
                    <Button size="sm" disabled={!noteText || noteMutation.isPending} onClick={() => noteMutation.mutate({ id, note: noteText })}>
                      <StickyNote className="w-3 h-3 mr-1" />{noteMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </CardContent>
                </Card>
                {lead.internalNotes && <Card><CardContent className="pt-4"><pre className="text-sm whitespace-pre-wrap font-sans">{lead.internalNotes}</pre></CardContent></Card>}
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-2">
                {data?.activities && data.activities.length > 0 ? data.activities.map(act => (
                  <div key={act.id} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      <div className="text-sm">{act.description}</div>
                      <div className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                )) : <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t flex justify-end">
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => { if (confirm("Delete this lead permanently?")) deleteMutation.mutate({ id }); }}>
            Delete Lead
          </Button>
        </div>
      </div>
    </div>
  );
}
