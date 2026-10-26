import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Copy, FileImage, ImagePlus, Instagram, Loader2, Megaphone, MonitorUp, PauseCircle, RefreshCw, ShieldAlert, ShieldCheck, Trash2, UploadCloud, Video } from "lucide-react";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { appendCampaignAttribution, calculateMaximumSpendCents, CampaignDraftInput, campaignDraftSchema, META_CAMPAIGN_MAX_CREATIVES, slugifyCampaign } from "@shared/metaCampaigns";
import { appendAttributionToLumaUrl } from "@/lib/lumaAttribution";
import { createLocalCreativePreview, releaseLocalCreativePreview } from "@/lib/localCreativePreview";

type EventSource = {
  type: "regular_class" | "private_event";
  id: number;
  eventName: string;
  city: string;
  date: string;
  bookingUrl: string;
  ticketPriceCents: number | null;
  seatsRemaining: number | null;
};

type Creative = {
  id: number;
  creativeKey: string;
  originalFilename: string;
  mediaType: "image" | "video";
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  validationStatus: string;
  validationMessage: string | null;
  deliveryStatus: string;
  lastError: string | null;
  previewUrl: string;
};

type Campaign = {
  id: number;
  campaignName: string;
  campaignSlug: string;
  primaryText: string;
  headline: string;
  description: string | null;
  callToAction: "BOOK_NOW" | "LEARN_MORE";
  placements: Array<"facebook" | "instagram">;
  budgetType: "daily" | "total";
  budgetCents: number;
  maximumSpendCents: number;
  startDate: string;
  endDate: string;
  status: string;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  lastError: string | null;
  createdAt: Date | string;
  event: { type: "regular_class" | "private_event"; id: number; name: string; city: string; date: string; bookingUrl: string; ticketPriceCents: number | null; seatsRemaining: number | null };
  creatives: Creative[];
};

const STEPS = ["Event", "Media", "Copy", "Budget & placements", "Review"] as const;
const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function cents(value: number | null | undefined) {
  return value === null || value === undefined ? "Not available" : CAD.format(value / 100);
}
function fileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
function sourceKey(source: { type: string; id: number }) { return `${source.type}:${source.id}`; }
function currentTorontoDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function initialDraft(source?: EventSource): CampaignDraftInput {
  const date = currentTorontoDate();
  return {
    source: source ? { type: source.type, id: source.id } : { type: "regular_class", id: 0 },
    campaignName: source ? `APY | ${source.city} | ${source.eventName} | ${source.date}`.slice(0, 160) : "",
    primaryText: "", headline: "", description: "", callToAction: "BOOK_NOW", placements: ["instagram", "facebook"],
    budgetType: "daily", budgetCents: 2500, startDate: date, endDate: source?.date ?? date,
  };
}

