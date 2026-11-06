import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  submitted: false,
  stateCalls: 0,
}));

// SSR gives the normal signed-page render; override only the fourth state hook to
// exercise the immediate post-submit branch without a browser or network.
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => {
      const state = react.useState(initial);
      mocks.stateCalls += 1;
      return mocks.stateCalls === 4 && mocks.submitted ? [true, state[1]] : state;
    },
  };
});
vi.mock("@/lib/trpc", () => ({ trpc: {
  signing: {
    getSigningRequest: { useQuery: () => ({ data: mocks.data, isLoading: false }) },
    submitSignature: { useMutation: () => ({ mutate: vi.fn() }) },
  },
  staffDocuments: { downloadFromSigningLink: { useMutation: () => ({ mutate: vi.fn() }) } },
  useUtils: () => ({ signing: { getSigningRequest: { invalidate: vi.fn() } } }),
} }));

import SignDocuments from "../../client/src/pages/SignDocuments";

beforeEach(() => {
  mocks.stateCalls = 0;
  mocks.submitted = false;
  mocks.data = {
    signed: true,
    signedName: "Alexia Example",
    signedAt: new Date("2026-11-01T12:00:00Z"),
    role: "Puppy Monitor",
    location: "Hamilton",
    privateStaffNotes: "PRIVATE_STAFF_NOTE",
    phone: "PRIVATE_PHONE",
  };
  vi.stubGlobal("window", { location: { search: "?token=fictional" } });
});
afterEach(() => vi.unstubAllGlobals());

describe("signing confirmation page", () => {
  it.each(["already signed", "just submitted"])('shows neutral copy when %s', state => {
    if (state === "just submitted") {
      mocks.data.signed = false;
      mocks.data.signedName = null;
      mocks.submitted = true;
    }
    const html = renderToStaticMarkup(createElement(SignDocuments));
    expect(html).toContain("Documents Signed!");
    expect(html).toMatch(/Offer Letter and NDA have been signed and received by\s*AfroPuppyYoga/);
    expect(html).toContain("Please contact us if you have any questions.");
    expect(html).not.toMatch(/onboarding|orientation|welcome to the (?:pack|family)|join(?:ing)? (?:the|our) team/i);
    expect(html).not.toContain("PRIVATE_STAFF_NOTE");
    expect(html).not.toContain("PRIVATE_PHONE");
    expect(html).toContain("Download signed offer and NDA");
  });

  it("escapes the displayed signed name", () => {
    mocks.data.signedName = "<img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(createElement(SignDocuments));
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
