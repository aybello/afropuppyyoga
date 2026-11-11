import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isOperationsManagerRole } from "@shared/apyPermissions";

type Applicant = { id: number; name: string; email: string; phone: string | null; role: string; location: string };
type ReviewRecord = {
  id: number; name: string; email: string | null; phone: string | null; role: string | null; location: string | null;
  status: string | null; isTeamMember: boolean; deletedAt: unknown; directoryOwnerIds: number[];
};

function RecordDetails({ record, label }: { record: ReviewRecord; label: string }) {
  return <div className="rounded-md border border-[#E8D8D0] bg-white p-3">
    <p className="font-semibold">{label} — application #{record.id}</p>
    <p>Name: {record.name || "Not recorded"}</p>
    <p>Email: {record.email || "Not recorded"}</p>
    <p>Phone: {record.phone || "Not recorded"}</p>
    <p>Role: {record.role || "Not recorded"}</p>
    <p>Location: {record.location || "Not recorded"}</p>
    <p>Status: {record.status || "Not recorded"}</p>
    <p>Team member: {record.isTeamMember ? "Yes" : "No"}</p>
    <p>Archived: {record.deletedAt ? `Yes (${String(record.deletedAt)})` : "No"}</p>
    <p>Linked Directory record IDs: {record.directoryOwnerIds.length ? record.directoryOwnerIds.join(", ") : "None"}</p>
  </div>;
}

/** Render every server-returned conflict, including archived and linked records. */
export function DuplicateApplicationReview({ selected, matches, checked, onCheckedChange, canReview, disabled = false }: {
  selected: ReviewRecord; matches: ReviewRecord[]; checked: boolean; onCheckedChange: (checked: boolean) => void;
  canReview: boolean; disabled?: boolean;
}) {
  return <section aria-labelledby="duplicate-review-heading" className="space-y-3 text-sm text-[#34221D]">
    <h3 id="duplicate-review-heading" className="font-semibold">Review matching applications</h3>
    <p>These records share contact details and may belong to the same person. Compare every record before enabling login.</p>
    <p>Approval requires matching name, email, and phone. Different names or applications already linked to an employee cannot be approved here.</p>
    <RecordDetails record={selected} label="Selected application — login will use these details" />
    <div className="space-y-2" aria-label="Matching applications">
      {matches.map((match) => <RecordDetails key={match.id} record={match} label="Matching application" />)}
    </div>
    {canReview && <p>If you confirm this review and add the employee, the reviewed matching applications will be linked to the same employee for history. The applications and signed offers remain on their original records; eligible signed offers may be available to the employee after ownership checks. Only the selected application will be used to enable employee login; the other applications will not be activated.</p>}
    {!canReview ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">These conflicts cannot be approved here. A record may be ambiguous, already linked, onboarded, or otherwise ineligible. Review the applications and Employee Directory before granting access.</p> :
      <label className="flex items-start gap-2 rounded-md border border-[#E8D8D0] bg-white p-3">
        <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.target.checked)} />
        <span>I reviewed all matching applications, confirm they belong to the same person, and confirm the selected application's email and phone are appropriate for login.</span>
      </label>}
  </section>;
}

const contactConflicts = new Set([
  "An existing employee uses these contacts. Review or restore that Directory record rather than creating a duplicate.",
  "Another applicant or staff profile uses these contacts. Review the conflicting record before granting access.",
]);
const reviewErrors = new Set([
  "Review all matching applications and confirm with a current review token before granting access.",
  "The duplicate review is no longer current. Refresh and review again.",
  "The matching Directory record changed. Refresh and review again before granting access.",
]);
const contactConflictMessage = "No employee was added. These contact details conflict with an existing record. Review the applications and Employee Directory before trying again.";
const reviewErrorMessage = "No employee was added. The review expired or the records changed. Review the refreshed results before trying again.";
const actionableErrors = new Set([
  "This application is no longer available.",
  "This applicant's contact or assignment changed after you opened confirmation. Refresh and review the current details before enabling login.",
  "Multiple Directory records are linked to this applicant. Review the Directory.",
  "This person already has an employee record. Manage or restore access from Employee Directory.",
  "Select a signed, accepted applicant with no pending email delivery before adding an employee.",
  "Wait for the applicant to sign their current Offer Letter and NDA before adding them.",
  "The current applicant details differ from the signed offer. Review the offer and assignment first.",
  "Choose a supported staff role before adding an employee with login access.",
  "Add a valid email or phone before granting login access.",
  "The applicant changed while being added. Refresh and try again.",
  "The employee record could not be created.",
  "Too many matching applications to review here. Resolve duplicate records before granting access.",
]);

