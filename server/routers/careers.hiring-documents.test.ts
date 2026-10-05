import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getJobApplicationById: vi.fn(), getDb: vi.fn(), claimInitialOnboardingDelivery: vi.fn(), completeClaimedOnboardingDocumentDelivery: vi.fn(), releaseInitialOnboardingDeliveryClaim: vi.fn(), sendEmail: vi.fn(), notifyOwner: vi.fn(), resolveApyAccess: vi.fn() }));
vi.mock("../db", () => mocks);
vi.mock("../apyAccess", () => ({ resolveApyAccess: mocks.resolveApyAccess }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("../email", async (original) => ({ ...await original<typeof import("../email")>(), sendEmail: mocks.sendEmail }));
import { careersRouter } from "./careers";
const caller = () => careersRouter.createCaller({ user: { id: 1, name: "Owner", email: "owner@example.com" } } as any);
const employee = { id: 42, name: "Fictional Employee", email: "fictional@example.com", role: "Yoga Instructor", location: "OAK", status: "onboarded", isTeamMember: true, onboardingSentAt: null, onboardingDeliveryToken: null };
let active: boolean;
beforeEach(() => {
  vi.clearAllMocks(); active = true;
  mocks.getJobApplicationById.mockResolvedValue(employee);
  mocks.resolveApyAccess.mockResolvedValue({ level: "owner", canManageOperations: true });
  mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => active ? [{ id: 7 }] : [] }) }) }), insert: () => ({ values: async () => [{}] }) });
  mocks.claimInitialOnboardingDelivery.mockResolvedValue("fictional-claim");
  mocks.completeClaimedOnboardingDocumentDelivery.mockResolvedValue(true);
  mocks.releaseInitialOnboardingDeliveryClaim.mockResolvedValue(true);
  mocks.sendEmail.mockResolvedValue(undefined);
});
describe("onboarding after adding employee", () => {
  it("sends the first documents to an already-added employee with real sign-in/training links", async () => {
    await caller().sendOnboardingEmail({ id: 42 });
    expect(mocks.claimInitialOnboardingDelivery).toHaveBeenCalledWith(42);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: employee.email, text: expect.stringContaining("https://afropuppyyoga.ca/staff-access") }));
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain("https://afropuppyyoga.ca/staff/training");
    expect(mocks.completeClaimedOnboardingDocumentDelivery).toHaveBeenCalledWith(42, "fictional-claim");
  });
  it.each(["Movement Instructor", "Operations Specialist"])("uses the correct first-send and resend onboarding for %s in Guelph", async (role) => {
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, role, location: "GUE" });
    await caller().sendOnboardingEmail({ id: 42 });
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain(role);
    expect(mocks.sendEmail.mock.calls[0][0].text).not.toContain("Yoga Instructor Guide");
    expect(mocks.sendEmail.mock.calls[0][0].text).not.toContain("PM Availability");
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, role, location: "GUE", onboardingSentAt: new Date() });
    await caller().resendOnboardingEmail({ id: 42 });
    expect(mocks.sendEmail.mock.calls[1][0].text).toContain(role);
    expect(mocks.sendEmail.mock.calls[1][0].text).toContain("/staff/training");
  });
  it("does not send documents before the signed applicant is added, or after they leave", async () => {
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, status: "accepted" });
    await expect(caller().sendOnboardingEmail({ id: 42 })).rejects.toThrow("Add the signed applicant");
    mocks.getJobApplicationById.mockResolvedValue(employee); active = false;
    await expect(caller().sendOnboardingEmail({ id: 42 })).rejects.toThrow("Activate this employee");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("does not retry when another initial delivery or resend owns the claim", async () => {
    mocks.claimInitialOnboardingDelivery.mockResolvedValue(null);
    await expect(caller().sendOnboardingEmail({ id: 42 })).rejects.toThrow("already being sent");
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, onboardingSentAt: new Date() });
    await expect(caller().resendOnboardingEmail({ id: 42 })).rejects.toThrow("pending");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("preserves the claim when the provider outcome is unknown", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Provider timed out"));
    await expect(caller().sendOnboardingEmail({ id: 42 })).rejects.toThrow("Resolve Pending Onboarding");
    expect(mocks.completeClaimedOnboardingDocumentDelivery).not.toHaveBeenCalled();
    expect(mocks.releaseInitialOnboardingDeliveryClaim).not.toHaveBeenCalled();
  });
  it("claims resends and records delivery without changing employment or training", async () => {
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, onboardingSentAt: new Date() });
    await caller().resendOnboardingEmail({ id: 42 });
    expect(mocks.claimInitialOnboardingDelivery).toHaveBeenCalledWith(42, true);
    expect(mocks.completeClaimedOnboardingDocumentDelivery).toHaveBeenCalledWith(42, "fictional-claim");
  });
  it.each(["accepted", "onboarded"])("reconciles historical pending %s delivery without changing its status or resending", async (status) => {
    mocks.getJobApplicationById.mockResolvedValue({ ...employee, status, onboardingDeliveryToken: "prior-claim" });
    await expect(caller().reconcileOnboardingDelivery({ id: 42, outcome: "delivered" })).resolves.toMatchObject({ status });
    expect(mocks.completeClaimedOnboardingDocumentDelivery).toHaveBeenCalledWith(42, "prior-claim");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
