import { describe, expect, it } from "vitest";
import { STAFF_ACCESS_API_REVISION, systemRouter } from "./systemRouter";

describe("system health", () => {
  it("identifies the active passwordless staff-access API revision without exposing configuration", async () => {
    const caller = systemRouter.createCaller({} as never);
    await expect(caller.health({ timestamp: Date.now() })).resolves.toEqual({
      ok: true,
      staffAccessRevision: STAFF_ACCESS_API_REVISION,
    });
  });
});
