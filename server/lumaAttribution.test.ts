import { afterEach, describe, expect, it, vi } from "vitest";
import { appendAttributionToLumaUrl } from "../client/src/lib/lumaAttribution";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
});

describe("appendAttributionToLumaUrl", () => {
  it("carries Meta click and browser identifiers into Luma UTM fields", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          search: "?fbclid=click-123&utm_campaign=fall-classes&utm_content=video-a",
        },
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "_fbp=fb.1.1799999999.browser-456" },
    });

    const result = new URL(appendAttributionToLumaUrl("https://lu.ma/afropuppyyoga"));
    expect(result.searchParams.get("utm_source")).toBe("facebook");
    expect(result.searchParams.get("utm_medium")).toBe("paid_social");
    expect(result.searchParams.get("utm_campaign")).toBe("fall-classes");
    expect(result.searchParams.get("utm_content")).toBe(
      "video-a|apy_fbc=fb.1.1800000000000.click-123|apy_fbp=fb.1.1799999999.browser-456",
    );
  });

  it("returns the original URL during server rendering", () => {
    expect(appendAttributionToLumaUrl("https://lu.ma/afropuppyyoga"))
      .toBe("https://lu.ma/afropuppyyoga");
  });
});
