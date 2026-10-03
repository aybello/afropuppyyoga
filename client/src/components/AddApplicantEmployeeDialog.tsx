import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isOperationsManagerRole } from "@shared/apyPermissions";

type Applicant = { id: number; name: string; email: string; phone: string | null; role: string; location: string };
export default function AddApplicantEmployeeDialog({ applicant, onClose, onAdded }: { applicant: Applicant | null; onClose: () => void; onAdded?: () => void }) {
  const utils = trpc.useUtils();
  const hire = trpc.staffAvailability.addSignedApplicantToDirectory.useMutation({
    onSuccess: async () => {
      toast.success("Employee added and login enabled. Send onboarding documents next.");
      await Promise.all([utils.careers.list.invalidate(), utils.careers.getTimeline.invalidate(),
        utils.staffAvailability.listEmployees.invalidate(), utils.staffAvailability.getOrgChart.invalidate(), utils.training.overview.invalidate()]);
      onClose(); onAdded?.();
    },
    onError: (error) => toast.error(error.message),
  });
  return <Dialog open={Boolean(applicant)} onOpenChange={(open) => { if (!open && !hire.isPending) onClose(); }}>
    <DialogContent className="bg-[#FEFAF4] border-[#F0D0DC]">
      <DialogHeader><DialogTitle>Add to Employee Directory?</DialogTitle>
        <DialogDescription>This creates an active employee from the existing application. It does not send an email or mark training complete.</DialogDescription></DialogHeader>
      {applicant && <div className="space-y-2 text-sm text-[#3D1A2E]">
        <p><strong>{applicant.name}</strong> · {applicant.email}</p>
        <p>Login phone: <strong>{applicant.phone || "Not recorded. Email sign-in only."}</strong></p>
        <p>{applicant.role} · {applicant.location}</p>
        <p>Access: <strong>{isOperationsManagerRole(applicant.role) ? "Operations Manager tools and training" : "Staff Portal and role-based training"}</strong>.</p>
        <p>They can sign in with their saved email or phone. Send onboarding documents afterward from this page.</p>
      </div>}
      <DialogFooter><Button variant="outline" disabled={hire.isPending} onClick={onClose}>Cancel</Button>
        <Button className="bg-[#8B2252] text-white" disabled={!applicant || hire.isPending} onClick={() => applicant && hire.mutate({ applicationId: applicant.id, confirmed: { name: applicant.name, email: applicant.email, phone: applicant.phone, role: applicant.role, location: applicant.location } })}>
          {hire.isPending ? "Adding employee..." : "Add employee and enable login"}
        </Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
