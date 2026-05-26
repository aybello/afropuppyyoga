/* ============================================================
   Staff Management — Admin page to invite, view, and revoke staff
   Owner can send magic link invites and manage active staff access
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, LOGO_URL } from "@/const";
import AdminNav from "@/components/AdminNav";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
  UserCog,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function StaffManagement() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  const { data: staffList, isLoading } = trpc.staff.listStaff.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const inviteStaff = trpc.staff.inviteStaff.useMutation({
    onSuccess: () => {
      toast.success("Invite sent! The staff member will receive an email with their login link.");
      utils.staff.listStaff.invalidate();
      setInviteOpen(false);
      setForm({ name: "", email: "" });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send invite. Please try again.");
    },
  });

  const revokeStaff = trpc.staff.revokeStaff.useMutation({
    onSuccess: () => {
      toast.success("Staff access revoked.");
      utils.staff.listStaff.invalidate();
      setConfirmRevokeId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to revoke access.");
    },
  });

  const resendInvite = trpc.staff.resendInvite.useMutation({
    onSuccess: () => {
      toast.success("New invite link sent! The staff member will receive a fresh email.");
      utils.staff.listStaff.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to resend invite. Please try again.");
    },
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const handleInvite = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please enter both name and email.");
      return;
    }
    inviteStaff.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      origin: window.location.origin,
    });
  };

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
        <p className="font-body text-[#1A0A12] mb-6">Please log in to manage staff.</p>
        <button
          onClick={() => (window.location.href = getLoginUrl())}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #e91e8c, #c2410c)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  // Staff management is admin-only — staff members cannot manage other staff
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-bold text-2xl text-[#1A0A12] mb-2">Access Denied</h2>
        <p className="font-body text-[#1A0A12]">This page is for admins only.</p>
      </div>
    );
  }

  const confirmRevokeStaff = staffList?.find((s) => s.id === confirmRevokeId);

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="h-px w-6 bg-[#8B2252]" />
              <span className="font-body text-xs font-semibold tracking-widest uppercase text-[#8B2252]">Admin</span>
            </div>
            <h1 className="font-display font-bold text-3xl text-[#1A0A12]">Staff Access</h1>
            <p className="font-body text-sm text-[#1A0A12] mt-1">
              Invite team members to the staff portal via magic link — no password required.
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 font-body font-semibold text-sm rounded-full text-white transition-all duration-200 hover:-translate-y-0.5 shrink-0"
            style={{ background: "linear-gradient(135deg, #8B2252, #8B2252)" }}
          >
            <UserPlus className="w-4 h-4" />
            Invite Staff
          </button>
        </div>

        {/* How it works */}
        <div
          className="rounded-2xl p-5 border"
          style={{ background: "#FFF5F8", borderColor: "#F0D0DC" }}
        >
          <p className="font-body text-sm font-semibold text-[#8B2252] mb-2">How it works</p>
          <ol className="font-body text-sm text-[#1A0A12] space-y-1 list-decimal list-inside">
            <li>Enter the staff member's name and email, then click "Invite Staff"</li>
            <li>They receive an email with a "Access APY Staff Portal" button</li>
            <li>Clicking the link logs them in instantly — no password needed</li>
            <li>The link is valid for 7 days and can be reused to log back in</li>
            <li>Revoke access anytime by clicking the trash icon next to their name</li>
          </ol>
        </div>

        {/* Staff table */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B2252]" />
            </div>
          ) : !staffList || staffList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF5F8] flex items-center justify-center mb-4">
                <UserCog className="w-8 h-8 text-[#8B2252]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#1A0A12] mb-2">No staff invited yet</h3>
              <p className="font-body text-[#1A0A12] text-sm mb-6">
                Click "Invite Staff" to send a magic link to a team member.
              </p>
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 font-body font-semibold text-sm rounded-full text-white"
                style={{ background: "linear-gradient(135deg, #8B2252, #8B2252)" }}
              >
                <UserPlus className="w-4 h-4" />
                Invite First Staff Member
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FFF5F8] border-b border-[#F0D0DC]">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Name</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Email</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Status</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Last Login</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-[#8B2252]">Invited</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff, idx) => {
                    const isExpired = new Date(staff.expiresAt) < new Date();
                    const hasLoggedIn = !!staff.firstUsedAt;
                    return (
                      <tr
                        key={staff.id}
                        className={`border-b border-[#F0D0DC] last:border-0 transition-colors hover:bg-[#FFF5F8] ${idx % 2 === 0 ? "" : "bg-[#FEFAF4]"}`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-body font-semibold text-sm text-[#1A0A12]">
                            {staff.name}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-body text-sm text-[#1A0A12] flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#C4A0B0]" />
                            {staff.email}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-orange-100 text-orange-700">
                              <Clock className="w-3 h-3" /> Link Expired
                            </span>
                          ) : hasLoggedIn ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-blue-100 text-blue-700">
                              <Mail className="w-3 h-3" /> Invite Sent
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-body text-sm text-[#1A0A12]">
                          {staff.lastUsedAt
                            ? new Date(staff.lastUsedAt).toLocaleDateString("en-CA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : <span className="italic text-[#C4A0B0]">Never</span>}
                        </td>
                        <td className="px-5 py-4 font-body text-sm text-[#1A0A12]">
                          {new Date(staff.createdAt).toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setResendingId(staff.id);
                                resendInvite.mutate(
                                  { id: staff.id, origin: window.location.origin },
                                  { onSettled: () => setResendingId(null) }
                                );
                              }}
                              disabled={resendInvite.isPending && resendingId === staff.id}
                              className="p-2 rounded-lg text-[#8B2252] hover:text-[#8B2252] hover:bg-[#FFF5F8] transition-colors disabled:opacity-50"
                              title="Resend invite link"
                            >
                              {resendInvite.isPending && resendingId === staff.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmRevokeId(staff.id)}
                              className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Revoke access"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              Invite Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="font-body text-sm text-[#1A0A12]">
              Enter the staff member's details. They'll receive an email with a one-click login link.
            </p>
            <div className="space-y-2">
              <Label htmlFor="staff-name" className="font-body text-sm font-semibold text-[#1A0A12]">
                Full Name
              </Label>
              <Input
                id="staff-name"
                placeholder="e.g. Sarah Johnson"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email" className="font-body text-sm font-semibold text-[#1A0A12]">
                Email Address
              </Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="e.g. sarah@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="font-body"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setInviteOpen(false);
                setForm({ name: "", email: "" });
              }}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviteStaff.isPending}
              className="font-body font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #8B2252, #8B2252)" }}
            >
              {inviteStaff.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <Dialog open={confirmRevokeId !== null} onOpenChange={() => setConfirmRevokeId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1A0A12]">
              Revoke Access?
            </DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-[#1A0A12] py-2">
            This will immediately revoke <strong>{confirmRevokeStaff?.name}</strong>'s access to the staff portal.
            Their login link will stop working. You can always invite them again later.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmRevokeId(null)}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRevokeId !== null && revokeStaff.mutate({ id: confirmRevokeId })}
              disabled={revokeStaff.isPending}
              className="font-body font-semibold"
            >
              {revokeStaff.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Yes, Revoke Access"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
