import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { employees, jobApplicationActions, staffingMutationLocks } from "../drizzle/schema";
import { hireSignedApplicant, preflightHireSignedApplicant } from "./hireSignedApplicant";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), invalidate: vi.fn(), refetch: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(), toastInfo: vi.fn(),
  buttons: [] as Array<{ text: string; disabled: boolean; click: () => void }>,
  state: [] as unknown[], cursor: 0,
  callbacks: {} as { onError: (error: Error & { data?: { code: string } }) => void; onSuccess: (result: { alreadyAdded: boolean; reusedDirectoryRecord: boolean }) => Promise<void> },
  query: {} as any, error: null as Error | null, pending: false,
}));
// A tiny hook harness lets the server-rendered dialog be rerendered after checkbox/click events without a DOM dependency.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.state)) mocks.state[index] = initial;
    return [mocks.state[index], (value: unknown) => { mocks.state[index] = value; }];
  }, useRef: (value: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.state)) mocks.state[index] = { current: value };
    return mocks.state[index];
  }, useEffect: () => {} };
});
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ careers: { list: { invalidate: mocks.invalidate }, getTimeline: { invalidate: mocks.invalidate } },
    staffAvailability: { listEmployees: { invalidate: mocks.invalidate }, getOrgChart: { invalidate: mocks.invalidate } }, training: { overview: { invalidate: mocks.invalidate } } }),
  staffAvailability: {
    preflightHireSignedApplicant: { useQuery: () => mocks.query },
    addSignedApplicantToDirectory: { useMutation: (callbacks: typeof mocks.callbacks) => {
      mocks.callbacks = callbacks;
      return { mutate: mocks.mutate, isPending: mocks.pending, error: mocks.error };
    } },
  },
} }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess, info: mocks.toastInfo } }));
vi.mock("../client/src/components/ui/dialog", () => {
  const component = ({ children }: any) => children;
  return Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map((name) => [name, component]));
});
vi.mock("../client/src/components/ui/button", () => ({ Button: ({ children, onClick, disabled }: any) => {
  const text = typeof children === "string" ? children : "";
  mocks.buttons.push({ text, disabled: Boolean(disabled), click: onClick });
  return createElement("button", { disabled }, children);
} }));
import AddApplicantEmployeeDialog, { DuplicateApplicationReview, hireErrorMessage } from "../client/src/components/AddApplicantEmployeeDialog";

const applicant = { id: 42, name: "Fictional Applicant", email: "fiction@example.com", phone: "+14165550100", role: "Puppy Monitor", location: "KW" };
const selected = { ...applicant, status: "accepted", isTeamMember: false, deletedAt: null, directoryOwnerIds: [] as number[] };
const match = { ...selected, id: 73, status: "rejected", deletedAt: new Date("2025-01-01T00:00:00Z") };
const other = { ...match, id: 99, name: "Different Name", email: "different@example.com", phone: null, status: "onboarded", isTeamMember: true, directoryOwnerIds: [15, 18] };
const legacy = { id: 8, name: applicant.name, email: applicant.email, phone: applicant.phone, role: applicant.role, location: applicant.location, employmentStatus: "active", sourceApplicationId: null };
const now = 1_800_000_000_000;
const render = (candidate: typeof applicant | null = applicant, onClose = vi.fn(), onAdded = vi.fn()) => {
  mocks.cursor = 0; mocks.buttons = [];
  return renderToStaticMarkup(createElement(AddApplicantEmployeeDialog, { applicant: candidate, onClose, onAdded }));
};
const button = (text: string) => mocks.buttons.find((item) => item.text === text)!;
const add = () => button("Add employee and enable login");
const data = (conflicts: typeof match[] = [], canReview = false, reviewToken: string | null = null) => ({ selected, conflicts, canReview, reviewToken, eligible: true, eligibilityReason: null as string | null, directoryMatches: [] as typeof legacy[], prospectiveReuse: null as typeof legacy | null });
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.state = []; mocks.cursor = 0; mocks.error = null; mocks.pending = false;
  mocks.query = { data: data(), dataUpdatedAt: now, isFetching: false, isError: false, refetch: mocks.refetch };
});

