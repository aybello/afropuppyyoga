import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, FileText, Loader2, LockKeyhole } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { downloadSignedOffer } from "@/lib/downloadSignedOffer";
import { toast } from "sonner";

export default function StaffDocuments() {
  const documents = trpc.staffDocuments.mySignedOffers.useQuery(undefined, { retry: false, gcTime: 0 });
  const [selection, setSelection] = useState<number | null>(null);
  const offers = documents.data ?? [];
  const selected = offers.find(offer => offer.id === selection) ?? offers[0];
  const download = trpc.staffDocuments.downloadMySignedOffer.useMutation({
    onSuccess: downloadSignedOffer,
    onError: error => toast.error(error.message || "Your PDF could not be prepared. Please try again."),
  });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "My Documents | APY HQ";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => { document.title = previousTitle; meta.remove(); };
  }, []);
  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#1A0A12]">
      <header className="border-b border-[#F0D0DC] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/staff" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#8B2252] hover:underline"><ArrowLeft size={16} /> APY HQ</Link>
          <span className="flex items-center gap-2 text-xs font-semibold text-[#8B2252]"><LockKeyhole size={14} /> Private documents</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6 md:py-10">
        <h1 className="text-3xl font-bold">My Documents</h1>
        <p className="mt-2 text-sm text-[#6D4B5B]">Your offer letter and NDA, ready to keep for your records.</p>
        <section className="mt-5 rounded-2xl border border-[#F0D0DC] bg-white p-5 shadow-sm" aria-live="polite">
          {documents.isLoading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Loading your documents...</p>
            : documents.error ? <div className="space-y-3 text-sm"><p>We could not load your documents. Sign in with your active staff account or try again.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => void documents.refetch()}>Try again</Button><Button asChild><Link href="/staff-access?returnTo=%2Fstaff%2Fdocuments">Staff sign-in</Link></Button></div></div>
            : !selected ? <div className="text-sm"><FileText className="mb-3 text-[#8B2252]" size={24} /><h2 className="font-semibold">No signed offer is available here yet</h2><p className="mt-2 leading-6 text-[#6D4B5B]">If you have already signed, ask APY to check the offer linked to your staff profile. This does not change your employee status.</p></div>
            : <>
              {offers.length > 1 && <div className="mb-4"><label htmlFor="signed-offer" className="mb-1 block text-xs font-semibold">Choose your signed offer</label><select id="signed-offer" className="h-11 w-full rounded-lg border border-[#F0D0DC] bg-white px-3 text-sm" value={selected.id} onChange={event => setSelection(Number(event.target.value))}>{offers.map(offer => <option key={offer.id} value={offer.id}>{offer.role} | {offer.location} | {new Date(offer.signedAt!).toLocaleDateString("en-CA")}</option>)}</select></div>}
              <div className="flex items-start gap-3"><FileText className="mt-1 shrink-0 text-[#8B2252]" size={24} /><div><h2 className="text-lg font-bold">Signed offer letter and NDA</h2><p className="mt-1 text-sm">{selected.role} · {selected.location}</p><p className="mt-2 text-xs text-[#6D4B5B]">Signed as {selected.signedName} on {new Date(selected.signedAt!).toLocaleString("en-CA", { timeZone: "America/Toronto" })} (Toronto)</p></div></div>
              {!selected.hasOriginalSnapshot && <p className="mt-4 rounded-lg bg-[#FFF5F8] p-3 text-xs leading-5 text-[#6D4B5B]">Older record: the original signed document text was not retained. Your PDF includes the saved signature and a clearly labelled reconstructed copy. Wording may differ from the original.</p>}
              <Button className="mt-5 min-h-11 w-full bg-[#8B2252] text-white hover:bg-[#6F1B42] sm:w-auto" disabled={download.isPending} onClick={() => download.mutate({ id: selected.id })}>{download.isPending ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Download className="mr-2" size={16} />}{download.isPending ? "Preparing PDF..." : "Download PDF"}</Button>
            </>}
        </section>
      </main>
    </div>
  );
}
