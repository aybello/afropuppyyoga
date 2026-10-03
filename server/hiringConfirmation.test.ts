import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), clicks: [] as Array<() => void> }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { useUtils: () => ({}), staffAvailability: { addSignedApplicantToDirectory: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) } } } }));
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
beforeEach(() => { vi.clearAllMocks(); mocks.clicks = []; });
describe("hire identity confirmation", () => {
  it("shows every login identifier and binds the button to those exact values", () => {
    const html = renderToStaticMarkup(createElement(AddApplicantEmployeeDialog, { applicant: app, onClose: vi.fn() }));
    expect(html).toContain(app.name); expect(html).toContain(app.email); expect(html).toContain(app.phone);
    expect(html).toContain(app.role); expect(html).toContain(app.location);
    mocks.clicks.at(-1)!();
    const { id, ...confirmed } = app;
    expect(mocks.mutate).toHaveBeenCalledWith({ applicationId: id, confirmed });
  });
  it("clearly says email-only login when a phone is missing", () => {
    expect(renderToStaticMarkup(createElement(AddApplicantEmployeeDialog, { applicant: { ...app, phone: null }, onClose: vi.fn() }))).toContain("Email sign-in only");
  });
});
