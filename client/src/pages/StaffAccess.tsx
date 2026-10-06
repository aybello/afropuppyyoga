import { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Loader2, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
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
  const [emailSent, setEmailSent] = useState(false);

  const requestCode = trpc.staff.requestPhoneAccessCode.useMutation({
    onSuccess: (_data, input) => { setSubmittedPhone(input.phone.trim()); setCode(""); setCodeSent(true); },
  });
  const requestEmail = trpc.staff.requestEmailAccessLink.useMutation({
    onSuccess: (_data, input) => { setSubmittedEmail(input.email.trim().toLowerCase()); setEmailSent(true); },
  });
  const verifyCode = trpc.staff.verifyPhoneAccessCode.useMutation({
    onSuccess: () => navigate(getSafeApyHqReturnPath(window.location.search)),
  });
  const busy = requestCode.isPending || requestEmail.isPending || verifyCode.isPending;
  const inputClass = "w-full rounded-xl border border-[#C9D8C2] px-4 py-3 text-base outline-none ring-[#F4A800] focus:ring-2";
  const buttonClass = "flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D5A27] px-4 py-3 font-bold text-white transition-colors hover:bg-[#173B1A] disabled:opacity-60";
  function changeMethod(next: "phone" | "email") {
    if (busy) return;
    setMethod(next); setCodeSent(false); setEmailSent(false); setCode("");
    requestCode.reset(); requestEmail.reset(); verifyCode.reset();
  }

  return (
    <main className="min-h-screen bg-[#FEFAF4] px-5 py-6 text-[#1E1208] sm:py-8">
      <section className="mx-auto max-w-md rounded-[2rem] border border-[#DFE8DA] bg-white p-6 shadow-[0_20px_55px_rgba(45,90,39,0.12)] sm:p-8">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="mx-auto h-12 w-12 rounded-2xl object-cover" />
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C05A35]">APY HQ</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-[#2D5A27]">Staff sign-in</h1>
          <p className="mt-2 text-sm leading-6 text-[#665A36]">Use your own phone or email saved in the Employee Directory. Managers use their own staff account, not the owner's.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Sign-in method">
          {(["phone", "email"] as const).map((value) => <button key={value} type="button" aria-pressed={method === value} disabled={busy} onClick={() => changeMethod(value)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-[#F4A800] ${method === value ? "border-[#2D5A27] bg-[#EDF3E9] text-[#2D5A27]" : "border-[#DFE8DA] text-[#665A36]"}`}>{value === "phone" ? "Text me a code" : "Email me a link"}</button>)}
        </div>

        {method === "phone" && !codeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy) requestCode.mutate({ phone }); }}>
          <label className="block text-sm font-bold text-[#2D3527]" htmlFor="staff-phone">Your mobile number</label>
          <input id="staff-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Enter your own mobile number" className={inputClass} />
          {requestCode.error && <p role="alert" className="text-sm text-red-700">{requestCode.error.message}</p>}
          <button type="submit" disabled={busy || !phone.trim()} className={buttonClass}>{requestCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareText size={18} />} Send verification code</button>
        </form>}

        {method === "phone" && codeSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy && code.length === 6) verifyCode.mutate({ phone: submittedPhone, code }); }}>
          <div role="status" className="rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] p-3 text-sm text-[#665A36]"><ShieldCheck className="mr-2 inline text-[#2D5A27]" size={17} />If <strong className="break-all">{submittedPhone}</strong> is saved on an active account, a code has been sent to that number. It expires in 10 minutes.</div>
          <label className="block text-sm font-bold text-[#2D3527]" htmlFor="staff-code">Six-digit code</label>
          <input id="staff-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className={`${inputClass} text-center text-xl font-bold tracking-[0.35em]`} />
          {verifyCode.error && <p role="alert" className="text-sm text-red-700">{verifyCode.error.message}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>{verifyCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Access APY HQ</button>
          <button type="button" disabled={busy} onClick={() => changeMethod("phone")} className="w-full py-2 text-sm font-bold text-[#2D5A27] underline">Change number or request another code</button>
        </form>}

        {method === "email" && !emailSent && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy) requestEmail.mutate({ email, origin: window.location.origin }); }}>
          <label className="block text-sm font-bold text-[#2D3527]" htmlFor="staff-email">Your staff email</label>
          <input id="staff-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your own email address" className={inputClass} />
          {requestEmail.error && <p role="alert" className="text-sm text-red-700">{requestEmail.error.message}</p>}
          <button type="submit" disabled={busy || !email.trim()} className={buttonClass}>{requestEmail.isPending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} Send sign-in link</button>
        </form>}

        {method === "email" && emailSent && <div className="mt-5 space-y-3">
          <p role="status" className="rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] p-3 text-sm text-[#665A36]">If <strong className="break-all">{submittedEmail}</strong> is saved on an active staff account, a sign-in link has been sent there. Check your inbox and spam folder. It expires in 15 minutes.</p>
          <button type="button" onClick={() => changeMethod("email")} className="w-full py-2 text-sm font-bold text-[#2D5A27] underline">Change email or request another link</button>
        </div>}

        <p className="mt-4 text-center text-xs leading-5 text-[#8B8978]">Missing your code or link? Ask the owner to check your contact details in the Employee Directory. Never use or share someone else's sign-in code.</p>
        <details className="mt-4 border-t border-[#E7EEE2] pt-3 text-center text-sm text-[#2D5A27]">
          <summary className="cursor-pointer font-bold">Owner sign-in only</summary>
          <p className="mt-2 text-xs text-[#665A36]">Staff and Operations Managers should use their own phone or email above.</p>
          <button type="button" onClick={() => { window.location.href = getLoginUrl("/staff"); }} className="mt-2 py-2 font-bold underline">Continue with owner account</button>
        </details>
      </section>
    </main>
  );
}
