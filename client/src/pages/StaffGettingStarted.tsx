import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, FileText, GraduationCap, Mail, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LOGO_URL } from "@/const";
import { getRoleWelcome, INVOICE_GUIDE_STEPS, INVOICE_EXAMPLE, INVOICE_TEMPLATE } from "@shared/staffGettingStarted";

export type GettingStartedData = {
  staff: { name: string; role: string; location: string } | null;
  modules: { key: string }[];
  completedKeys: string[];
  adminPreview: boolean;
};

type Props = {
  data?: GettingStartedData;
  loading: boolean;
  error: boolean;
  saving: boolean;
  saveError?: string;
  onRetry: () => void;
  onAcknowledge: () => void;
};
const invoiceKey = "invoice-submission-v1";
const actionClass = "min-h-11 bg-[#8B2252] text-white hover:bg-[#6F1B42]";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([INVOICE_TEMPLATE], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "APY-invoice-template.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StaffGettingStartedView({ data, loading, error, saving, saveError, onRetry, onAcknowledge }: Props) {
  const staff = data?.staff;
  const welcome = getRoleWelcome(staff?.role ?? "");
  const trainingModules = data?.modules.filter(module => module.key !== invoiceKey) ?? [];
  const completed = new Set(data?.completedKeys ?? []);
  const trainingDone = trainingModules.filter(module => completed.has(module.key)).length;
  const invoiceDone = completed.has(invoiceKey);
  const canAcknowledge = Boolean(staff && data?.modules.some(module => module.key === invoiceKey));
  return (
    <div className="min-h-screen bg-[#FEFAF4] font-body text-[#1A0A12]">
      <header className="border-b border-[#F0D0DC] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/staff" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#8B2252] hover:underline"><ArrowLeft size={16} /> APY HQ</Link>
          <img src={LOGO_URL} alt="AfroPuppyYoga" className="h-10 w-10 rounded-full object-cover" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-7 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8B2252]">Your APY starting point</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Get Started</h1>
        <p className="mt-2 text-sm leading-6 text-[#6D4B5B]">A few useful things in one place. Come back whenever you need them.</p>
        {loading ? <p role="status" className="mt-6 rounded-2xl border border-[#F0D0DC] bg-white p-5 text-sm">Loading your staff guide...</p>
          : error || !data ? <section role="alert" className="mt-6 space-y-3 rounded-2xl border border-[#F0D0DC] bg-white p-5 text-sm">
            <h2 className="font-bold">We could not load your staff guide</h2>
            <p>Sign in with your own active staff account. If you are already signed in, try again or ask APY to check your profile.</p>
            <div className="flex flex-wrap gap-3"><Button variant="outline" className="min-h-11" onClick={onRetry}>Try again</Button><Button asChild className={actionClass}><Link href="/staff-access?returnTo=%2Fstaff%2Fget-started">Staff sign-in</Link></Button></div>
          </section>
          : <div className="mt-6 space-y-4">
            <section className="rounded-2xl border border-[#F0D0DC] bg-white p-5 sm:p-6" aria-labelledby="welcome-title">
              <p className="text-xs font-bold text-[#8B2252]">01 / WELCOME</p>
              <h2 id="welcome-title" className="mt-2 text-xl font-bold">{staff ? `Welcome, ${staff.name.split(" ")[0]}` : "Welcome to APY"}</h2>
              {staff ? <><p className="mt-1 text-sm font-semibold text-[#8B2252]">{staff.role} · {staff.location}</p><p className="mt-3 text-sm leading-6 text-[#6D4B5B]">{welcome.summary}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">{welcome.expectations.map(item => <li key={item}>{item}</li>)}</ul></>
                : <p className="mt-3 text-sm leading-6 text-[#6D4B5B]">{data.adminPreview ? "Owner preview. Staff see their own role, location and saved progress here. Previewing does not complete anything for an employee." : "Your staff profile is not available. Contact APY to check your access."}</p>}
              <a href="mailto:afropuppyyoga@gmail.com" className="mt-3 inline-flex min-h-11 items-center gap-2 break-all text-sm font-semibold text-[#8B2252] underline"><Mail size={16} className="shrink-0" /> Ask APY a question</a>
            </section>
            <section className="rounded-2xl border border-[#F0D0DC] bg-white p-5 sm:p-6" aria-labelledby="documents-title">
              <p className="text-xs font-bold text-[#8B2252]">02 / YOUR DOCUMENTS</p>
              <h2 id="documents-title" className="mt-2 flex items-center gap-2 text-lg font-bold"><FileText size={20} className="text-[#8B2252]" /> Keep your signed copy</h2>
              <p className="mt-2 text-sm leading-6 text-[#6D4B5B]">Open My Documents to download your signed offer letter and NDA. If a signed copy is missing, contact APY. You do not need to sign it again here.</p>
              <Button asChild className={`mt-4 ${actionClass}`}><Link href="/staff/documents">My Documents <ArrowRight size={16} /></Link></Button>
            </section>
            <section className="rounded-2xl border border-[#F0D0DC] bg-white p-5 sm:p-6" aria-labelledby="training-title">
              <p className="text-xs font-bold text-[#8B2252]">03 / YOUR TRAINING</p>
              <h2 id="training-title" className="mt-2 flex items-center gap-2 text-lg font-bold"><GraduationCap size={20} className="text-[#8B2252]" /> Know your role</h2>
              <p className="mt-2 text-sm leading-6 text-[#6D4B5B]">Read the lessons assigned to your role and confirm what you have reviewed. Your existing progress stays saved.</p>
              {staff && <p className="mt-3 text-sm font-semibold">{trainingModules.length ? `${trainingDone} of ${trainingModules.length} lessons acknowledged` : "No role lessons are assigned yet. Ask APY for guidance."}</p>}
              <p className="mt-2 text-xs leading-5 text-[#6D4B5B]">Reading a lesson is not approval to work independently. Check any practical training or shadowing arrangements with APY.</p>
              <Button asChild className={`mt-4 ${actionClass}`}><Link href="/staff/training">Open training <ArrowRight size={16} /></Link></Button>
            </section>
            <section id="invoice" className="scroll-mt-6 rounded-2xl border border-[#F0D0DC] bg-white p-5 sm:p-6" aria-labelledby="invoice-title">
              <p className="text-xs font-bold text-[#8B2252]">04 / YOUR INVOICE</p>
              <h2 id="invoice-title" className="mt-2 flex items-center gap-2 text-lg font-bold"><ReceiptText size={20} className="text-[#8B2252]" /> How to submit your invoice</h2>
              <p className="mt-2 text-sm leading-6 text-[#6D4B5B]">Use your agreed hours and rate or shift fee. You do not need to submit an invoice just to finish reading this guide.</p>
              <ol className="mt-4 space-y-4">{INVOICE_GUIDE_STEPS.map((step, index) => <li key={step.title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF5F8] text-xs font-bold text-[#8B2252]">{index + 1}</span><div><h3 className="text-sm font-bold">{step.title}</h3><p className="mt-1 text-sm leading-6 text-[#6D4B5B]">{step.description}</p></div></li>)}</ol>
              <details className="mt-5 rounded-xl border border-[#F0D0DC] p-4"><summary className="min-h-7 cursor-pointer text-sm font-semibold text-[#8B2252]">See a sample invoice and get a blank template</summary><p className="mt-3 text-xs leading-5 text-[#6D4B5B]">This example is fictional, not your pay rate. Replace every placeholder with your own details and agreed terms. The template is editable text: paste it into Word or Google Docs, fill it in, then export as PDF.</p><pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-[#FEFAF4] p-3 font-mono text-xs leading-6">{INVOICE_EXAMPLE}</pre><Button variant="outline" onClick={downloadTemplate} className="mt-3 min-h-11 w-full whitespace-normal sm:w-auto"><Download size={16} /> Download blank template (.txt)</Button></details>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button asChild className={actionClass}><Link href="/submit-invoice">Submit Invoice <ArrowRight size={16} /></Link></Button>{canAcknowledge && <Button variant="outline" className="min-h-11 whitespace-normal" disabled={saving || invoiceDone} onClick={onAcknowledge}>{invoiceDone ? <><CheckCircle2 size={16} /> Invoice guide acknowledged</> : saving ? "Saving..." : "I understand how to submit an invoice"}</Button>}</div>
              {saveError && <p role="alert" className="mt-3 text-sm text-red-700">Your acknowledgment was not saved. Please try again.</p>}
              <p aria-live="polite" className="mt-3 text-xs leading-5 text-[#6D4B5B]">{invoiceDone ? "Saved to your staff profile. This does not mean an invoice was submitted, approved or paid." : "Submission is received for review, not payment approval. Do not upload the same invoice again after confirmation. For corrections, contact APY."}</p>
            </section>
            <p className="py-2 text-center text-xs leading-5 text-[#6D4B5B]">Need help? <a className="break-all font-semibold underline" href="mailto:afropuppyyoga@gmail.com">afropuppyyoga@gmail.com</a></p>
          </div>}
      </main>
    </div>
  );
}

export default function StaffGettingStarted() {
  const guide = trpc.training.myTraining.useQuery(undefined, { retry: false, gcTime: 0 });
  const acknowledge = trpc.training.complete.useMutation({
    onSuccess: () => guide.refetch(),
  });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Get Started | APY HQ";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => { document.title = previousTitle; meta.remove(); };
  }, []);
  return <StaffGettingStartedView data={guide.data} loading={guide.isLoading} error={Boolean(guide.error)} saving={acknowledge.isPending} saveError={acknowledge.error?.message} onRetry={() => void guide.refetch()} onAcknowledge={() => acknowledge.mutate({ moduleKey: invoiceKey })} />;
}
