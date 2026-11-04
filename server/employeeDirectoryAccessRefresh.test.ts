import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: [] as any[], cursor: 0, data: [] as any[], refetch: vi.fn(), mutate: vi.fn(), invalidate: vi.fn(),
  callbacks: {} as any, toastError: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual,
    useState: (initial: any) => {
      const index = mocks.cursor++;
      if (!(index in mocks.state)) mocks.state[index] = typeof initial === "function" ? initial() : initial;
      return [mocks.state[index], (value: any) => { mocks.state[index] = typeof value === "function" ? value(mocks.state[index]) : value; }];
    },
    useRef: (initial: any) => {
      const index = mocks.cursor++;
      if (!(index in mocks.state)) mocks.state[index] = { current: initial };
      return mocks.state[index];
    },
    useEffect: () => {},
  };
});
vi.mock("wouter", async (importOriginal) => ({ ...(await importOriginal<typeof import("wouter")>()), useSearch: () => "", useLocation: () => ["/admin/employees", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ staffAvailability: { listEmployees: { invalidate: mocks.invalidate }, getOrgChart: { invalidate: mocks.invalidate }, getWeekendCoverage: { invalidate: mocks.invalidate } }, puppySchedule: { listWithStaffing: { invalidate: mocks.invalidate } }, staff: { listStaff: { invalidate: mocks.invalidate } } }),
  staffAvailability: {
    listEmployees: { useQuery: () => ({ data: mocks.data, error: null, isLoading: false, refetch: mocks.refetch }) },
    getOrgChart: { useQuery: () => ({ data: { leaves: [] }, error: null }) },
    ...Object.fromEntries(["reactivateTeamMember", "updateEmployeeRecord", "createEmployeeRecord", "provisionEmployeeApyHqAccess", "markEmployeeDeparted", "reactivateEmployeeEmployment", "deleteFormerEmployeeRecord"].map((name) => [name, { useMutation: (options: any) => { if (name === "updateEmployeeRecord") mocks.callbacks = options; return { mutate: mocks.mutate, isPending: false }; } }])),
  },
} }));
import EmployeeDirectory from "../client/src/pages/EmployeeDirectory";

const person = { id: 1, sourceApplicationId: 42, name: "Original", email: "original@example.com", phone: null, role: "Puppy Monitor", location: "KW", employmentStatus: "active", hasApyHqAccess: true, startedAt: "2026-10-01", endedAt: null };
const conflict = "Saving this active employee will enable APY HQ login. Confirm this access change before saving.";
function render() { mocks.cursor = 0; return EmployeeDirectory(); }
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node?.props ? text(node.props.children) : "";
}
const find = (tree: any, test: (node: any) => boolean) => {
  const match = nodes(tree).find(test);
  if (!match) throw new Error("Expected element not found");
  return match;
};
const edit = (tree: any) => find(tree, n => n.type === "button" && text(n).includes("Edit position or details"));
const editForm = (tree: any) => find(tree, n => n.type === "form" && nodes(n).some(x => x.props.name === "name"));
const checkbox = (tree: any) => nodes(tree).find(n => n.type === "input" && n.props.type === "checkbox");
const save = (tree: any) => find(tree, n => n.props.type === "submit" && text(n) === "Save record");
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => { vi.clearAllMocks(); mocks.state = []; mocks.data = [person]; });