describe("duplicate application review panel", () => {
  it("shows every matching application's identity, state, archive and directory links", () => {
    const html = renderToStaticMarkup(createElement(DuplicateApplicationReview, { selected, matches: [match, other], checked: false, onCheckedChange: vi.fn(), canReview: false }));
    for (const text of ["application #42", "application #73", "application #99", applicant.name, applicant.email, applicant.phone,
      "Different Name", "different@example.com", "Not recorded", "onboarded", "Team member: Yes", "Archived: Yes", "15, 18",
      "cannot be approved", "No application history will be merged", "historical records will not be activated"]) expect(html).toContain(text);
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain(">null<");
  });
  it("requires explicit affirmation when conflicts are reviewable", () => {
    const onCheckedChange = vi.fn();
    const element = DuplicateApplicationReview({ selected, matches: [match], checked: false, onCheckedChange, canReview: true });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("reviewed all matching applications");
    expect(html).not.toContain('checked=""');
    // Exercise the actual native checkbox handler.
    const label = (element.props as any).children.at(-1);
    const input = label.props.children[0];
    input.props.onChange({ target: { checked: true } });
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("add applicant employee dialog", () => {
  it("preserves the no-conflict submission and confirmed fields", () => {
    expect(render()).toContain("No matching applications found");
    expect(add().disabled).toBe(false);
    add().click();
    const { id, ...confirmed } = applicant;
    expect(mocks.mutate).toHaveBeenCalledWith({ applicationId: id, confirmed, expectedDirectory: null });
  });
  it("fails closed during fetch, failed check, and an ineligible or ambiguous conflict", () => {
    mocks.query.isFetching = true; expect(render()).toContain("Checking for matching applications"); expect(add().disabled).toBe(true);
    mocks.query.isFetching = false; mocks.query.isError = true; expect(render()).toContain("Could not check"); expect(add().disabled).toBe(true);
    mocks.query.isError = false; mocks.query.data = data([match, other], false); expect(render()).toContain("cannot be approved"); expect(add().disabled).toBe(true);
    mocks.query.data = data([match], true, null); render(); expect(add().disabled).toBe(true);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("requires acknowledgement and submits the exact token only for the reviewed snapshot", () => {
    mocks.query.data = data([match], true, "signed-token");
    const html = render(); expect(html).toContain("application #73"); expect(add().disabled).toBe(true);
    // The checkbox handler stores the precise preflight response, not just a timestamp.
    mocks.state[0] = mocks.query.data;
    render(); expect(add().disabled).toBe(false); add().click();
    const { id, ...confirmed } = applicant;
    expect(mocks.mutate).toHaveBeenCalledWith({ applicationId: id, confirmed, expectedDirectory: null, duplicateReview: { token: "signed-token", acknowledged: true } });
    mocks.query.data = data([match], true, "new-token");
    render(); expect(add().disabled).toBe(true);
  });
  it("blocks refreshed, expired, mismatched and changed applicant data", () => {
    mocks.query.data = data([match], true, "signed-token"); render(); mocks.state[0] = mocks.query.data; render();
    button("Refresh review").click(); expect(mocks.refetch).toHaveBeenCalledOnce(); render(); expect(add().disabled).toBe(true);
    mocks.state = []; mocks.query.dataUpdatedAt = now - 300_000; expect(render()).toContain("application #73"); expect(add().disabled).toBe(true);
    mocks.state = []; mocks.query.dataUpdatedAt = now; mocks.query.data = { ...data(), selected: { ...selected, email: "changed@example.com" } };
    expect(render()).toContain("selected application changed"); expect(add().disabled).toBe(true);
    mocks.query.data = data(); expect(render({ ...applicant, id: 43 })).toContain("selected application changed"); expect(add().disabled).toBe(true);
  });
  it("rechecks expiration at click time even if browser timers were suspended", () => {
    render(); const click = add().click;
    vi.mocked(Date.now).mockReturnValue(now + 300_000);
    click(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("displays and submits the exact prospective legacy reuse, without claiming a new record", async () => {
    mocks.query.data = { ...data(), directoryMatches: [legacy], prospectiveReuse: legacy };
    const html = render();
    expect(html).toContain("Directory record #8"); expect(html).toContain("No new Directory record will be created");
    expect(html).toContain("Linked application: None");
    const link = button("Link existing record and enable login"); expect(link.disabled).toBe(false); link.click();
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ expectedDirectory: legacy }));
    await mocks.callbacks.onSuccess({ alreadyAdded: false, reusedDirectoryRecord: true });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Existing Directory record linked"));
  });
  it("blocks ineligible records even without an application conflict and explains a large review", () => {
    mocks.query.data = { ...data(), eligible: false, directoryMatches: [legacy], eligibilityReason: "An existing employee uses these contacts. Review or restore that Directory record rather than creating a duplicate." };
    expect(render()).toContain("Directory record #8"); expect(add().disabled).toBe(true);
    mocks.query.data = { ...data(), eligible: false, eligibilityReason: "Too many matching applications to review here. Resolve duplicate records before granting access." };
    expect(render()).toContain("Too many matching applications"); expect(add().disabled).toBe(true);
  });
  it("clears review and refreshes after any mutation rejection, sanitizing unknown errors", () => {
    mocks.query.data = data([match], true, "token"); render(); mocks.state[0] = mocks.query.data; render();
    mocks.callbacks.onError(new Error("SQL failed for secret@example.com"));
    expect(mocks.refetch).toHaveBeenCalledOnce(); expect(mocks.state[0]).toBe(null);
    expect(mocks.toastError).toHaveBeenCalledWith("Unable to add the employee. Please try again or contact an administrator.");
    render(); expect(add().disabled).toBe(true);
    expect(hireErrorMessage("Review all matching applications and confirm with a current review token before granting access.")).toContain("review expired");
    expect(hireErrorMessage("secret", "UNAUTHORIZED")).toContain("Sign in again");
    expect(hireErrorMessage("secret", "FORBIDDEN")).toContain("permission");
  });
  it.each([true, false])("reports alreadyAdded=%s and refreshes existing views", async (alreadyAdded) => {
    const onClose = vi.fn(), onAdded = vi.fn(); render(applicant, onClose, onAdded);
    await mocks.callbacks.onSuccess({ alreadyAdded, reusedDirectoryRecord: alreadyAdded });
    expect(alreadyAdded ? mocks.toastInfo : mocks.toastSuccess).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledTimes(5); expect(onClose).toHaveBeenCalledOnce(); expect(onAdded).toHaveBeenCalledOnce();
  });
});

describe("hiring preflight and Directory consistency", () => {
  const actor = { id: 1, name: "Manager", email: "manager@example.com" };
  const app = { ...applicant, status: "accepted", isTeamMember: false, deletedAt: null, onboardingDeliveryToken: null, onboardingSentAt: null };
  const offer = { id: 2, applicationId: app.id, applicantEmail: app.email, role: app.role, location: app.location, signed: 1 };
  function harness(reads: unknown[][]) {
    const writes: Array<{ table: unknown; values: any }> = [];
    const tx: any = {
      select: () => { let result: unknown[]; const chain: any = {
        from: (table: unknown) => { result = table === staffingMutationLocks ? [] : reads.shift() ?? []; return chain; },
        where: () => chain, orderBy: () => chain, limit: () => chain, for: async () => result, then: (resolve: any) => resolve(result),
      }; return chain; },
      insert: (table: unknown) => ({ values: (values: unknown) => { if (table !== staffingMutationLocks) writes.push({ table, values }); const r: any = [{ insertId: 77 }]; r.onDuplicateKeyUpdate = async () => r; return r; } }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { writes.push({ table, values }); return [{ affectedRows: 1 }]; } }) }),
    };
    return { db: { select: tx.select, transaction: async (callback: any) => callback(tx) }, writes };
  }
  beforeEach(() => vi.stubEnv("JWT_SECRET", "test-secret"));
  it("matches normalized legacy contacts, shows the prospective reuse and returns its outcome", async () => {
    const record = { ...legacy, name: "  FICTIONAL   APPLICANT  ", email: " FICTION@EXAMPLE.COM ", phone: "(416) 555-0100" };
    const preview = await preflightHireSignedApplicant(harness([[app], [offer], [record], [app]]).db, app.id, actor);
    expect(preview).toMatchObject({ eligible: true, directoryMatches: [{ id: 8 }], prospectiveReuse: { id: 8 } });
    const h = harness([[app], [record], [offer], [app]]);
    const result = await hireSignedApplicant(h.db, app.id, actor, app, undefined, preview.prospectiveReuse);
    expect(result).toMatchObject({ id: 8, reusedDirectoryRecord: true, portalAccessLevel: "team_member" });
    expect(h.writes.some((write) => write.table === employees && write.values.sourceApplicationId === app.id)).toBe(true);
  });
  it.each([
    { name: "Different Person" }, { employmentStatus: "inactive" }, { sourceApplicationId: 9 },
    { email: "different@example.com" }, { phone: "4165550199" },
  ])("shows and blocks an ambiguous Directory contact %j", async (change) => {
    const record = { ...legacy, ...change };
    const preview = await preflightHireSignedApplicant(harness([[app], [offer], [record], [app]]).db, app.id, actor);
    expect(preview).toMatchObject({ eligible: false, prospectiveReuse: null, directoryMatches: [{ id: 8 }] });
    const h = harness([[app], [record], [offer]]);
    await expect(hireSignedApplicant(h.db, app.id, actor, app, undefined, null)).rejects.toThrow("existing employee");
    expect(h.writes).toEqual([]);
  });
  it("blocks multiple Directory matches and a changed reuse snapshot before writing", async () => {
    const second = { ...legacy, id: 9 };
    const preview = await preflightHireSignedApplicant(harness([[app], [offer], [legacy, second], [app]]).db, app.id, actor);
    expect(preview.eligible).toBe(false); expect(preview.directoryMatches).toHaveLength(2);
    const changed = harness([[app], [{ ...legacy, role: "Operations Manager" }], [offer]]);
    await expect(hireSignedApplicant(changed.db, app.id, actor, app, undefined, legacy)).rejects.toThrow("Directory record changed");
    expect(changed.writes).toEqual([]);
    const added = harness([[app], [legacy], [offer]]);
    await expect(hireSignedApplicant(added.db, app.id, actor, app, undefined, null)).rejects.toThrow("Directory record changed");
    expect(added.writes).toEqual([]);
  });
  it("blocks ineligible applicants even without conflicts and preserves manager access", async () => {
    const bad = { ...app, status: "rejected" };
    expect((await preflightHireSignedApplicant(harness([[bad], [offer], [], [bad]]).db, app.id, actor)).eligible).toBe(false);
    const manager = { ...app, role: "Operations Manager" }, managerOffer = { ...offer, role: manager.role };
    const preview = await preflightHireSignedApplicant(harness([[manager], [managerOffer], [], [manager]]).db, app.id, actor);
    expect(preview.eligible).toBe(true);
    await expect(hireSignedApplicant(harness([[manager], [], [managerOffer], [manager]]).db, app.id, actor, manager, undefined, null)).resolves.toMatchObject({ portalAccessLevel: "operations_manager" });
  });
  it("permits 100 reviewed matches but rejects 101 before audit evidence is written", async () => {
    const duplicates = Array.from({ length: 101 }, (_, i) => ({ ...app, id: 100 + i }));
    const hundred = [app, ...duplicates.slice(0, 100)];
    const preview = await preflightHireSignedApplicant(harness([[app], [offer], [], hundred]).db, app.id, actor);
    expect(preview.canReview).toBe(true);
    const allowed = harness([[app], [], [offer], hundred]);
    await hireSignedApplicant(allowed.db, app.id, actor, app, { token: preview.reviewToken!, acknowledged: true }, null);
    const evidence = allowed.writes.find((write) => write.table === jobApplicationActions)!.values.details;
    expect(Buffer.byteLength(evidence)).toBeLessThan(65535);
    expect(JSON.parse(evidence).duplicateReview.reviewed).toHaveLength(100);
    const all = [app, ...duplicates];
    const blocked = await preflightHireSignedApplicant(harness([[app], [offer], [], all]).db, app.id, actor);
    expect(blocked).toMatchObject({ eligible: false, canReview: false, reviewToken: null, eligibilityReason: expect.stringContaining("Too many") });
    const h = harness([[app], [], [offer], all]);
    await expect(hireSignedApplicant(h.db, app.id, actor, app, undefined, null)).rejects.toThrow("Too many matching applications");
    expect(h.writes).toEqual([]);
  });
});
