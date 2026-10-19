import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { getPuppyMonitorOfferShiftPay } from "@shared/puppyMonitorTerms";
import { getMovementInstructorOfferHourlyPay } from "@shared/movementInstructorTerms";
import { getSocialMediaOfferStartHourlyPay } from "@shared/socialMediaTerms";
import { getOfferLetterContent, getNDAContent } from "@shared/offerDocumentContentV1";
import { downloadSignedOffer } from "@/lib/downloadSignedOffer";

export { getOfferLetterContent } from "@shared/offerDocumentContentV1";

const isSocialMediaOfferType = (type: string) => type === "social_media_intern" || type === "social_media_specialist";

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  title,
  subtitle,
  children,
  checked,
  onChange,
  checkLabel,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  checkLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#F0D0DC] mb-6 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="bg-[#FFF5F8] px-6 py-4 border-b border-[#F0D0DC] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#8B2252]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">📄</span>
        </div>
        <div>
          <p className="font-bold text-[#1A0A12] text-sm">{title}</p>
          <p className="text-xs text-[#C4A0B0]">{subtitle}</p>
        </div>
      </div>

      {/* Document body — scrollable */}
      <div className="px-6 py-5 max-h-80 overflow-y-auto border-b border-[#F0D0DC] bg-[#FEFAF4]">
        {children}
      </div>

      {/* Confirmation checkbox */}
      <div className="px-6 py-4 flex items-center gap-3">
        <input
          type="checkbox"
          id={`check-${title}`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-[#8B2252] cursor-pointer"
        />
        <label htmlFor={`check-${title}`} className="text-sm text-[#3D1A2E] cursor-pointer select-none">
          {checkLabel}
        </label>
      </div>
    </div>
  );
}

// ─── Checkbox Item ────────────────────────────────────────────────────────────

