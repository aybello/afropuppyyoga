import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, AlertCircle, PenLine } from "lucide-react";

export default function SignDocuments() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [signedName, setSignedName] = useState("");
  const [hasReadOffer, setHasReadOffer] = useState(false);
  const [hasReadNDA, setHasReadNDA] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = trpc.signing.getSigningRequest.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const submitMutation = trpc.signing.submitSignature.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedName.trim()) {
      toast.error("Please enter your full name to sign.");
      return;
    }
    if (!hasReadOffer || !hasReadNDA) {
      toast.error("Please confirm you have read both documents before signing.");
      return;
    }
    submitMutation.mutate({ token, signedName: signedName.trim() });
  };

  if (!token) {
    return <ErrorState message="No signing token found. Please use the link from your email." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#C2185B] mx-auto mb-4" />
          <p className="text-[#8B2252] font-medium">Loading your documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!data) return null;

  if (data.signed || submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="font-serif text-2xl font-bold text-[#1A0A12] mb-3">
              Documents Signed!
            </h1>
            <p className="text-[#3D1A2A] text-sm leading-relaxed mb-6">
              Thank you{data.signedName ? `, ${data.signedName}` : ""}! Your Offer Letter and NDA have been signed and received by AfroPuppyYoga. We'll be in touch shortly with your onboarding details.
            </p>
            <div className="bg-[#FFF5F8] rounded-xl p-4 border border-[#F0D0DC] text-left mb-6">
              <p className="text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">Signing Record</p>
              <p className="text-xs text-[#6B4C3B]">
                Signed as: <strong>{data.signedName}</strong>
              </p>
              {data.signedAt && (
                <p className="text-xs text-[#6B4C3B] mt-1">
                  Date: {new Date(data.signedAt).toLocaleString("en-CA", { timeZone: "America/Toronto" })}
                </p>
              )}
            </div>
            <a
              href="https://afropuppyyoga.ca"
              className="text-sm text-[#C2185B] hover:underline font-medium"
            >
              Visit afropuppyyoga.ca
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#C2185B] to-[#8B2252] py-6 px-4 text-center">
        <p className="font-serif text-xl font-bold text-white tracking-wide">🐾 AfroPuppyYoga</p>
        <p className="text-xs text-white/70 mt-1 tracking-widest uppercase">Document Signing Portal</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Welcome banner */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 mb-8 shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-[#1A0A12] mb-2">
            Hi {data.applicantName}! 👋
          </h1>
          <p className="text-[#3D1A2A] text-sm leading-relaxed">
            Please review both documents below and sign at the bottom to confirm your{" "}
            <strong>{data.role}</strong> position at our <strong>{data.location}</strong> location.
            This only takes a few minutes.
          </p>
        </div>

        {/* Document 1: Offer Letter */}
        <DocumentCard
          title="Offer Letter"
          subtitle={`${data.role} — ${data.location}`}
          url={data.offerLetterUrl}
          checked={hasReadOffer}
          onCheck={() => setHasReadOffer(true)}
          checkLabel="I have read and understood the Offer Letter"
        />

        {/* Document 2: NDA */}
        <DocumentCard
          title="Non-Disclosure Agreement (NDA)"
          subtitle="Confidentiality Agreement — All Positions"
          url={data.ndaUrl}
          checked={hasReadNDA}
          onCheck={() => setHasReadNDA(true)}
          checkLabel="I have read and understood the NDA"
        />

        {/* Signature form */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#FFF5F8] border border-[#F0D0DC] flex items-center justify-center">
              <PenLine className="w-4 h-4 text-[#C2185B]" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#1A0A12]">Digital Signature</h2>
              <p className="text-xs text-[#9E7B8A]">Type your full legal name to sign</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="signedName" className="text-sm font-semibold text-[#3D1A2A] mb-2 block">
                Full Legal Name <span className="text-[#C2185B]">*</span>
              </Label>
              <Input
                id="signedName"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="border-[#F0D0DC] focus:border-[#C2185B] focus:ring-[#C2185B]/20 text-[#1A0A12] font-serif text-lg h-12"
                required
              />
              <p className="text-xs text-[#9E7B8A] mt-1.5">
                By typing your name above, you are providing a legally binding digital signature.
              </p>
            </div>

            {/* Confirmation checkboxes */}
            <div className="space-y-3 bg-[#FFF5F8] rounded-xl p-4 border border-[#F0D0DC]">
              <CheckboxItem
                id="confirmOffer"
                checked={hasReadOffer}
                onChange={setHasReadOffer}
                label="I have read and agree to the terms of the Offer Letter"
              />
              <CheckboxItem
                id="confirmNDA"
                checked={hasReadNDA}
                onChange={setHasReadNDA}
                label="I have read and agree to the terms of the Non-Disclosure Agreement"
              />
              <CheckboxItem
                id="confirmAge"
                checked={false}
                onChange={() => {}}
                label="I confirm I am 18 years of age or older"
                standalone
              />
            </div>

            <Button
              type="submit"
              disabled={submitMutation.isPending || !signedName.trim() || !hasReadOffer || !hasReadNDA}
              className="w-full h-12 bg-gradient-to-r from-[#C2185B] to-[#8B2252] hover:from-[#AD1457] hover:to-[#7B1D47] text-white font-bold text-base rounded-xl"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "✍️ Sign & Submit Documents"
              )}
            </Button>

            <p className="text-xs text-center text-[#9E7B8A]">
              By clicking "Sign & Submit", you agree to the terms of both documents. This action is recorded with a timestamp and cannot be undone.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-[#F0D0DC] mt-4">
        <p className="text-xs text-[#9E7B8A]">
          AfroPuppyYoga · Kitchener-Waterloo &amp; Hamilton, Ontario ·{" "}
          <a href="https://afropuppyyoga.ca" className="text-[#C2185B] hover:underline">
            afropuppyyoga.ca
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocumentCard({
  title,
  subtitle,
  url,
  checked,
  onCheck,
  checkLabel,
}: {
  title: string;
  subtitle: string;
  url: string;
  checked: boolean;
  onCheck: () => void;
  checkLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#FFF5F8] border border-[#F0D0DC] flex items-center justify-center">
          <FileText className="w-4 h-4 text-[#C2185B]" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-bold text-[#1A0A12]">{title}</h2>
          <p className="text-xs text-[#9E7B8A]">{subtitle}</p>
        </div>
        {checked && (
          <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
        )}
      </div>

      {/* PDF viewer */}
      <div className="rounded-xl overflow-hidden border border-[#F0D0DC] mb-4" style={{ height: "500px" }}>
        <iframe
          src={`${url}#toolbar=1&navpanes=0`}
          className="w-full h-full"
          title={title}
        />
      </div>

      <div className="flex items-center gap-3 bg-[#FFF5F8] rounded-xl p-3 border border-[#F0D0DC]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#C2185B] hover:underline font-medium flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          Open in new tab
        </a>
        <div className="flex-1" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => { if (e.target.checked) onCheck(); }}
            className="w-4 h-4 accent-[#C2185B]"
          />
          <span className="text-xs text-[#3D1A2A] font-medium">{checkLabel}</span>
        </label>
      </div>
    </div>
  );
}

function CheckboxItem({
  id,
  checked,
  onChange,
  label,
  standalone,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  standalone?: boolean;
}) {
  const [localChecked, setLocalChecked] = useState(false);
  const isChecked = standalone ? localChecked : checked;

  return (
    <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          if (standalone) setLocalChecked(e.target.checked);
          else onChange(e.target.checked);
        }}
        className="w-4 h-4 mt-0.5 accent-[#C2185B]"
      />
      <span className="text-xs text-[#3D1A2A] leading-relaxed">{label}</span>
    </label>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-5" />
          <h1 className="font-serif text-xl font-bold text-[#1A0A12] mb-3">
            Link Not Valid
          </h1>
          <p className="text-[#3D1A2A] text-sm leading-relaxed mb-6">{message}</p>
          <p className="text-xs text-[#9E7B8A]">
            Need help? Contact us at{" "}
            <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#C2185B] hover:underline">
              afropuppyyogaofficial@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