export default function MetaCampaignCreator() {
  const { user, loading: authLoading } = useAuth();
  const access = trpc.staff.myAccess.useQuery(undefined, { enabled: Boolean(user) });
  const configured = trpc.metaCampaigns.configuration.useQuery(undefined, { enabled: access.data?.level === "owner" });
  const sources = trpc.metaCampaigns.eligibleSources.useQuery(undefined, { enabled: access.data?.level === "owner" });
  const campaignsQuery = trpc.metaCampaigns.list.useQuery(undefined, { enabled: access.data?.level === "owner" });
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [draft, setDraft] = useState<CampaignDraftInput>(() => initialDraft());
  const [selectedSource, setSelectedSource] = useState<EventSource | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);
  const localPreviewUrls = useRef<string[]>([]);

  useEffect(() => {
    document.title = "Campaign Creator | APY HQ";
    const robots = document.querySelector('meta[name="robots"]') ?? document.head.appendChild(document.createElement("meta"));
    robots.setAttribute("name", "robots"); robots.setAttribute("content", "noindex, nofollow, noarchive");
    return () => { robots.setAttribute("content", "index, follow"); localPreviewUrls.current.forEach(url => releaseLocalCreativePreview(url)); };
  }, []);

  const createDraft = trpc.metaCampaigns.createDraft.useMutation({
    onSuccess: async ({ id, warning }) => { setCampaignId(id); if (warning) setNotice(warning); await utils.metaCampaigns.list.invalidate(); },
    onError: error => setPageError(error.message),
  });
  const beginDraft = trpc.metaCampaigns.beginDraft.useMutation({
    onSuccess: async ({ id }) => { setCampaignId(id); await utils.metaCampaigns.list.invalidate(); },
    onError: error => setPageError(error.message),
  });
  const updateDraft = trpc.metaCampaigns.updateDraft.useMutation({
    onSuccess: async ({ warning }) => { if (warning) setNotice(warning); await utils.metaCampaigns.list.invalidate(); },
    onError: error => setPageError(error.message),
  });
  const deleteCreative = trpc.metaCampaigns.deleteCreative.useMutation({
    onError: error => setPageError(error.message),
  });
  const duplicate = trpc.metaCampaigns.duplicateAsDraft.useMutation({
    onSuccess: async ({ id }) => { await utils.metaCampaigns.list.invalidate(); const campaign = campaignsQuery.data?.find(item => item.id === id) as Campaign | undefined; if (campaign) openCampaign(campaign); else toast.success("Campaign copied as a local draft."); },
    onError: error => toast.error(error.message),
  });
  const submit = trpc.metaCampaigns.submitToMeta.useMutation({
    onSuccess: async result => { setNotice(result.message); await utils.metaCampaigns.list.invalidate(); if (campaignId) await utils.metaCampaigns.get.invalidate({ campaignId }); },
    onError: error => setPageError(error.message),
  });

  const activeSource = selectedSource ?? sources.data?.find(item => sourceKey(item) === sourceKey(draft.source)) ?? null;
  const spend = calculateMaximumSpendCents(draft);
  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(activeSource);
    if (step === 1) return creatives.length > 0 && creatives.length <= META_CAMPAIGN_MAX_CREATIVES;
    if (step === 2) return Boolean(draft.primaryText.trim() && draft.headline.trim());
    if (step === 3) return campaignDraftSchema.safeParse(draft).success;
    return Boolean(campaignId && creatives.length);
  }, [activeSource, campaignId, creatives.length, draft, step]);

  if (authLoading || access.isLoading) return <LoadingScreen />;
  if (!user) return <AccessScreen title="Sign in required" detail="Campaign Creator is an owner-only APY HQ tool." />;
  if (access.data?.level !== "owner") return <AccessScreen title="Owner access required" detail="Campaign drafts, APY Meta account identifiers, and creative media are visible only to the APY owner." />;

  function update<K extends keyof CampaignDraftInput>(key: K, value: CampaignDraftInput[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  function startNew() {
    setMode("editor"); setStep(0); setCampaignId(null); setDraft(initialDraft()); setSelectedSource(null); setCreatives([]); setPageError(null); setNotice(null);
  }
  function openCampaign(campaign: Campaign) {
    setCampaignId(campaign.id); setSelectedSource({ type: campaign.event.type, id: campaign.event.id, eventName: campaign.event.name, city: campaign.event.city, date: campaign.event.date, bookingUrl: campaign.event.bookingUrl, ticketPriceCents: campaign.event.ticketPriceCents, seatsRemaining: campaign.event.seatsRemaining });
    setDraft({ source: { type: campaign.event.type, id: campaign.event.id }, campaignName: campaign.campaignName, primaryText: campaign.primaryText, headline: campaign.headline, description: campaign.description ?? "", callToAction: campaign.callToAction, placements: campaign.placements, budgetType: campaign.budgetType, budgetCents: campaign.budgetCents, startDate: campaign.startDate, endDate: campaign.endDate });
    setCreatives(campaign.creatives); setStep(0); setMode("editor"); setPageError(null); setNotice(campaign.lastError);
  }
  async function persistDraft() {
    const parsed = campaignDraftSchema.safeParse(draft);
    if (!parsed.success) { setPageError(parsed.error.issues[0]?.message ?? "Complete the required campaign fields."); return null; }
    if (!campaignId) {
      const result = await createDraft.mutateAsync(parsed.data);
      return result.id;
    }
    await updateDraft.mutateAsync({ campaignId, ...parsed.data, source: undefined } as never);
    return campaignId;
  }
  async function next() {
    setPageError(null);
    if (!canContinue) { setPageError(step === 1 ? "Upload at least one valid ad variation before continuing." : "Complete this step before continuing."); return; }
    if (step === 0) {
      if (!activeSource) return;
      const nextDraft = initialDraft(activeSource);
      setSelectedSource(activeSource); setDraft(current => ({ ...nextDraft, primaryText: current.primaryText, headline: current.headline, description: current.description, placements: current.placements, budgetType: current.budgetType, budgetCents: current.budgetCents, startDate: current.startDate, endDate: activeSource.date }));
    }
    if (step === 3) await persistDraft();
    setStep(current => Math.min(4, current + 1));
  }
  async function uploadFiles(files: FileList | null, replaceCreativeId?: number) {
    if (!files?.length) return;
    const id = campaignId ?? (activeSource ? (await beginDraft.mutateAsync({ type: activeSource.type, id: activeSource.id })).id : null);
    if (!id) return;
    const file = files[0];
    if (!replaceCreativeId && creatives.length >= META_CAMPAIGN_MAX_CREATIVES) { setPageError(`A campaign can contain up to ${META_CAMPAIGN_MAX_CREATIVES} ad variations.`); return; }
    const preview = createLocalCreativePreview(file); localPreviewUrls.current.push(preview);
    setNotice(`Uploading ${file.name} privately…`);
    try {
      const form = new FormData(); form.set("campaignId", String(id)); form.set("creative", file); if (replaceCreativeId) form.set("replaceCreativeId", String(replaceCreativeId));
      const response = await fetch("/api/meta-campaigns/assets", { method: "POST", credentials: "include", body: form });
      const payload = await response.json().catch(() => ({})) as Creative & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Campaign media upload failed.");
      setCreatives(current => replaceCreativeId ? current.map(item => item.id === replaceCreativeId ? payload : item) : [...current, payload]);
      releaseLocalCreativePreview(preview); localPreviewUrls.current = localPreviewUrls.current.filter(item => item !== preview);
      setNotice(`${payload.originalFilename} is valid and ready.`); setPageError(null);
    } catch (error) {
      releaseLocalCreativePreview(preview); localPreviewUrls.current = localPreviewUrls.current.filter(item => item !== preview);
      setPageError(error instanceof Error ? error.message : "Campaign media upload failed.");
    }
  }
  async function removeCreative(creative: Creative) {
    if (!campaignId) return;
    await deleteCreative.mutateAsync({ campaignId, creativeId: creative.id });
    setCreatives(current => current.filter(item => item.id !== creative.id)); await utils.metaCampaigns.list.invalidate();
  }
  function chooseFiles(replaceCreativeId?: number) { replaceTargetRef.current = replaceCreativeId ?? null; fileInputRef.current?.click(); }
  function selectSource(value: string) {
    const source = sources.data?.find(item => sourceKey(item) === value) ?? null;
    if (!source) return;
    setSelectedSource(source); setDraft(current => ({ ...current, source: { type: source.type, id: source.id }, campaignName: `APY | ${source.city} | ${source.eventName} | ${source.date}`.slice(0, 160), endDate: source.date }));
  }
  async function createInMeta() {
    if (!campaignId) return;
    await submit.mutateAsync({ campaignId, idempotencyKey: crypto.randomUUID(), confirm: true });
  }

  if (mode === "list") return <CampaignList campaigns={(campaignsQuery.data ?? []) as Campaign[]} loading={campaignsQuery.isLoading} error={campaignsQuery.error?.message} configuration={configured.data} onCreate={startNew} onOpen={openCampaign} onDuplicate={id => duplicate.mutate({ campaignId: id })} />;

  return <div className="min-h-screen bg-[#FEFAF4]">
    <AdminNav />
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><button onClick={() => setMode("list")} className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B2252] hover:underline"><ArrowLeft className="h-4 w-4" />Campaign list</button><p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8B2252]">Owner-only growth workspace</p><h1 className="mt-1 font-display text-3xl text-[#1A0A12]">Create Campaign</h1><p className="mt-1 max-w-2xl font-body text-sm text-[#6B4C3B]">Build a private local draft first. No media is sent to Meta and no ad spend begins until you explicitly confirm the final review.</p></div>
        <div className="rounded-2xl border border-[#F0D0DC] bg-white px-4 py-3 text-right"><p className="text-xs font-semibold uppercase tracking-wide text-[#8B6876]">Meta connection</p><p className={`mt-1 text-sm font-semibold ${configured.data?.status === "configured" ? "text-emerald-700" : "text-amber-800"}`}>{configured.data?.status === "configured" ? "APY account configured" : "Publishing locked"}</p></div>
      </header>
      {configured.data?.status !== "configured" && <Alert className="mt-6 border-amber-200 bg-amber-50 text-amber-950"><ShieldAlert className="h-4 w-4"/><AlertTitle>Meta publishing is locked</AlertTitle><AlertDescription>{configured.data?.reason} You can still prepare and review APY campaign drafts.</AlertDescription></Alert>}
      {pageError && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertTitle>Action needed</AlertTitle><AlertDescription>{pageError}</AlertDescription></Alert>}
      {notice && <Alert className="mt-5 border-[#D5E8DD] bg-[#F3FBF6] text-[#173F30]"><CheckCircle2 className="h-4 w-4"/><AlertTitle>Campaign update</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
      <ol className="mt-6 grid grid-cols-5 gap-1 rounded-2xl border border-[#F0D0DC] bg-white p-2" aria-label="Campaign creation steps">{STEPS.map((label, index) => <li key={label} className={`rounded-xl px-2 py-2 text-center text-[10px] font-bold sm:text-xs ${index === step ? "bg-[#8B2252] text-white" : index < step ? "bg-[#F9E9EF] text-[#8B2252]" : "text-[#8B6876]"}`} aria-current={index === step ? "step" : undefined}><span className="mr-1 opacity-75">{index + 1}</span><span className="hidden sm:inline">{label}</span></li>)}</ol>
      <section className="mt-5"><StepCard step={step} sources={sources.data ?? []} selectedSource={activeSource} draft={draft} creatives={creatives} campaignId={campaignId} onSource={selectSource} onUpdate={update} onChooseFiles={chooseFiles} onRemove={removeCreative} onBookingPreview={() => activeSource && window.open(appendAttributionToLumaUrl(appendCampaignAttribution(activeSource.bookingUrl, slugifyCampaign(draft.campaignName), "preview")), "_blank", "noopener,noreferrer")} /></section>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.mov" className="sr-only" onChange={event => { void uploadFiles(event.currentTarget.files, replaceTargetRef.current ?? undefined); event.currentTarget.value = ""; replaceTargetRef.current = null; }} />
      <footer className="sticky bottom-3 z-20 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#E5CBD7] bg-white/95 p-3 shadow-lg backdrop-blur"><Button variant="outline" className="rounded-full" disabled={step === 0 || createDraft.isPending || updateDraft.isPending} onClick={() => setStep(current => Math.max(0, current - 1))}><ChevronLeft className="mr-1 h-4 w-4"/>Back</Button>{step < 4 ? <Button className="rounded-full bg-[#8B2252] text-white hover:bg-[#6B1A3E]" disabled={!canContinue || createDraft.isPending || updateDraft.isPending} onClick={() => void next()}>{createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Continue<ChevronRight className="ml-1 h-4 w-4"/></Button> : <AlertDialog><AlertDialogTrigger asChild><Button className="rounded-full bg-[#8B2252] text-white hover:bg-[#6B1A3E]" disabled={!canContinue || submit.isPending}><Megaphone className="mr-2 h-4 w-4"/>Create campaign in Meta</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Create this Meta campaign?</AlertDialogTitle><AlertDialogDescription>Create one Meta campaign with one paused ad set and {creatives.length} paused ad variation{creatives.length === 1 ? "" : "s"} using the configured APY Facebook and Instagram identities. Maximum planned spend: {cents(spend)}. Meta billing and policy review remain controlled by Meta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep reviewing</AlertDialogCancel><AlertDialogAction onClick={() => void createInMeta()} className="bg-[#8B2252] hover:bg-[#6B1A3E]">{submit.isPending ? "Submitting…" : "Confirm and create"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</footer>
    </main>
  </div>;
}

function StepCard({ step, sources, selectedSource, draft, creatives, campaignId, onSource, onUpdate, onChooseFiles, onRemove, onBookingPreview }: { step: number; sources: EventSource[]; selectedSource: EventSource | null; draft: CampaignDraftInput; creatives: Creative[]; campaignId: number | null; onSource: (value: string) => void; onUpdate: <K extends keyof CampaignDraftInput>(key: K, value: CampaignDraftInput[K]) => void; onChooseFiles: (creativeId?: number) => void; onRemove: (creative: Creative) => void; onBookingPreview: () => void }) {
  if (step === 0) return <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader><CardTitle className="font-display text-xl">Choose the APY event</CardTitle><p className="font-body text-sm text-[#6B4C3B]">Only upcoming public classes and approved, published private events with a canonical booking link are eligible.</p></CardHeader><CardContent className="space-y-5"><div><Label htmlFor="event-source">APY event</Label><select id="event-source" value={selectedSource ? sourceKey(selectedSource) : ""} onChange={event => onSource(event.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" aria-describedby="event-source-note"><option value="" disabled>Select an upcoming event</option>{sources.map(source => <option key={sourceKey(source)} value={sourceKey(source)}>{source.date} · {source.city} · {source.eventName}</option>)}</select><p id="event-source-note" className="mt-2 text-xs text-[#806475]">No customer or attendee information is used in campaign creation.</p></div>{selectedSource && <EventSummary source={selectedSource} onBookingPreview={onBookingPreview}/>}</CardContent></Card>;
  if (step === 1) return <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="font-display text-xl">Upload ad variations</CardTitle><p className="mt-1 font-body text-sm text-[#6B4C3B]">Each file becomes a separate variation. JPEG, PNG, WebP, MP4, and MOV only.</p></div><span className="rounded-full bg-[#FFF0F4] px-3 py-1 text-xs font-bold text-[#8B2252]">{creatives.length}/{META_CAMPAIGN_MAX_CREATIVES}</span></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{creatives.map(creative => <CreativeTile key={creative.id} creative={creative} onReplace={() => onChooseFiles(creative.id)} onRemove={() => void onRemove(creative)} />)}{creatives.length < META_CAMPAIGN_MAX_CREATIVES && <button onClick={() => onChooseFiles()} className="min-h-48 rounded-2xl border-2 border-dashed border-[#DDB0C3] bg-[#FFF8FB] p-3 text-center text-[#8B2252] transition hover:border-[#8B2252] hover:bg-[#FFF0F4]"><ImagePlus className="mx-auto h-7 w-7"/><span className="mt-2 block text-xs font-bold">Add variation</span><span className="mt-1 block text-[10px] text-[#8B6876]">Private upload</span></button>}</div>{!campaignId && <p className="mt-4 text-xs text-[#806475]">Your first upload will save a private local draft. It will not contact Meta.</p>}</CardContent></Card>;
  if (step === 2) return <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader><CardTitle className="font-display text-xl">Write the ad copy</CardTitle><p className="font-body text-sm text-[#6B4C3B]">This copy is shared by each ad variation in this campaign.</p></CardHeader><CardContent className="space-y-5"><div><Label htmlFor="primary-text">Primary text</Label><Textarea id="primary-text" value={draft.primaryText} onChange={event => onUpdate("primaryText", event.target.value)} maxLength={2200} className="mt-1.5 min-h-32"/><p className="mt-1 text-right text-xs text-[#806475]">{draft.primaryText.length}/2200</p></div><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="headline">Headline</Label><Input id="headline" className="mt-1.5" value={draft.headline} maxLength={255} onChange={event => onUpdate("headline", event.target.value)} /></div><div><Label htmlFor="cta">Call to action</Label><select id="cta" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.callToAction} onChange={event => onUpdate("callToAction", event.target.value as CampaignDraftInput["callToAction"])}><option value="BOOK_NOW">Book now</option><option value="LEARN_MORE">Learn more</option></select></div></div><div><Label htmlFor="description">Optional description</Label><Input id="description" className="mt-1.5" value={draft.description ?? ""} maxLength={255} onChange={event => onUpdate("description", event.target.value)} /></div></CardContent></Card>;
  if (step === 3) return <Card className="rounded-2xl border-[#F0D0DC] bg-white"><CardHeader><CardTitle className="font-display text-xl">Budget and placements</CardTitle><p className="font-body text-sm text-[#6B4C3B]">APY will create delivery-paused Meta objects. Meta controls review, billing, and delivery after an owner chooses to activate them in Meta.</p></CardHeader><CardContent className="space-y-6"><div><Label>Placements</Label><div className="mt-2 flex flex-wrap gap-3">{(["instagram", "facebook"] as const).map(platform => <label key={platform} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E7CBD8] bg-[#FFF8FB] px-4 py-3 text-sm font-semibold text-[#4C2638]"><input type="checkbox" checked={draft.placements.includes(platform)} onChange={event => onUpdate("placements", event.target.checked ? [...draft.placements, platform] : draft.placements.filter(item => item !== platform))} />{platform === "instagram" ? <Instagram className="h-4 w-4 text-[#B33E72]"/> : <MonitorUp className="h-4 w-4 text-[#4267B2]"/>}{platform === "instagram" ? "Instagram" : "Facebook"}</label>)}</div></div><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="budget-type">Budget type</Label><select id="budget-type" className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.budgetType} onChange={event => onUpdate("budgetType", event.target.value as CampaignDraftInput["budgetType"])}><option value="daily">Daily budget</option><option value="total">Total budget</option></select></div><div><Label htmlFor="budget">Budget (CAD)</Label><Input id="budget" className="mt-1.5" type="number" min="5" max="5000" step="0.01" value={(draft.budgetCents / 100).toFixed(2)} onChange={event => onUpdate("budgetCents", Math.round(Number(event.target.value || 0) * 100))} /></div><div><Label htmlFor="start">Start date</Label><Input id="start" className="mt-1.5" type="date" min={currentTorontoDate()} value={draft.startDate} onChange={event => onUpdate("startDate", event.target.value)} /></div><div><Label htmlFor="end">End date</Label><Input id="end" className="mt-1.5" type="date" min={draft.startDate} value={draft.endDate} onChange={event => onUpdate("endDate", event.target.value)} /></div></div><div className="rounded-xl border border-[#D5E8DD] bg-[#F3FBF6] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#416557]">Maximum planned spend</p><p className="mt-1 font-display text-3xl text-[#173F30]">{cents(calculateMaximumSpendCents(draft))}</p><p className="mt-1 text-xs text-[#416557]">{draft.budgetType === "daily" ? "Daily budget multiplied by the inclusive date range." : "Total lifetime budget."}</p></div></CardContent></Card>;
  return <ReviewCard source={selectedSource} draft={draft} creatives={creatives} />;
}

function EventSummary({ source, onBookingPreview }: { source: EventSource; onBookingPreview: () => void }) { return <div className="rounded-2xl border border-[#D5E8DD] bg-[#F3FBF6] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#416557]">Selected APY event</p><h2 className="mt-1 font-display text-xl text-[#173F30]">{source.eventName}</h2><p className="mt-1 text-sm text-[#416557]">{source.city} · {source.date}</p></div><Button variant="outline" className="border-[#1F6B52] text-[#1F6B52] hover:bg-emerald-50" onClick={onBookingPreview}>View booking link</Button></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[#416557]">Ticket from</p><p className="font-semibold text-[#173F30]">{cents(source.ticketPriceCents)}</p></div><div><p className="text-xs text-[#416557]">Seats remaining</p><p className="font-semibold text-[#173F30]">{source.seatsRemaining ?? "Not available"}</p></div></div></div>; }
function CreativeTile({ creative, onReplace, onRemove }: { creative: Creative; onReplace: () => void; onRemove: () => void }) { return <article className="relative overflow-hidden rounded-2xl border border-[#E5CBD7] bg-white"><div className="aspect-square bg-[#F8EEF2]">{creative.mediaType === "video" ? <video src={creative.previewUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" /> : <img src={creative.previewUrl} alt="" className="h-full w-full object-cover" />}</div><div className="space-y-1 p-2"><p className="truncate text-[11px] font-semibold text-[#3D1A2E]" title={creative.originalFilename}>{creative.originalFilename}</p><p className="text-[10px] text-[#8B6876]">{creative.width}×{creative.height}{creative.durationSeconds ? ` · ${creative.durationSeconds}s` : ""}</p><p className="text-[10px] text-emerald-700">{creative.validationMessage ?? "Ready"}</p><div className="flex gap-1 pt-1"><button onClick={onReplace} className="rounded-md border border-[#E7CBD8] px-1.5 py-1 text-[10px] font-bold text-[#8B2252] hover:bg-[#FFF0F4]">Replace</button><button onClick={onRemove} className="rounded-md border border-rose-200 px-1.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50" aria-label={`Remove ${creative.originalFilename}`}><Trash2 className="h-3 w-3"/></button></div></div></article>; }
function ReviewCard({ source, draft, creatives }: { source: EventSource | null; draft: CampaignDraftInput; creatives: Creative[] }) { const spend = calculateMaximumSpendCents(draft); return <Card className="rounded-2xl border-[#D5E8DD] bg-white"><CardHeader><CardTitle className="font-display text-xl">Review before Meta</CardTitle><p className="font-body text-sm text-[#6B4C3B]">No hidden settings. This action creates paused campaign objects only; it does not automatically start delivery or spend.</p></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 rounded-xl bg-[#F3FBF6] p-4 sm:grid-cols-2"><ReviewItem label="APY event" value={source ? `${source.eventName} · ${source.city} · ${source.date}` : "Not selected"}/><ReviewItem label="Creatives" value={`${creatives.length} separate ad variation${creatives.length === 1 ? "" : "s"}`}/><ReviewItem label="Placements" value={draft.placements.join(" + ") || "Not selected"}/><ReviewItem label="Maximum spend" value={cents(spend)}/><ReviewItem label="Dates" value={`${draft.startDate} to ${draft.endDate}`}/><ReviewItem label="Booking URL" value={source?.bookingUrl ?? "Not selected"}/></div><div className="rounded-xl border border-[#F0D0DC] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#8B2252]">Creative preview</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">{creatives.map(creative => <CreativeTile key={creative.id} creative={creative} onReplace={() => undefined} onRemove={() => undefined}/>)}</div></div><Alert className="border-amber-200 bg-amber-50 text-amber-950"><PauseCircle className="h-4 w-4"/><AlertTitle>Provider safety</AlertTitle><AlertDescription>APY sends requests only to an explicitly locked APY account. If the Meta connection is missing, the final action safely stops with no provider mutation. If a provider request has an uncertain outcome, APY will not retry it automatically.</AlertDescription></Alert></CardContent></Card>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#567165]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#173F30]">{value}</p></div>; }
function CampaignList({ campaigns, loading, error, configuration, onCreate, onOpen, onDuplicate }: { campaigns: Campaign[]; loading: boolean; error?: string; configuration: { status: string; account: { adAccountId: string | null; facebookPageId: string | null; instagramAccountId: string | null } | null; reason: string | null } | undefined; onCreate: () => void; onOpen: (campaign: Campaign) => void; onDuplicate: (id: number) => void }) { return <div className="min-h-screen bg-[#FEFAF4]"><AdminNav/><main className="max-w-7xl mx-auto px-4 py-8"><header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B2252]">Owner-only growth workspace</p><h1 className="mt-2 font-display text-3xl text-[#1A0A12]">Campaign Creator</h1><p className="mt-1 max-w-2xl font-body text-sm text-[#6B4C3B]">Prepare Meta campaign drafts with APY event data, private creative storage, and deliberate final confirmation.</p></div><Button onClick={onCreate} className="rounded-full bg-[#8B2252] text-white hover:bg-[#6B1A3E]"><Megaphone className="mr-2 h-4 w-4"/>Create campaign</Button></header>{configuration?.status !== "configured" ? <Alert className="mt-6 border-amber-200 bg-amber-50 text-amber-950"><ShieldAlert className="h-4 w-4"/><AlertTitle>Publishing connection is not configured</AlertTitle><AlertDescription>{configuration?.reason ?? "APY can still prepare private campaign drafts."}</AlertDescription></Alert> : <Alert className="mt-6 border-[#D5E8DD] bg-[#F3FBF6] text-[#173F30]"><ShieldCheck className="h-4 w-4"/><AlertTitle>APY Meta connection configured</AlertTitle><AlertDescription>Account ending {configuration.account?.adAccountId?.slice(-4)} · Page ending {configuration.account?.facebookPageId?.slice(-4)} · Instagram ending {configuration.account?.instagramAccountId?.slice(-4)}. Echelon is not selectable here.</AlertDescription></Alert>}{error && <Alert variant="destructive" className="mt-6"><AlertCircle className="h-4 w-4"/><AlertTitle>Campaign list unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<section className="mt-6">{loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-[#F0D0DC] bg-white"/>)}</div> : campaigns.length ? <div className="grid gap-4 md:grid-cols-2">{campaigns.map(campaign => <Card key={campaign.id} className="rounded-2xl border-[#F0D0DC] bg-white"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#8B2252]">{campaign.status}</p><h2 className="mt-1 font-display text-xl text-[#1A0A12]">{campaign.campaignName}</h2><p className="mt-1 text-sm text-[#6B4C3B]">{campaign.event.city} · {campaign.event.date}</p></div><span className="rounded-full bg-[#FFF0F4] px-2.5 py-1 text-xs font-bold text-[#8B2252]">{campaign.creatives.length} ad{campaign.creatives.length === 1 ? "" : "s"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[#806475]">Budget</p><p className="font-semibold">{cents(campaign.maximumSpendCents)}</p></div><div><p className="text-xs text-[#806475]">Meta campaign</p><p className="truncate font-semibold">{campaign.metaCampaignId ?? "Not created"}</p></div></div>{campaign.lastError && <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{campaign.lastError}</p>}<div className="mt-5 flex flex-wrap gap-2"><Button size="sm" onClick={() => onOpen(campaign)} className="rounded-full bg-[#8B2252] text-white hover:bg-[#6B1A3E]">Open</Button><Button size="sm" variant="outline" className="rounded-full" onClick={() => onDuplicate(campaign.id)}><Copy className="mr-1 h-3.5 w-3.5"/>Duplicate draft</Button></div></CardContent></Card>)}</div> : <Card className="rounded-2xl border-dashed border-[#DDB0C3] bg-[#FFF8FB]"><CardContent className="p-10 text-center"><Megaphone className="mx-auto h-10 w-10 text-[#8B2252]"/><h2 className="mt-3 font-display text-xl text-[#1A0A12]">No campaign drafts yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#6B4C3B]">Create a campaign for an upcoming APY event. Media remains private until you make the final Meta submission.</p><Button onClick={onCreate} className="mt-5 rounded-full bg-[#8B2252] text-white hover:bg-[#6B1A3E]">Create your first campaign</Button></CardContent></Card>}</section></main></div>; }
function LoadingScreen() { return <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center" role="status" aria-live="polite"><Loader2 className="h-8 w-8 animate-spin text-[#8B2252]"/><span className="sr-only">Loading Campaign Creator</span></div>; }
function AccessScreen({ title, detail }: { title: string; detail: string }) { return <div className="min-h-screen bg-[#FEFAF4]"><AdminNav/><main className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center"><ShieldAlert className="h-10 w-10 text-[#8B2252]"/><h1 className="mt-4 font-display text-2xl text-[#1A0A12]">{title}</h1><p className="mt-2 text-sm text-[#6B4C3B]">{detail}</p><Link href="/staff" className="mt-6 rounded-full bg-[#8B2252] px-5 py-2.5 text-sm font-semibold text-white">Back to APY HQ</Link></main></div>; }
