export type HiringApplication = {
  status: string;
  signingStatus: string | null;
  onboardingSentAt: Date | string | null;
  onboardingDeliveryToken: string | null;
  employeeId?: number | null;
  employeeStatus?: string | null;
  isTeamMember?: boolean | number | null;
  offerSentAt?: Date | string | null;
};
export const HIRING_STAGES = [
  ["review", "Applications"], ["interview", "Interviews"],
  ["offer", "Offer awaiting signature"], ["signed", "Signed, ready to add"],
  ["employee", "Employees, send documents"], ["onboarding", "Onboarding sent"],
  ["rejected", "Rejected"], ["all", "All"],
] as const;
export type HiringStage = typeof HIRING_STAGES[number][0];

export function getHiringWorkflow(app: HiringApplication) {
  const hasEmployee = app.employeeId != null;
  const signed = app.signingStatus === "signed";
  const employeeActive = hasEmployee && app.employeeStatus === "active";
  const closed = app.status === "rejected" || hasEmployee || app.status === "onboarded";
  let stage: HiringStage = "review";
  let label = app.status === "shortlisted" ? "Shortlisted" : app.status === "reviewed" ? "Reviewed" : "New application";
  let next = "Review the application and send an interview invitation.";
  if (app.status.startsWith("interview_")) {
    stage = "interview";
    label = app.status === "interview_scheduled" ? "Interview scheduled" : "Interview invitation sent";
    next = "Confirm the interview, then send an offer when you are ready.";
  }
  if (app.status === "accepted" || app.signingStatus) {
    stage = "offer";
    label = app.offerSentAt ? "Offer sent, awaiting signature" : app.signingStatus ? "Offer prepared, delivery not confirmed" : "Selected, offer not sent";
    if (app.signingStatus === "expired") label = "Offer link expired";
    next = app.signingStatus ? "Wait for the signature, or resend the offer link." : "Send the offer letter and NDA for signing.";
  }
  if (signed) {
    stage = "signed"; label = "Offer signed, ready to add";
    next = "Add to Employee Directory and enable role-based login. Onboarding documents come next.";
  }
  if (hasEmployee || app.status === "onboarded") {
    stage = app.onboardingSentAt ? "onboarding" : "employee";
    label = hasEmployee ? (employeeActive ? "Employee added" : "Employee inactive") : "Employee history, check Directory link";
    if (employeeActive && app.onboardingSentAt) label = "Onboarding documents sent";
    next = !employeeActive ? "Manage this record in Employee Directory." : app.onboardingSentAt
      ? "Documents sent does not mean training is complete. Review training progress separately."
      : "Send onboarding documents. The employee can already sign in and access their training.";
  }
  if (app.status === "rejected") { stage = "rejected"; label = "Rejected"; next = "No further hiring action is due."; }
  if (app.onboardingDeliveryToken) next = "Resolve the pending email delivery before sending another message.";
  return { stage, label, next,
    canAddEmployee: signed && app.status === "accepted" && !hasEmployee && !app.onboardingDeliveryToken,
    canSendDocuments: employeeActive && app.status === "onboarded" && !app.onboardingDeliveryToken,
    canSendOffer: !closed && !signed && !app.onboardingDeliveryToken,
    canInterview: !closed && !signed && !app.onboardingDeliveryToken,
    canReject: !closed && !app.onboardingDeliveryToken,
    hasEmployee, employeeActive,
  };
}