function CheckboxItem({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-[#8B2252] cursor-pointer flex-shrink-0"
      />
      <label htmlFor={id} className="text-sm text-[#3D1A2E] cursor-pointer select-none leading-snug">
        {label}
      </label>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="font-body text-xl font-bold text-[#1A0A12] mb-3">Unable to Load Documents</h2>
        <p className="text-sm text-[#1A0A12] leading-relaxed mb-6">{message}</p>
        <p className="text-xs text-[#C4A0B0]">
          Need help? Contact us at{" "}
          <a href="mailto:afropuppyyoga@gmail.com" className="text-[#8B2252] hover:underline">
            afropuppyyoga@gmail.com
          </a>{" "}
          or call{" "}
          <a href="tel:2897881885" className="text-[#8B2252] hover:underline">
            289-788-1885
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SignDocuments() {
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
  useEffect(() => {
    setHasReadOffer(false);
    setHasReadNDA(false);
  }, [data?.documentSha256]);

  const submitMutation = trpc.signing.submitSignature.useMutation({
    onSuccess: () => { setSubmitted(true); void utils.signing.getSigningRequest.invalidate({ token }); },
    onError: (err) => toast.error(err.message || "Something went wrong. Please try again."),
  });
  const utils = trpc.useUtils();
  const download = trpc.staffDocuments.downloadFromSigningLink.useMutation({
    onSuccess: downloadSignedOffer,
    onError: error => toast.error(error.message),
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
    if (!data?.documentSha256) return;
    submitMutation.mutate({
      token,
      signedName: signedName.trim(),
      confirmedDocumentSha256: data.documentSha256,
      confirmedOfferLetterType: data.offerLetterType,
      ...(data.offerLetterType.startsWith("puppy_monitor_") ? {
        confirmedPuppyMonitorShiftPayCad: getPuppyMonitorOfferShiftPay(data.puppyMonitorShiftPayCad),
      } : {}),
      ...(data.offerLetterType === "movement_instructor" ? {
        confirmedMovementInstructorHourlyPayCad: getMovementInstructorOfferHourlyPay(data.movementInstructorHourlyPayCad),
      } : {}),
      ...(isSocialMediaOfferType(data.offerLetterType) && data.socialMediaHourlyPayCad != null ? {
        confirmedSocialMediaHourlyPayCad: getSocialMediaOfferStartHourlyPay(data.socialMediaHourlyPayCad) ?? undefined,
      } : {}),
    });
  };

  if (!token) {
    return <ErrorState message="No signing token found. Please use the link from your email." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#8B2252] mx-auto mb-4" />
          <p className="text-[#8B2252] font-medium">Loading your documents...</p>
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  // Already signed
  if (data.signed || submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="font-body text-2xl font-bold text-[#1A0A12] mb-3">Documents Signed!</h1>
            <p className="text-[#3D1A2E] text-sm leading-relaxed mb-6">
              Thank you{data.signedName ? `, ${data.signedName}` : ""}! Your Offer Letter and NDA
              have been signed and received by AfroPuppyYoga. We'll be in touch shortly with your
              onboarding details.
            </p>
            <div className="bg-[#FFF5F8] rounded-xl p-4 border border-[#F0D0DC] text-left mb-6">
              <p className="text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">
                Signing Record
              </p>
              <p className="text-xs text-[#1A0A12]">
                Signed as: <strong>{data.signedName}</strong>
              </p>
              {data.signedAt && (
                <p className="text-xs text-[#1A0A12] mt-1">
                  Date:{" "}
                  {new Date(data.signedAt).toLocaleString("en-CA", {
                    timeZone: "America/Toronto",
                  })}
                </p>
              )}
            </div>
            <Button className="mb-3 w-full bg-[#8B2252] text-white hover:bg-[#6F1B42]" disabled={download.isPending}
              onClick={() => download.mutate({ token })}>
              {download.isPending ? "Preparing PDF..." : "Download signed offer and NDA"}
            </Button>
            <a href="/staff/documents" className="mb-4 block text-sm font-semibold text-[#8B2252] hover:underline">My Documents in APY HQ</a>
            <a
              href="https://afropuppyyoga.ca"
              className="text-sm text-[#8B2252] hover:underline font-medium"
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
      <div className="bg-gradient-to-r from-[#8B2252] to-[#8B2252] py-6 px-4 text-center">
        <p className="font-body text-xl font-bold text-white tracking-wide">🐾 AfroPuppyYoga</p>
        <p className="text-xs text-white/70 mt-1 tracking-widest uppercase">
          Document Signing Portal
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Welcome banner */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 mb-8 shadow-sm">
          <h1 className="font-body text-2xl font-bold text-[#1A0A12] mb-2">
            Hi {data.applicantName}! 👋
          </h1>
          <p className="text-[#3D1A2E] text-sm leading-relaxed">
            Please read both documents below carefully, check the boxes to confirm you have read and
            understood each one, then sign at the bottom. This takes about 2 minutes.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#C4A0B0]">
            <span>📋</span>
            <span>
              <strong>{data.role}</strong> — {data.location}
            </span>
          </div>
        </div>

        {/* Document 1: Offer Letter */}
        <DocumentCard
          title="Offer Letter"
          subtitle={`${data.role} — ${data.location}`}
          checked={hasReadOffer}
          onChange={setHasReadOffer}
          checkLabel="I have read and understood the Offer Letter"
        >
          {/* Trusted server template. Dynamic applicant fields are escaped by React server rendering. */}
          <div dangerouslySetInnerHTML={{ __html: data.offerHtml ?? "" }} />
        </DocumentCard>

        {/* Document 2: NDA */}
        <DocumentCard
          title="Non-Disclosure Agreement (NDA)"
          subtitle="Confidentiality Agreement — All Positions"
          checked={hasReadNDA}
          onChange={setHasReadNDA}
          checkLabel="I have read and understood the NDA"
        >
          <div dangerouslySetInnerHTML={{ __html: data.ndaHtml ?? "" }} />
        </DocumentCard>

        {/* Signature form */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#FFF5F8] border border-[#F0D0DC] flex items-center justify-center">
              <PenLine className="w-4 h-4 text-[#8B2252]" />
            </div>
            <div>
              <h2 className="font-body text-lg font-bold text-[#1A0A12]">Digital Signature</h2>
              <p className="text-xs text-[#C4A0B0]">Type your full legal name to sign both documents</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label
                htmlFor="signedName"
                className="text-sm font-semibold text-[#3D1A2E] mb-2 block"
              >
                Full Legal Name <span className="text-[#8B2252]">*</span>
              </Label>
              <Input
                id="signedName"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="border-[#F0D0DC] focus:border-[#8B2252] focus:ring-[#8B2252]/20 text-[#1A0A12] font-body text-lg h-12"
                required
              />
              <p className="text-xs text-[#C4A0B0] mt-1.5">
                By typing your name above, you are providing a legally binding digital signature for
                both documents.
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
            </div>

            <Button
              type="submit"
              disabled={
                submitMutation.isPending ||
                !signedName.trim() ||
                !hasReadOffer ||
                !hasReadNDA
              }
              className="w-full h-12 bg-gradient-to-r from-[#8B2252] to-[#8B2252] hover:from-[#8B2252] hover:to-[#8B2252] text-white font-bold text-base rounded-xl"
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

            <p className="text-xs text-center text-[#C4A0B0]">
              By clicking "Sign & Submit", you agree to the terms of both documents. This action is
              recorded with a timestamp and cannot be undone.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-[#F0D0DC] mt-4">
        <p className="text-xs text-[#C4A0B0]">
          AfroPuppyYoga · Kitchener-Waterloo &amp; Hamilton, Ontario ·{" "}
          <a href="https://afropuppyyoga.ca" className="text-[#8B2252] hover:underline">
            afropuppyyoga.ca
          </a>
        </p>
      </div>
    </div>
  );
}
