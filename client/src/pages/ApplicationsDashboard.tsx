/* ============================================================
   Applications Dashboard — APY Admin Portal
   Design: Warm Afro-Wellness Editorial (matches main site)
   Features: View applications, update status, send interview invite,
             offer letter, and rejection letter via automated email.
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Users, Loader2, Video, Mail, Phone, Star, Eye, XCircle, Inbox,
  Calendar, CheckCircle, Send, Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import AdminNav from "@/components/AdminNav";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";

type AppStatus = "new" | "reviewed" | "shortlisted" | "interview_scheduled" | "accepted" | "rejected";

type Application = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  location: string;
  whyAPY: string | null;
  experience: string | null;
  videoUrl: string | null;
  status: string;
  createdAt: Date;
  signingStatus: string | null;
  signedName: string | null;
  signedAt: Date | null;
};

function StatusBadge({ status }: { status: AppStatus }) {
  const styles: Record<AppStatus, string> = {
    new: "bg-blue-100 text-blue-700",
    reviewed: "bg-yellow-100 text-yellow-700",
    shortlisted: "bg-emerald-100 text-emerald-700",
    interview_scheduled: "bg-purple-100 text-purple-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };
  const icons: Record<AppStatus, React.ReactNode> = {
    new: <Inbox className="w-3 h-3" />,
    reviewed: <Eye className="w-3 h-3" />,
    shortlisted: <Star className="w-3 h-3" />,
    interview_scheduled: <Calendar className="w-3 h-3" />,
    accepted: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  const labels: Record<AppStatus, string> = {
    new: "New",
    reviewed: "Reviewed",
    shortlisted: "Shortlisted",
    interview_scheduled: "Interview Scheduled",
    accepted: "Accepted",
    rejected: "Rejected",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold ${styles[status]}`}>
      {icons[status]} {labels[status]}
    </span>
  );
}

// ─── Interview Invite Modal ──────────────────────────────────────────────────
const DEFAULT_BOOKING_LINK = "https://calendar.app.google/RdiW9wP2XYVK27g2A";

function InterviewInviteModal({
  app,
  open,
  onClose,
}: {
  app: Application;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [bookingLink, setBookingLink] = useState(DEFAULT_BOOKING_LINK);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const sendInvite = trpc.careers.sendInterviewInvite.useMutation({
    onSuccess: () => {
      toast.success(`Interview invite sent to ${app.email}!`);
      utils.careers.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(`Failed to send invite: ${err.message}`);
    },
  });

  const handleSubmit = () => {
    if (!bookingLink.trim()) {
      toast.error("Please provide a booking link");
      return;
    }
    sendInvite.mutate({
      id: app.id,
      applicantName: app.name,
      applicantEmail: app.email,
      role: app.role,
      location: app.location,
      bookingLink: bookingLink.trim(),
      additionalNotes: additionalNotes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#FEFAF4] border-[#F0D0DC]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1A0A12]">
            📅 Send Interview Invite
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-[#6B4C3B]">
            Sending to <strong>{app.name}</strong> ({app.email}) for <strong>{app.role}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-[#FFF5F8] border border-[#F0D0DC] rounded-xl p-4">
            <p className="font-body text-sm text-[#3D1A2A] leading-relaxed">
              The applicant will receive an email with a button to book their interview at their convenience.
            </p>
          </div>

          <div>
            <Label className="font-body text-sm text-[#1A0A12] mb-1 block">Booking Link *</Label>
            <Input
              placeholder="https://calendar.app.google/..."
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
              className="border-[#F0D0DC] font-body"
            />
            <p className="font-body text-xs text-[#C4A0B0] mt-1">Pre-filled with your Google Calendar link</p>
          </div>

          <div>
            <Label className="font-body text-sm text-[#1A0A12] mb-1 block">Additional Notes (optional)</Label>
            <Textarea
              placeholder="Any additional info for the applicant..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="border-[#F0D0DC] font-body resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-body border-[#F0D0DC]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={sendInvite.isPending}
            className="font-body text-white"
            style={{ background: "linear-gradient(135deg, #C2185B, #8B2252)" }}
          >
            {sendInvite.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send Invite</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Signing Link Modal ─────────────────────────────────────────────────
function OfferLetterModal({
  app,
  open,
  onClose,
}: {
  app: Application;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [sent, setSent] = useState(false);
  const [signingLink, setSigningLink] = useState("");

  const sendSigningLink = trpc.signing.createSigningRequest.useMutation({
    onSuccess: (data) => {
      setSent(true);
      setSigningLink(data.signingLink);
      utils.careers.list.invalidate();
      toast.success(`Signing link sent to ${app.email}! 🎉`);
    },
    onError: (err) => {
      toast.error(`Failed to send signing link: ${err.message}`);
    },
  });

  const handleSend = () => {
    sendSigningLink.mutate({
      applicationId: app.id,
      applicantName: app.name,
      applicantEmail: app.email,
      role: app.role,
      location: app.location,
      origin: window.location.origin,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#FEFAF4] border-[#F0D0DC]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1A0A12]">
            ✍️ Send Offer for Signing
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-[#6B4C3B]">
            Sending to <strong>{app.name}</strong> ({app.email}) for <strong>{app.role}</strong> — {app.location}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!sent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="font-body text-sm text-green-800 font-semibold">What happens when you click Send:</p>
              <ul className="font-body text-sm text-green-700 space-y-1 list-disc list-inside">
                <li>A branded email is sent to the applicant with a secure signing link</li>
                <li>They view their role-specific Offer Letter + NDA in the browser</li>
                <li>They type their name as a digital signature and submit</li>
                <li>You get notified instantly when they sign</li>
                <li>The link is valid for 7 days</li>
              </ul>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="font-body text-sm text-green-800 font-semibold">✅ Signing link sent!</p>
              <p className="font-body text-xs text-green-700">You can also share this link directly:</p>
              <div className="bg-white rounded-lg border border-green-200 p-2">
                <a href={signingLink} target="_blank" rel="noopener noreferrer" className="font-body text-xs text-[#C2185B] break-all hover:underline">
                  {signingLink}
                </a>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-body border-[#F0D0DC]">
            {sent ? "Close" : "Cancel"}
          </Button>
          {!sent && (
            <Button
              onClick={handleSend}
              disabled={sendSigningLink.isPending}
              className="font-body text-white bg-green-600 hover:bg-green-700"
            >
              {sendSigningLink.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Signing Link</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rejection Letter Modal ──────────────────────────────────────────────────
function RejectionLetterModal({
  app,
  open,
  onClose,
}: {
  app: Application;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [additionalNotes, setAdditionalNotes] = useState("");

  const sendRejection = trpc.careers.sendRejectionLetter.useMutation({
    onSuccess: () => {
      toast.success(`Rejection letter sent to ${app.email}`);
      utils.careers.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(`Failed to send rejection: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#FEFAF4] border-[#F0D0DC]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1A0A12]">
            Send Rejection Letter
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-[#6B4C3B]">
            Sending to <strong>{app.name}</strong> ({app.email}) for <strong>{app.role}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="font-body text-sm text-orange-700">
              This will send a warm, respectful rejection letter to the applicant and update their status to <strong>Rejected</strong>.
            </p>
          </div>

          <div>
            <Label className="font-body text-sm text-[#1A0A12] mb-1 block">Additional Notes (optional)</Label>
            <Textarea
              placeholder="Any personalized feedback or encouragement to include..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="border-[#F0D0DC] font-body resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="font-body border-[#F0D0DC]">
            Cancel
          </Button>
          <Button
            onClick={() =>
              sendRejection.mutate({
                id: app.id,
                applicantName: app.name,
                applicantEmail: app.email,
                role: app.role,
                location: app.location,
                additionalNotes: additionalNotes || undefined,
              })
            }
            disabled={sendRejection.isPending}
            variant="destructive"
            className="font-body"
          >
            {sendRejection.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
            ) : (
              <><XCircle className="w-4 h-4 mr-2" /> Send Rejection</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Application Detail Modal ────────────────────────────────────────────────
function ApplicationDetailModal({
  app,
  open,
  onClose,
}: {
  app: Application;
  open: boolean;
  onClose: () => void;
}) {
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl bg-[#FEFAF4] border-[#F0D0DC] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#1A0A12]">{app.name}</DialogTitle>
            <DialogDescription className="font-body text-sm text-[#6B4C3B]">
              {app.role} · {app.location} · Applied {new Date(app.createdAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-1">Email</p>
                <a href={`mailto:${app.email}`} className="font-body text-sm text-[#1A0A12] hover:text-[#C2185B]">{app.email}</a>
              </div>
              {app.phone && (
                <div>
                  <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-1">Phone</p>
                  <a href={`tel:${app.phone}`} className="font-body text-sm text-[#1A0A12] hover:text-[#C2185B]">{app.phone}</a>
                </div>
              )}
            </div>

            {/* Why APY */}
            {app.whyAPY && (
              <div>
                <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">Why AfroPuppyYoga?</p>
                <p className="font-body text-sm text-[#3D1A2A] leading-relaxed bg-white rounded-xl p-4 border border-[#F0D0DC]">{app.whyAPY}</p>
              </div>
            )}

            {/* Experience */}
            {app.experience && (
              <div>
                <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">Experience</p>
                <p className="font-body text-sm text-[#3D1A2A] leading-relaxed bg-white rounded-xl p-4 border border-[#F0D0DC]">{app.experience}</p>
              </div>
            )}

            {/* Video */}
            {app.videoUrl && (
              <div>
                <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">Video Application</p>
                <a
                  href={app.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF0F4] border border-[#F0D0DC] rounded-xl font-body text-sm font-semibold text-[#8B2252] hover:bg-[#F9E4EE] transition-colors"
                >
                  <Video className="w-4 h-4" /> Watch Video Application
                </a>
              </div>
            )}

            {/* Current Status */}
            <div>
              <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">Current Status</p>
              <StatusBadge status={app.status as AppStatus} />
            </div>

            {/* Action Buttons */}
            <div>
              <p className="font-body text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-3">Pipeline Actions</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => { onClose(); setShowInterviewModal(true); }}
                  className="font-body text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}
                >
                  <Calendar className="w-4 h-4 mr-2" /> Invite to Interview
                </Button>
                <Button
                  onClick={() => { onClose(); setShowOfferModal(true); }}
                  className="font-body text-sm text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Send Offer Letter
                </Button>
                <Button
                  onClick={() => { onClose(); setShowRejectionModal(true); }}
                  variant="outline"
                  className="font-body text-sm border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Send Rejection
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showInterviewModal && (
        <InterviewInviteModal app={app} open={showInterviewModal} onClose={() => setShowInterviewModal(false)} />
      )}
      {showOfferModal && (
        <OfferLetterModal app={app} open={showOfferModal} onClose={() => setShowOfferModal(false)} />
      )}
      {showRejectionModal && (
        <RejectionLetterModal app={app} open={showRejectionModal} onClose={() => setShowRejectionModal(false)} />
      )}
    </>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function ApplicationsDashboard() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  const { data: applications, isLoading } = trpc.careers.list.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const updateStatus = trpc.careers.updateStatus.useMutation({
    onSuccess: () => utils.careers.list.invalidate(),
    onError: (err) => toast.error(`Error updating status: ${err.message}`),
  });

  const deleteApplication = trpc.careers.deleteApplication.useMutation({
    onSuccess: () => {
      toast.success("Application deleted");
      utils.careers.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Admin Access Required</h2>
        <p className="font-body text-[#6B4C3B] mb-6">Please log in to view applications.</p>
        <button
          onClick={() => window.location.href = getLoginUrl()}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
        <p className="font-body text-[#6B4C3B]">This page is for admins only.</p>
      </div>
    );
  }

  const newCount = applications?.filter((a) => a.status === "new").length ?? 0;
  const shortlistedCount = applications?.filter((a) => a.status === "shortlisted").length ?? 0;
  const interviewCount = applications?.filter((a) => a.status === "interview_scheduled").length ?? 0;
  const totalCount = applications?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="h-px w-6 bg-[#8B2252]" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Admin</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Job Applications</h1>
          <p className="font-body text-sm text-[#6B4C3B] mt-1">Review and manage applicants for all open positions</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#F0D0DC]">
            <p className="font-body text-xs text-[#6B4C3B] mb-1">Total</p>
            <p className="font-display font-bold text-3xl text-[#1A0A12]">{totalCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-blue-200">
            <p className="font-body text-xs text-blue-500 mb-1">New</p>
            <p className="font-display font-bold text-3xl text-blue-600">{newCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-purple-200">
            <p className="font-body text-xs text-purple-500 mb-1">Interviews</p>
            <p className="font-display font-bold text-3xl text-purple-600">{interviewCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-emerald-200">
            <p className="font-body text-xs text-emerald-600 mb-1">Shortlisted</p>
            <p className="font-display font-bold text-3xl text-emerald-600">{shortlistedCount}</p>
          </div>
        </div>



        {/* Applications table */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
            </div>
          ) : !applications || applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF0F4] flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#1A0A12] mb-2">No applications yet</h3>
              <p className="font-body text-[#6B4C3B] text-sm">
                Applications submitted through the careers page will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Applicant</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Role</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Contact</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Video</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Signing</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Applied</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Status</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, idx) => (
                    <tr
                      key={app.id}
                      className={`border-b border-[#F0D0DC] last:border-0 transition-colors hover:bg-[#FFF5F8] ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                    >
                      {/* Applicant */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedApp(app as Application)}
                          className="text-left hover:text-[#C2185B] transition-colors"
                        >
                          <p className="font-body font-semibold text-sm text-[#1A0A12]">{app.name}</p>
                          {app.whyAPY && (
                            <p className="font-body text-xs text-[#6B4C3B] mt-0.5 max-w-[180px] truncate" title={app.whyAPY}>
                              {app.whyAPY}
                            </p>
                          )}
                        </button>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <p className="font-body text-sm text-[#6B4C3B]">{app.role}</p>
                        <p className="font-body text-xs text-[#C4A0B0]">{app.location}</p>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <a
                            href={`mailto:${app.email}`}
                            className="flex items-center gap-1.5 font-body text-xs text-[#8B2252] hover:underline"
                          >
                            <Mail className="w-3 h-3 shrink-0" />
                            {app.email}
                          </a>
                          {app.phone && (
                            <a
                              href={`tel:${app.phone}`}
                              className="flex items-center gap-1.5 font-body text-xs text-[#6B4C3B] hover:underline"
                            >
                              <Phone className="w-3 h-3 shrink-0" />
                              {app.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Video */}
                      <td className="px-5 py-4">
                        {app.videoUrl ? (
                          <a
                            href={app.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF0F4] border border-[#F0D0DC] rounded-lg font-body text-xs font-semibold text-[#8B2252] hover:bg-[#F9E4EE] transition-colors"
                          >
                            <Video className="w-3 h-3" />
                            Watch
                          </a>
                        ) : (
                          <span className="font-body text-xs text-[#C4A0B0] italic">No video</span>
                        )}
                      </td>

                      {/* Signing status */}
                      <td className="px-5 py-4">
                        {app.signingStatus === "signed" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-body font-semibold bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" /> Signed
                          </span>
                        ) : app.signingStatus === "pending_signature" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-body font-semibold bg-yellow-100 text-yellow-700">
                            <Send className="w-3 h-3" /> Awaiting
                          </span>
                        ) : (
                          <span className="font-body text-xs text-[#C4A0B0] italic">—</span>
                        )}
                      </td>
                      {/* Applied date */}
                      <td className="px-5 py-4 font-body text-xs text-[#6B4C3B]">
                        {new Date(app.createdAt).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <Select
                          value={app.status}
                          onValueChange={(val) =>
                            updateStatus.mutate({ id: app.id, status: val as AppStatus })
                          }
                        >
                          <SelectTrigger className="w-44 h-8 text-xs font-body border-[#F0D0DC] bg-white">
                            <SelectValue>
                              <StatusBadge status={app.status as AppStatus} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted</SelectItem>
                            <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedApp(app as Application)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFF0F4] border border-[#F0D0DC] rounded-lg font-body text-xs font-semibold text-[#8B2252] hover:bg-[#F9E4EE] transition-colors"
                            title="View full application"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          <button
                            onClick={() => { setSelectedApp(app as Application); setShowInterviewModal(true); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg font-body text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                            title="Send interview invite"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setSelectedApp(app as Application); setShowOfferModal(true); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg font-body text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                            title="Send offer letter"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setSelectedApp(app as Application); setShowRejectionModal(true); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg font-body text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            title="Send rejection letter"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(app.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-body text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-red-600 hover:border-red-200 transition-colors"
                            title="Delete application"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedApp && !showInterviewModal && !showOfferModal && !showRejectionModal && (
        <ApplicationDetailModal
          app={selectedApp}
          open={!!selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
      {selectedApp && showInterviewModal && (
        <InterviewInviteModal
          app={selectedApp}
          open={showInterviewModal}
          onClose={() => { setShowInterviewModal(false); setSelectedApp(null); }}
        />
      )}
      {selectedApp && showOfferModal && (
        <OfferLetterModal
          app={selectedApp}
          open={showOfferModal}
          onClose={() => { setShowOfferModal(false); setSelectedApp(null); }}
        />
      )}
      {selectedApp && showRejectionModal && (
        <RejectionLetterModal
          app={selectedApp}
          open={showRejectionModal}
          onClose={() => { setShowRejectionModal(false); setSelectedApp(null); }}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-[#1A0A12]">Delete Application?</AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm text-[#6B4C3B]">
              This will permanently delete the application and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body border-[#F0D0DC]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId !== null && deleteApplication.mutate({ id: deleteConfirmId })}
              className="font-body bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteApplication.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...</>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
