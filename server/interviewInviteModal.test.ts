import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutationOptions: null as null | {
    onSuccess: (result: any) => void;
    onError: (error: Error) => void;
  },
  mutate: vi.fn(),
  listInvalidate: vi.fn(),
  timelineInvalidate: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin" }, loading: false }),
}));
vi.mock("../client/src/components/AdminNav", () => ({ default: () => null }));
vi.mock("../client/src/components/AddApplicantEmployeeDialog", () => ({ default: () => null }));
vi.mock("../client/src/components/ui/dialog", () => {
  const Primitive = ({ children }: { children?: unknown }) => children;
  return {
    Dialog: Primitive,
    DialogContent: Primitive,
    DialogHeader: Primitive,
    DialogTitle: Primitive,
    DialogDescription: Primitive,
    DialogFooter: Primitive,
    useDialogComposition: () => ({}),
  };
});
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      careers: {
        list: { invalidate: mocks.listInvalidate },
        getTimeline: { invalidate: mocks.timelineInvalidate },
      },
    }),
    careers: {
      sendInterviewInvite: {
        useMutation: (options: typeof mocks.mutationOptions) => {
          mocks.mutationOptions = options;
          return { mutate: mocks.mutate, isPending: false };
        },
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}));

import { InterviewInviteModal } from "../client/src/pages/ApplicationsDashboard";

const baseApp = {
  id: 42,
  name: "Fictional Applicant",
  email: "fiction@example.com",
  phone: "4165550100",
  role: "Puppy Monitor",
  location: "Kitchener",
  whyAPY: null,
  experience: null,
  videoUrl: null,
  videoKey: null,
  resumeUrl: null,
  resumeKey: null,
  status: "shortlisted",
  onboardingSentAt: null,
  onboardingDeliveryToken: null,
  createdAt: new Date("2026-10-01T12:00:00Z"),
  signingStatus: null,
  signedName: null,
  signedAt: null,
};

function render(phone: unknown = baseApp.phone) {
  return renderToStaticMarkup(createElement(InterviewInviteModal, {
    app: { ...baseApp, phone } as Parameters<typeof InterviewInviteModal>[0]["app"],
    open: true,
    onClose: vi.fn(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutationOptions = null;
});

describe("InterviewInviteModal", () => {
  it("renders the saved applicant phone and explains the two delivery channels without sending", () => {
    const html = render();

    expect(html).toContain("+1 (416) 555-0100");
    expect(html).toContain("The text uses the same booking link");
    expect(html).toContain("Additional notes are included in the email only");
    expect(html).toContain("https://calendar.app.google/RdiW9wP2XYVK27g2A");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each([null, "not-a-phone", "1234567890"])("uses email only for an ineligible saved phone (%s), never an owner fallback", (phone) => {
    const html = render(phone);

    expect(html).toContain("No valid saved phone number. Email only.");
    expect(html).not.toContain("289-788-1885");
    expect(html).not.toContain("+1 (289) 788-1885");
  });

  it("reports queued SMS accurately as not delivered and refreshes list and timeline", () => {
    render();
    mocks.mutationOptions!.onSuccess({ email: { status: "sent" }, sms: { status: "queued" } });

    expect(mocks.success).toHaveBeenCalledWith(
      "Email accepted for sending. Text queued, not yet confirmed delivered.",
    );
    expect(mocks.success.mock.calls[0][0]).not.toContain("confirmed by the provider");
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.listInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledWith({ id: baseApp.id });
  });

  it("warns when email succeeds but SMS fails", () => {
    render();
    mocks.mutationOptions!.onSuccess({ email: { status: "sent" }, sms: { status: "failed" } });

    expect(mocks.warning).toHaveBeenCalledWith(
      "Email accepted for sending. Text was not sent. The provider rejected the text.",
      { duration: 12000 },
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.listInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledWith({ id: baseApp.id });
  });

  it("uses honest unconfirmed language when the mutation errors", () => {
    render();
    mocks.mutationOptions!.onError(new Error("request timed out"));

    expect(mocks.error).toHaveBeenCalledWith(
      "The send could not be confirmed: request timed out. Retry here without changing the invitation to check the same attempt.",
    );
    expect(mocks.error.mock.calls[0][0]).not.toMatch(/not sent|failed to send/i);
    expect(mocks.listInvalidate).not.toHaveBeenCalled();
    expect(mocks.timelineInvalidate).not.toHaveBeenCalled();
  });
});
