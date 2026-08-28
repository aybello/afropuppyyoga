import { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl, LOGO_URL } from "@/const";

export default function StaffAccess() {
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const requestCode = trpc.staff.requestPhoneAccessCode.useMutation({
    onSuccess: () => setCodeSent(true),
  });
  const verifyCode = trpc.staff.verifyPhoneAccessCode.useMutation({
    onSuccess: () => navigate("/staff"),
  });

  return (
    <main className="min-h-screen bg-[#FEFAF4] px-5 py-12 text-[#1E1208]">
      <section className="mx-auto max-w-md rounded-[2rem] border border-[#DFE8DA] bg-white p-6 shadow-[0_20px_55px_rgba(45,90,39,0.12)] sm:p-8">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
        <div className="mt-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C05A35]">APY HQ</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-[#2D5A27]">Secure access</h1>
          <p className="mt-2 text-sm leading-6 text-[#665A36]">Use the owner's configured phone number or the phone number saved on an active APY HQ team profile. We will text a one-time verification code.</p>
        </div>

        {!codeSent ? (
          <div className="mt-7 space-y-4">
            <label className="block text-sm font-bold text-[#2D3527]" htmlFor="staff-phone">Mobile number</label>
            <input id="staff-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(289) 788-1885" className="w-full rounded-xl border border-[#C9D8C2] px-4 py-3 text-base outline-none ring-[#F4A800] focus:ring-2" />
            {requestCode.error && <p className="text-sm text-red-700">{requestCode.error.message}</p>}
            <button onClick={() => requestCode.mutate({ phone })} disabled={requestCode.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D5A27] px-4 py-3 font-bold text-white transition-colors hover:bg-[#173B1A] disabled:opacity-60">
              {requestCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareText size={18} />} Send verification code
            </button>
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            <div className="rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] p-3 text-sm text-[#665A36]"><ShieldCheck className="mr-2 inline text-[#2D5A27]" size={17} />Code sent to your APY HQ mobile number. It expires in 10 minutes.</div>
            <label className="block text-sm font-bold text-[#2D3527]" htmlFor="staff-code">Six-digit code</label>
            <input id="staff-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-full rounded-xl border border-[#C9D8C2] px-4 py-3 text-center text-xl font-bold tracking-[0.35em] outline-none ring-[#F4A800] focus:ring-2" />
            {verifyCode.error && <p className="text-sm text-red-700">{verifyCode.error.message}</p>}
            <button onClick={() => verifyCode.mutate({ phone, code })} disabled={verifyCode.isPending || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D5A27] px-4 py-3 font-bold text-white transition-colors hover:bg-[#173B1A] disabled:opacity-60">
              {verifyCode.isPending ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Access APY HQ
            </button>
            <button onClick={() => setCodeSent(false)} className="w-full text-sm font-bold text-[#2D5A27] underline">Use a different number</button>
          </div>
        )}

        <div className="mt-7 border-t border-[#E7EEE2] pt-5 text-center">
          <p className="text-xs leading-5 text-[#8B8978]">Have an email invite? Open the APY HQ access link in that email. Need help? Contact your Operations Manager.</p>
          <button onClick={() => { window.location.href = getLoginUrl(); }} className="mt-4 text-sm font-bold text-[#2D5A27] underline">Use Manus owner backup</button>
        </div>
      </section>
    </main>
  );
}
