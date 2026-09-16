import { describe, expect, it } from "vitest";
import {
  PUBLIC_DEFERRED_SECTION_MARGIN,
  shouldRenderDeferredSection,
} from "../shared/deferredSection";

describe("public deferred-section policy", () => {
  it("leaves below-the-fold sections unmounted until they approach the viewport", () => {
    expect(shouldRenderDeferredSection(false)).toBe(false);
    expect(shouldRenderDeferredSection(true)).toBe(true);
  });

  it("uses a near-view margin to avoid a blank scroll transition", () => {
    expect(PUBLIC_DEFERRED_SECTION_MARGIN).toBe("500px 0px");
  });
});
