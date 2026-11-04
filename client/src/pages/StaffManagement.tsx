/* ============================================================
   Staff Management — Admin page to invite, view, and revoke staff
   Owner can send magic link invites and manage active staff access
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl, LOGO_URL } from "@/const";
import { Link } from "wouter";
import AdminNav from "@/components/AdminNav";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCog,
  Users,
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
  const access = trpc.staff.myAccess.useQuery(undefined, { enabled: Boolean(user) });

  const { data: staffList, isLoading } = trpc.staff.listStaff.useQuery(undefined, {
    enabled: Boolean(access.data?.canManageOperations),
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
      <div className="min-h-screen apy-staff-ui bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-link" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen apy-staff-ui bg-background flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-medium text-2xl text-foreground mb-2">Management Access Required</h2>
        <p className="font-body text-foreground mb-6">Please log in to manage APY HQ staff access.</p>
        <button
          onClick={() => (window.location.href = getLoginUrl())}
          className="inline-flex items-center px-6 py-3 font-body font-semibold text-sm rounded-full text-primary-foreground transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "var(--primary)" }}
        >
          Log In
        </button>
      </div>
    );
  }

  // Staff access is limited to the owner and Operations Managers.
  if (!access.isLoading && !access.data?.canManageOperations) {
    return (
      <div className="min-h-screen apy-staff-ui bg-background flex flex-col items-center justify-center p-6">
        <img src={LOGO_URL} alt="AfroPuppyYoga" className="w-16 h-16 rounded-full object-cover mb-6" />
        <h2 className="font-display font-medium text-2xl text-foreground mb-2">Access Denied</h2>
        <p className="font-body text-foreground">This page is for the owner and Operations Managers.</p>
      </div>
    );
  }

  const confirmRevokeStaff = staffList?.find((s) => s.id === confirmRevokeId);

  return (
    <div className="min-h-screen apy-staff-ui bg-background">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="h-px w-6 bg-primary" />
              <span className="font-body text-xs font-semibold tracking-widest uppercase text-brand-link">Admin</span>
            </div>
            <h1 className="font-display font-medium text-3xl text-foreground">Staff Access</h1>
            <p className="font-body text-sm text-foreground mt-1">
              Manage secure APY HQ access. Email-linked team members use a one-click link; phone-linked team members use a one-time SMS code.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/employees?tab=tree"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 font-body text-sm font-semibold text-brand-link transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent"
            >
              <Users className="h-4 w-4" />
              Manage Team
            </Link>
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-body font-semibold text-sm rounded-full text-primary-foreground transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "var(--primary)" }}
            >
              <UserPlus className="w-4 h-4" />
              Invite Staff
            </button>
          </div>
        </div>

        {/* How it works */}
        <div
          className="rounded-2xl p-5 border"
          style={{ background: "var(--accent)", borderColor: "var(--border)" }}
        >
          <p className="font-body text-sm font-semibold text-brand-link mb-2">How it works</p>
          <ol className="font-body text-sm text-foreground space-y-1 list-decimal list-inside">
              <li>For email access, enter the active APY team member's name and the exact email on their Team profile, then click "Invite Staff"</li>
            <li>For phone access, the active team member visits <strong>/staff-access</strong> and verifies the phone number saved to their APY HQ profile</li>
            <li>Email links and phone codes both sign staff into their role-specific APY HQ workspace</li>
            <li>Access can be revoked anytime by clicking the trash icon next to an email invitation</li>
            <li>Revoke access anytime by clicking the trash icon next to their name</li>
          </ol>
        </div>

        {/* Staff table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-link" />
            </div>
          ) : !staffList || staffList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                <UserCog className="w-8 h-8 text-brand-link" />
              </div>
              <h3 className="font-display font-medium text-xl text-foreground mb-2">No staff invited yet</h3>
              <p className="font-body text-foreground text-sm mb-6">
                Click "Invite Staff" to send a magic link to a team member.
              </p>
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 font-body font-semibold text-sm rounded-full text-primary-foreground"
                style={{ background: "var(--primary)" }}
              >
                <UserPlus className="w-4 h-4" />
                Invite First Staff Member
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-accent border-b border-border">
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-brand-link">Name</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-brand-link">Email</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-brand-link">Status</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-brand-link">Last Login</th>
                    <th className="text-left px-5 py-4 font-body font-semibold text-xs uppercase tracking-wide text-brand-link">Invited</th>
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
                        className={`border-b border-border last:border-0 transition-colors hover:bg-accent ${idx % 2 === 0 ? "" : "bg-background"}`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-body font-semibold text-sm text-foreground">
                            {staff.name}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-body text-sm text-foreground flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            {staff.email}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {staff.applicationId === null ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-body font-semibold bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3 h-3" /> Reissue Needed
                            </span>
                          ) : isExpired ? (
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
                        <td className="px-5 py-4 font-body text-sm text-foreground">
                          {staff.lastUsedAt
                            ? new Date(staff.lastUsedAt).toLocaleDateString("en-CA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : <span className="italic text-muted-foreground">Never</span>}
                        </td>
                        <td className="px-5 py-4 font-body text-sm text-foreground">
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
                              disabled={staff.applicationId === null || (resendInvite.isPending && resendingId === staff.id)}
                              className="p-2 rounded-lg text-brand-link hover:text-brand-link hover:bg-accent transition-colors disabled:opacity-50"
                              title={staff.applicationId === null ? "Use Invite Staff to issue a new profile-bound link" : "Resend invite link"}
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
                              title={staff.applicationId === null ? "Revoke this legacy access link without changing employee history" : "Revoke access"}
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
            <DialogTitle className="font-display text-xl text-foreground">
              Invite Staff Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="font-body text-sm text-foreground">
              Enter the staff member's details. They'll receive an email with a one-click login link.
            </p>
            <div className="space-y-2">
              <Label htmlFor="staff-name" className="font-body text-sm font-semibold text-foreground">
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
              <Label htmlFor="staff-email" className="font-body text-sm font-semibold text-foreground">
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
              className="font-body font-semibold text-primary-foreground"
              style={{ background: "var(--primary)" }}
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
            <DialogTitle className="font-display text-xl text-foreground">
              Revoke Access?
            </DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-foreground py-2">
            This will remove <strong>{confirmRevokeStaff?.name}</strong> from APY HQ, revoke their Staff Portal access, disable their email and phone sign-in, and preserve their employment history as inactive.
            Staffing coverage safeguards still apply.
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