describe("Employee Directory access conflict recovery", () => {
  it("refreshes access, preserves draft and requires explicit consent before retry", async () => {
    edit(render()).props.onClick();
    let tree = render();
    const form = editForm(tree);
    const role = find(form, n => n.type === "select" && n.props.name === "role");
    role.props.onChange({ target: { value: "Yoga Instructor" } });
    tree = render();
    const location = find(editForm(tree), n => n.type === "select" && n.props.name === "location");
    location.props.onChange({ target: { value: "OAK" } });
    let resolve!: (result: any) => void;
    mocks.refetch.mockReturnValue(new Promise(r => { resolve = r; }));
    const context = mocks.callbacks.onMutate();
    mocks.callbacks.onError(new Error(conflict), { id: 1 }, context);
    tree = render();
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(save(tree).props.disabled).toBe(true);
    resolve({ isError: false, data: [{ ...person, hasApyHqAccess: false, name: "Server name", role: "Operations Manager" }] });
    await flush();
    tree = render();
    expect(editForm(tree).key).toBe(form.key); // uncontrolled contact fields stay mounted
    expect(find(editForm(tree), n => n.type === "select" && n.props.name === "role").props.value).toBe("Yoga Instructor");
    expect(find(editForm(tree), n => n.type === "select" && n.props.name === "location").props.value).toBe("OAK");
    expect(checkbox(tree).props.checked).toBe(false);
    expect(save(tree).props.disabled).toBe(false);
    const fields = { name: "Edited name", email: "edited@example.com", phone: "123" };
    const originalFormData = globalThis.FormData;
    vi.stubGlobal("FormData", class { constructor(_form: any) {} get(key: keyof typeof fields) { return fields[key]; } });
    editForm(tree).props.onSubmit({ preventDefault() {}, currentTarget: {} });
    expect(mocks.mutate).not.toHaveBeenCalled();
    checkbox(tree).props.onChange({ target: { checked: true } });
    editForm(render()).props.onSubmit({ preventDefault() {}, currentTarget: {} });
    expect(mocks.mutate).toHaveBeenCalledWith({ id: 1, ...fields, role: "Yoga Instructor", location: "OAK", confirmEnableLogin: true });
    vi.stubGlobal("FormData", originalFormData);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it.each([{ isError: true, data: [person] }, { isError: false, data: [] }])("fails closed on an unsuccessful or missing refresh", async result => {
    edit(render()).props.onClick(); render();
    mocks.refetch.mockResolvedValue(result);
    mocks.callbacks.onError(new Error(conflict), { id: 1 }, mocks.callbacks.onMutate());
    await flush();
    let tree = render();
    expect(save(tree).props.disabled).toBe(true);
    expect(text(tree)).toContain("Could not refresh this employee's login access");
    mocks.refetch.mockResolvedValue({ isError: false, data: [{ ...person, hasApyHqAccess: false }] });
    find(tree, n => n.type === "button" && text(n) === "Retry refresh").props.onClick();
    await flush(); tree = render();
    expect(save(tree).props.disabled).toBe(false);
    expect(checkbox(tree).props.checked).toBe(false);
  });
  it("does not apply an old refresh to a newly opened editor", async () => {
    mocks.data = [person, { ...person, id: 2, name: "Other" }];
    edit(render()).props.onClick(); render();
    let resolve!: (result: any) => void;
    mocks.refetch.mockReturnValue(new Promise(r => { resolve = r; }));
    mocks.callbacks.onError(new Error(conflict), { id: 1 }, mocks.callbacks.onMutate());
    const tree = render();
    nodes(tree).filter(n => n.type === "button" && text(n).includes("Edit position or details"))[1].props.onClick();
    resolve({ isError: false, data: [{ ...person, hasApyHqAccess: false }] });
    await flush();
    const current = render();
    expect(editForm(current).key).toBe("2");
    expect(checkbox(current)).toBeUndefined();
    expect(save(current).props.disabled).toBe(false);
  });
  it("reconciles employment status and never carries a prior confirmation through refresh", async () => {
    mocks.data = [{ ...person, hasApyHqAccess: false }];
    edit(render()).props.onClick();
    checkbox(render()).props.onChange({ target: { checked: true } });
    render();
    let resolve!: (result: any) => void;
    mocks.refetch.mockReturnValue(new Promise(r => { resolve = r; }));
    mocks.callbacks.onError(new Error(conflict), { id: 1 }, mocks.callbacks.onMutate());
    let tree = render();
    expect(checkbox(tree).props.checked).toBe(false);
    expect(checkbox(tree).props.disabled).toBe(true);
    resolve({ isError: false, data: [{ ...person, employmentStatus: "inactive", hasApyHqAccess: false }] });
    await flush(); tree = render();
    expect(checkbox(tree)).toBeUndefined();
    expect(save(tree).props.disabled).toBe(false);
    const originalFormData = globalThis.FormData;
    vi.stubGlobal("FormData", class { constructor(_form: any) {} get() { return "test"; } });
    editForm(tree).props.onSubmit({ preventDefault() {}, currentTarget: {} });
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ confirmEnableLogin: false }));
    vi.stubGlobal("FormData", originalFormData);
  });
  it("does not refresh on unrelated errors", () => {
    edit(render()).props.onClick(); render();
    mocks.callbacks.onError(new Error("Different problem"), { id: 1 }, mocks.callbacks.onMutate());
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Different problem");
  });
});
