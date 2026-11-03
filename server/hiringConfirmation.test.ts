import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), preflight: vi.fn(), clicks: [] as Array<() => void> }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { useUtils: () => ({}), staffAvailability: {
  preflightHireSignedApplicant: { useQuery: mocks.preflight },
  addSignedApplicantToDirectory: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
} } }));
vi.mock("../client/src/components/ui/dialog", () => {
  const component = ({ children }: any) => children;
  return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map((name) => [name, component]));
});
vi.mock("../client/src/components/ui/button", () => ({ Button: ({ children, onClick, disabled }: any) => {
  if (onClick && !disabled) mocks.clicks.push(onClick);
  return createElement("button", { disabled }, children);
} }));
import AddApplicantEmployeeDialog from "../client/src/components/AddApplicantEmployeeDialog";
const app = { id: 42, name: "Fictional Applicant", email: "fiction@example.com", phone: "+14165550100", role: "Puppy Monitor", location: "KW" };
const preflightFor = (selected: typeof app | (Omit<typeof app, "phone"> & { phone: null })) => ({
  data: { selected: { ...selected, status: "accepted", isTeamMember: false, deletedAt: null, directoryOwnerIds: [] },
    conflicts: [], canReview: false, reviewToken: null, eligible: true, eligibilityReason: null, directoryMatches: [], prospectiveReuse: null },
  dataUpdatedAt: Date.now(), isFetching: false, isError: false, refetch: vi.fn(),
});
beforeEach(() => { vi.clearAllMocks(); mocks.clicks = []; mocks.preflight.mockReturnValue(preflightFor(app)); });
describe("hire identity confirmation", () => {
  it("shows every login identifier and binds the button to those exact values", () => {
    const html = renderToStaticMarkup(createElement(AddApplicantEmployeeDialog, { applicant: app, onClose: vi.fn() }));
    expect(html).toContain(app.name); expect(html).toContain(app.email); expect(html).toContain(app.phone);
    expect(html).toContain(app.role); expect(html).toContain(app.location);
    expect(html).toContain("No matching applications found");
    expect(mocks.preflight).toHaveBeenCalledWith({ applicationId: app.id }, {
      retry: false, refetchOnMount: "always", refetchOnWindowFocus: false, refetchOnReconnect: false, structuralSharing: false,
    });
    mocks.clicks.at(-1)!();
    const { id, ...confirmed } = app;
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith({ applicationId: id, confirmed, expectedDirectory: null });
  });
  it("clearly says email-only login when a phone is missing", () => {
    mocks.preflight.mockReturnValue(preflightFor({ ...app, phone: null }));
    expect(renderToStaticMarkup(createElement(AddApplicantEmployeeDialog, { applicant: { ...app, phone: null }, onClose: vi.fn() }))).toContain("Email sign-in only");
  });
});
