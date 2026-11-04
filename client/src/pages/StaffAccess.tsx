import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, FileText, KeyRound, Loader2, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl, LOGO_URL } from "@/const";
import { getSafeApyHqReturnPath } from "@shared/apyHqQueryState";

export default function StaffAccess() {
  const [, navigate] = useLocation();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);

  const requestPhoneCode = trpc.staff.requestPhoneAccessCode.useMutation({
    onSuccess: (_data, input) => { setSubmittedPhone(input.phone.trim()); setCode(""); setCodeSent(true); },
  });
  const requestEmailCode = trpc.staff.requestEmailAccessCode.useMutation({
    onSuccess: (_data, input) => { setSubmittedEmail(input.email.trim().toLowerCase()); setCode(""); setEmailCodeSent(true); },
  });
  const verifyPhoneCode = trpc.staff.verifyPhoneAccessCode.useMutation({
    onSuccess: () => navigate(getSafeApyHqReturnPath(window.location.search)),
  });
  const verifyEmailCode = trpc.staff.verifyEmailAccessCode.useMutation({
    onSuccess: () => navigate(getSafeApyHqReturnPath(window.location.search)),
  });

  const busy = requestPhoneCode.isPending || requestEmailCode.isPending || verifyPhoneCode.isPending || verifyEmailCode.isPending;
  const inputClass = "w-full rounded-xl border border-input bg-card text-foreground px-4 py-3 text-base outline-none ring-ring focus:ring-2";
  const buttonClass = "flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60";

  function changeMethod(next: "phone" | "email") {
    if (busy) return;
    setMethod(next); setCodeSent(false); setEmailCodeSent(false); setCode("");
    requestPhoneCode.reset(); requestEmailCode.reset(); verifyPhoneCode.reset(); verifyEmailCode.reset();
  }

  return (
    <main className="min-h-screen apy-staff-ui bg-background px-5 py-6 text-foreground sm:py-8">
      <section className="mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="mx-auto h-12 w-12 rounded-2xl object-cover" />
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-link">APY HQ</p>
          <h1 className="mt-2 font-display text-3xl font-medium text-foreground">Staff sign-in</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Use your own saved phone or email. Managers use their own staff account, not the owner&apos;s.</p>
        </div>

        <a
          href="/submit-invoice"
          className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-accent p-3 text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <FileText size={22} className="shrink-0 text-brand-link" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Submit Invoice</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">For contractors and one-time staff. No login needed.</span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-brand-link" aria-hidden="true" />
        </a>

        <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Sign-in method">
          {(["phone", "email"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={method === value} disabled={busy} onClick={() => changeMethod(value)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring ${method === value ? "border-ring bg-accent text-foreground" : "border-border text-muted-foreground"}`}>
              {value === "phone" ? "Text me a code" : "Email me a code"}
            </button>
          ))}
        </div>

        {method === "phone" && !codeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy) requestPhoneCode.mutate({ phone }); }}>
          <label className="block text-sm font-bold text-foreground" htmlFor="staff-phone">Your mobile number</label>
          <input id="staff-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Enter your own mobile number" className={inputClass} />
          {requestPhoneCode.error && <p role="alert" className="text-sm text-red-700">{requestPhoneCode.error.message}</p>}
          <button type="submit" disabled={busy || !phone.trim()} className={buttonClass}>{requestPhoneCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareText size={18} />} Send verification code</button>
        </form>}

        {method === "phone" && codeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy && code.length === 6) verifyPhoneCode.mutate({ phone: submittedPhone, code }); }}>
          <div role="status" className="rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] p-3 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline text-foreground" size={17} />If <strong className="break-all">{submittedPhone}</strong> is saved on an active account, a code has been sent to that number. It expires in 10 minutes.</div>
          <label className="block text-sm font-bold text-foreground" htmlFor="staff-phone-code">Six-digit code</label>
          <input id="staff-phone-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className={`${inputClass} text-center text-xl font-bold tracking-[0.35em]`} />
          {verifyPhoneCode.error && <p role="alert" className="text-sm text-red-700">{verifyPhoneCode.error.message}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>{verifyPhoneCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Access APY HQ</button>
          <button type="button" disabled={busy} onClick={() => changeMethod("phone")} className="w-full min-h-11 py-2 text-sm font-semibold text-brand-link underline">Change number or request another code</button>
        </form>}

        {method === "email" && !emailCodeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy) requestEmailCode.mutate({ email }); }}>
          <label className="block text-sm font-bold text-foreground" htmlFor="staff-email">Your saved email</label>
          <input id="staff-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your own email address" className={inputClass} />
          {requestEmailCode.error && <p role="alert" className="text-sm text-red-700">{requestEmailCode.error.message}</p>}
          <button type="submit" disabled={busy || !email.trim()} className={buttonClass}>{requestEmailCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} Send verification code</button>
        </form>}

        {method === "email" && emailCodeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy && code.length === 6) verifyEmailCode.mutate({ email: submittedEmail, code }); }}>
          <div role="status" className="rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] p-3 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline text-foreground" size={17} />If <strong className="break-all">{submittedEmail}</strong> is saved on an active account, a code has been sent there. It expires in 10 minutes.</div>
          <label className="block text-sm font-bold text-foreground" htmlFor="staff-email-code">Six-digit code</label>
          <input id="staff-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className={`${inputClass} text-center text-xl font-bold tracking-[0.35em]`} />
          {verifyEmailCode.error && <p role="alert" className="text-sm text-red-700">{verifyEmailCode.error.message}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>{verifyEmailCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Access APY HQ</button>
          <button type="button" disabled={busy} onClick={() => changeMethod("email")} className="w-full min-h-11 py-2 text-sm font-semibold text-brand-link underline">Change email or request another code</button>
        </form>}

        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Missing your code? Ask the owner to check your contact details in the Employee Directory. Never use or share someone else&apos;s sign-in code.</p>
        <details className="mt-4 border-t border-border pt-3 text-center text-sm text-foreground">
          <summary className="cursor-pointer font-bold">Owner sign-in only</summary>
          <p className="mt-2 text-xs text-muted-foreground">Staff and Operations Managers should use their own phone or email above.</p>
          <button type="button" onClick={() => { window.location.href = getLoginUrl("/staff"); }} className="mt-2 py-2 font-bold underline">Continue with owner account</button>
        </details>
      </section>
    </main>
  );
}
