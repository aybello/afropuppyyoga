/**
 * Public page: Breeder submits their availability after clicking the email link.
 * URL: /breeder-availability?token=<unique_token>
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, Heart } from "lucide-react";

const APY_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

export default function BreederAvailability() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [availabilityText, setAvailabilityText] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");

  const { data: tokenData, isLoading: tokenLoading, error: tokenError } = trpc.breeders.getAvailabilityToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const submitMutation = trpc.breeders.submitAvailability.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setSubmittedName(data.breederName);
    },
  });

  if (!token) {
    return <ErrorPage message="Invalid link. Please use the link from your email." />;
  }

  if (tokenLoading) {
    return (
      <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C2185B]" />
      </div>
    );
  }

  if (tokenError || !tokenData) {
    return <ErrorPage message="This link is invalid or has expired. Please contact us at afropuppyyogaofficial@gmail.com." />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <img src={APY_LOGO} alt="AfroPuppyYoga" className="w-14 h-14 rounded-full mx-auto mb-4 object-contain" />
          <h1 className="font-display text-2xl text-[#1A0A12] mb-3">Thank You, {submittedName.split(" ")[0]}!</h1>
          <p className="font-body text-[#6B4C3B] leading-relaxed">
            We have received your availability for <strong>{tokenData.monthLabel}</strong>. Our team will be in touch soon to confirm dates.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[#C2185B]">
            <Heart className="w-4 h-4 fill-current" />
            <span className="font-body text-sm">The AfroPuppyYoga Team</span>
          </div>
        </div>
      </div>
    );
  }

  // Already responded
  if (tokenData.responded === 1) {
    return (
      <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-blue-600" />
          </div>
          <img src={APY_LOGO} alt="AfroPuppyYoga" className="w-14 h-14 rounded-full mx-auto mb-4 object-contain" />
          <h1 className="font-display text-2xl text-[#1A0A12] mb-3">Already Submitted</h1>
          <p className="font-body text-[#6B4C3B] leading-relaxed">
            We already received your availability for <strong>{tokenData.monthLabel}</strong>. If you need to make changes, please email us at <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#C2185B] underline">afropuppyyogaofficial@gmail.com</a>.
          </p>
        </div>
      </div>
    );
  }

  const firstName = tokenData.breederName.split(" ")[0];

  return (
    <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#C2185B] to-[#8B2252] px-8 py-8 text-center">
          <img src={APY_LOGO} alt="AfroPuppyYoga" className="w-14 h-14 rounded-full mx-auto mb-3 object-contain" />
          <h1 className="font-display text-white text-xl font-bold">Availability Check</h1>
          <p className="text-white/80 text-sm mt-1">{tokenData.monthLabel}</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          <p className="font-body text-[#1A0A12] text-base mb-1">Hi {firstName},</p>
          <p className="font-body text-[#6B4C3B] text-sm leading-relaxed mb-6">
            We are planning our AfroPuppyYoga classes for <strong>{tokenData.monthLabel}</strong> and would love to know when you and your puppies are available!
          </p>

          <div className="space-y-5">
            <div>
              <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">
                Your Availability *
              </Label>
              <Textarea
                value={availabilityText}
                onChange={(e) => setAvailabilityText(e.target.value)}
                placeholder={`e.g. July 5 (morning), July 12 (any time), July 19 (afternoon only)`}
                className="mt-2 border-[#F0D0DC] font-body text-sm min-h-[100px] focus:ring-[#C2185B]/30"
                rows={4}
              />
              <p className="text-xs text-[#8B6070] mt-1 font-body">List the dates and times that work best for you.</p>
            </div>

            <div>
              <Label className="font-body text-xs text-[#6B4C3B] font-semibold uppercase tracking-wider">
                Additional Notes (optional)
              </Label>
              <Textarea
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="e.g. Puppy count available, breed, any scheduling constraints..."
                className="mt-2 border-[#F0D0DC] font-body text-sm min-h-[80px]"
                rows={3}
              />
            </div>

            {submitMutation.error && (
              <div className="flex items-center gap-2 text-red-600 text-sm font-body bg-red-50 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitMutation.error.message}
              </div>
            )}

            <Button
              onClick={() => submitMutation.mutate({ token, availabilityText, responseNotes: responseNotes || undefined })}
              disabled={!availabilityText.trim() || submitMutation.isPending}
              className="w-full bg-[#C2185B] hover:bg-[#8B2252] text-white font-body rounded-full py-3 text-base"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
              ) : (
                "Submit My Availability"
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-[#8B6070] font-body mt-6">
            Questions? Email us at{" "}
            <a href="mailto:afropuppyyogaofficial@gmail.com" className="text-[#C2185B] underline">
              afropuppyyogaofficial@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <img src={APY_LOGO} alt="AfroPuppyYoga" className="w-14 h-14 rounded-full mx-auto mb-4 object-contain" />
        <h1 className="font-display text-xl text-[#1A0A12] mb-3">Link Error</h1>
        <p className="font-body text-[#6B4C3B] leading-relaxed text-sm">{message}</p>
      </div>
    </div>
  );
}
