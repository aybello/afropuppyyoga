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
    signing: {
      createSigningRequest: {
        useMutation: (options: typeof mocks.mutationOptions) => {
          mocks.mutationOptions = options;
          return { mutate: mocks.mutate, isPending: false, isError: false };
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

import { OfferLetterModal } from "../client/src/pages/ApplicationsDashboard";

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
  status: "accepted",
  onboardingSentAt: null,
  onboardingDeliveryToken: null,
  createdAt: new Date("2026-10-01T12:00:00Z"),
  signingStatus: null,
  signedName: null,
  signedAt: null,
};

function render(phone: unknown = baseApp.phone) {
  return renderToStaticMarkup(createElement(OfferLetterModal, {
    app: { ...baseApp, phone } as Parameters<typeof OfferLetterModal>[0]["app"],
    open: true,
    onClose: vi.fn(),
  }));
}

function delivery(email: "sent" | "unknown" | "failed", sms: "queued" | "sent" | "delivered" | "skipped" | "failed" | "unknown", extras: Record<string, unknown> = {}) {
  return {
    email: { status: email },
    sms: { status: sms },
    signingLink: "https://private.example/sign/secret-token",
    expiresAt: new Date("2026-10-28T12:00:00Z"),
    ...extras,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutationOptions = null;
});

describe("OfferLetterModal", () => {
  it("unmounts when closed without installing hooks or sending", () => {
    const html = renderToStaticMarkup(createElement(OfferLetterModal, {
      app: baseApp as Parameters<typeof OfferLetterModal>[0]["app"],
      open: false,
      onClose: vi.fn(),
    }));

    expect(html).toBe("");
    expect(mocks.mutationOptions).toBeNull();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("shows the saved email and formatted phone without sending", () => {
    const html = render();

    expect(html).toContain(baseApp.email);
    expect(html).toContain("+1 (416) 555-0100");
    expect(html).toContain("Send Email + Text");
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each([null, "not-a-phone", "1234567890"])("uses email only for an invalid saved phone (%s), never an owner fallback", (phone) => {
    const html = render(phone);

    expect(html).toContain("No valid saved phone number. Email only.");
    expect(html).not.toContain("289-788-1885");
    expect(html).not.toContain("+1 (289) 788-1885");
  });

  it("states that email and text use the same private link and signed documents and compensation stay untouched", () => {
    const html = render();

    expect(html).toContain("The text uses the same private signing link as the email.");
    expect(html).toContain("Existing signed documents and compensation are not changed.");
  });

  it("reports queued text as not delivered and invalidates the application list and its timeline", () => {
    render();
    mocks.mutationOptions!.onSuccess(delivery("sent", "queued"));

    expect(mocks.success).toHaveBeenCalledWith(
      "Email accepted for sending. Text queued, not yet confirmed delivered.",
    );
    expect(mocks.success.mock.calls[0][0]).not.toContain("delivery confirmed");
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.listInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledWith({ id: baseApp.id });
  });

  it("warns on partial delivery failure and still invalidates the list and applicant timeline", () => {
    render();
    mocks.mutationOptions!.onSuccess(delivery("sent", "failed"));

    expect(mocks.warning).toHaveBeenCalledWith(
      "Email accepted for sending. Text was not sent. The provider rejected the text.",
      { duration: 12000 },
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.listInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledWith({ id: baseApp.id });
  });

  it("does not claim success when both delivery outcomes are unknown", () => {
    render();
    mocks.mutationOptions!.onSuccess(delivery("unknown", "unknown"));

    expect(mocks.warning).toHaveBeenCalledWith(
      "Email outcome unconfirmed. Check the APY Sent folder before sending again. Text outcome unconfirmed. Check delivery history before sending again.",
      { duration: 12000 },
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.listInvalidate).toHaveBeenCalledOnce();
    expect(mocks.timelineInvalidate).toHaveBeenCalledWith({ id: baseApp.id });
  });

  it("sanitizes mutation errors without exposing raw provider errors or signing tokens", () => {
    render();
    mocks.mutationOptions!.onError(new Error("Twilio 500 for token secret-signing-token"));

    expect(mocks.error).toHaveBeenCalledWith(
      "The offer send could not be confirmed. Retry here to keep the same attempt. A channel not yet attempted may send; an existing send will not repeat.",
    );
    expect(mocks.error.mock.calls[0][0]).not.toContain("Twilio 500");
    expect(mocks.error.mock.calls[0][0]).not.toContain("secret-signing-token");
    expect(mocks.listInvalidate).not.toHaveBeenCalled();
    expect(mocks.timelineInvalidate).not.toHaveBeenCalled();
  });
});