/** Only display known safe server messages; unexpected errors may contain private data. */
export function hireErrorMessage(message: string, code?: string) {
  if (contactConflicts.has(message)) return contactConflictMessage;
  if (reviewErrors.has(message)) return reviewErrorMessage;
  if (actionableErrors.has(message)) return message;
  if (code === "UNAUTHORIZED") return "Your session has expired. Sign in again before adding an employee.";
  if (code === "FORBIDDEN") return "You do not have permission to add an employee. Contact an administrator.";
  return "Unable to add the employee. Please try again or contact an administrator.";
}

// Deliberately shorter than the server's 10-minute token lifetime. The server remains authoritative.
const REVIEW_MAX_AGE_MS = 5 * 60 * 1000;

export default function AddApplicantEmployeeDialog({ applicant, onClose, onAdded }: { applicant: Applicant | null; onClose: () => void; onAdded?: () => void }) {
  // Remount on close/switch so a prior acknowledgement or in-flight response cannot be reused.
  return applicant ? <ApplicantDialog key={applicant.id} applicant={applicant} onClose={onClose} onAdded={onAdded} /> : null;
}

function ApplicantDialog({ applicant, onClose, onAdded }: { applicant: Applicant; onClose: () => void; onAdded?: () => void }) {
  const utils = trpc.useUtils();
  const [acknowledgedSnapshot, setAcknowledgedSnapshot] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const preflight = trpc.staffAvailability.preflightHireSignedApplicant.useQuery({ applicationId: applicant.id }, {
    retry: false, refetchOnMount: "always", refetchOnWindowFocus: false, refetchOnReconnect: false, structuralSharing: false,
  });
  useEffect(() => {
    setAcknowledgedSnapshot(null);
    setExpired(false);
    if (!preflight.dataUpdatedAt) return;
    const remaining = Math.max(0, preflight.dataUpdatedAt + REVIEW_MAX_AGE_MS - Date.now());
    const timer = setTimeout(() => { setAcknowledgedSnapshot(null); setExpired(true); }, remaining);
    return () => clearTimeout(timer);
  }, [preflight.data, preflight.dataUpdatedAt]);
  useEffect(() => { if (preflight.isFetching || preflight.isError) setAcknowledgedSnapshot(null); }, [preflight.isFetching, preflight.isError]);
  const refresh = () => { setAcknowledgedSnapshot(null); setExpired(true); void preflight.refetch(); };
  const hire = trpc.staffAvailability.addSignedApplicantToDirectory.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.careers.list.invalidate(), utils.careers.getTimeline.invalidate(),
        utils.staffAvailability.listEmployees.invalidate(), utils.staffAvailability.getOrgChart.invalidate(), utils.training.overview.invalidate()]);
      if (!mounted.current) return;
      if (result.alreadyAdded) toast.info("This applicant is already in the Employee Directory. No new employee was added.");
      else if (result.reusedDirectoryRecord) toast.success("Existing Directory record linked and login enabled. Send onboarding documents next.");
      else toast.success("Employee added and login enabled. Send onboarding documents next.");
      onClose(); onAdded?.();
    },
    onError: (error) => {
      if (!mounted.current) return;
      toast.error(hireErrorMessage(error.message, error.data?.code));
      // All rejections may indicate a changed snapshot; never retain the old review.
      refresh();
    },
  });
  const data = preflight.data;
  const matchesDisplayed = data?.selected.id === applicant.id && data.selected.name === applicant.name
    && (data.selected.email ?? "") === applicant.email && (data.selected.phone ?? "") === (applicant.phone ?? "")
    && data.selected.role === applicant.role && data.selected.location === applicant.location;
  const current = Boolean(data && !preflight.isFetching && !preflight.isError && !expired && preflight.dataUpdatedAt
    && Date.now() < preflight.dataUpdatedAt + REVIEW_MAX_AGE_MS && matchesDisplayed);
  const hasConflicts = Boolean(data?.conflicts.length);
  const reviewed = Boolean(data && hasConflicts && data.canReview && data.reviewToken && acknowledgedSnapshot === data);
  const canSubmit = Boolean(current && data?.eligible && !hire.isPending && (!hasConflicts || reviewed));
  const inlineConflict = hire.error && contactConflicts.has(hire.error.message) ? contactConflictMessage : hire.error && reviewErrors.has(hire.error.message) ? reviewErrorMessage : null;
  const submit = () => {
    // Recheck freshness on click, including after the browser has suspended timers.
    if (!canSubmit || Date.now() >= preflight.dataUpdatedAt + REVIEW_MAX_AGE_MS || !data) return;
    const confirmed = { name: applicant.name, email: applicant.email, phone: applicant.phone, role: applicant.role, location: applicant.location };
    if (hasConflicts) {
      if (!data.canReview || !data.reviewToken || acknowledgedSnapshot !== data) return;
      hire.mutate({ applicationId: applicant.id, confirmed, expectedDirectory: data.prospectiveReuse, duplicateReview: { token: data.reviewToken, acknowledged: true } });
    } else hire.mutate({ applicationId: applicant.id, confirmed, expectedDirectory: data.prospectiveReuse });
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !hire.isPending) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto bg-[#FEFAF4] border-[#E8D8D0]">
      <DialogHeader><DialogTitle>Add to Employee Directory?</DialogTitle>
        <DialogDescription>This adds employee access from the existing application, creating a Directory record or linking an eligible existing record. It does not send an email or mark training complete.</DialogDescription></DialogHeader>
      <div className="space-y-2 text-sm text-[#34221D]">
        <p><strong>{applicant.name}</strong> · {applicant.email}</p>
        <p>Login phone: <strong>{applicant.phone || "Not recorded. Email sign-in only."}</strong></p>
        <p>{applicant.role} · {applicant.location}</p>
        <p>Access: <strong>{isOperationsManagerRole(applicant.role) ? "Operations tools (Job Applications, Private Events, Puppy Schedule and more) and training" : "Staff Portal and role-based training"}</strong>.</p>
        <p>They can sign in with their saved email or phone. Send onboarding documents afterward from this page.</p>
      </div>
      {preflight.isFetching && <p role="status">Checking for matching applications and Directory records...</p>}
      {preflight.isError && <p role="alert">Could not check for matching applications and Directory records. No employee can be added until the check succeeds.</p>}
      {expired && !preflight.isFetching && <p role="alert">The review has expired. Refresh and review again before adding an employee.</p>}
      {data && !preflight.isFetching && !preflight.isError && !matchesDisplayed && <p role="alert">The selected application changed. Close this dialog and refresh Applications before continuing.</p>}
      {data && !preflight.isFetching && !preflight.isError && data.directoryMatches?.length > 0 && <section className="space-y-2 text-sm" aria-label="Matching Directory records">
        <h3 className="font-semibold">Matching Employee Directory records</h3>
        {data.directoryMatches.map((employee) => <div key={employee.id} className="rounded-md border border-[#E8D8D0] bg-white p-3">
          <p>Directory record #{employee.id}: {employee.name}</p><p>Email: {employee.email || "Not recorded"}</p><p>Phone: {employee.phone || "Not recorded"}</p>
          <p>Role: {employee.role} · Location: {employee.location}</p><p>Employment: {employee.employmentStatus} · Linked application: {employee.sourceApplicationId ?? "None"}</p>
        </div>)}
        {data.prospectiveReuse && data.eligible && <p>This existing active, unlinked Directory record will be linked to the selected application and updated with its details. No new Directory record will be created.</p>}
      </section>}
      {data && !preflight.isFetching && !preflight.isError && data.eligibilityReason && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{data.eligibilityReason}</p>}
      {data && !preflight.isFetching && !preflight.isError && hasConflicts && <DuplicateApplicationReview selected={data.selected} matches={data.conflicts} canReview={data.canReview && Boolean(data.reviewToken)} checked={reviewed} disabled={!current || hire.isPending} onCheckedChange={(checked) => setAcknowledgedSnapshot(checked ? data : null)} />}
      {data && current && !hasConflicts && <p className="text-sm">No matching applications found.</p>}
      {inlineConflict && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{inlineConflict}</p>}
      <DialogFooter><Button variant="outline" disabled={hire.isPending || preflight.isFetching} onClick={refresh}>Refresh review</Button>
        <Button variant="outline" disabled={hire.isPending} onClick={onClose}>Cancel</Button>
        <Button className="bg-[#F29CB8] text-[#34221D] hover:bg-[#EB8DAA] hover:text-[#34221D]" disabled={!canSubmit} onClick={submit}>{hire.isPending ? "Enabling login..." : data?.prospectiveReuse && data.eligible ? "Link existing record and enable login" : "Add employee and enable login"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
