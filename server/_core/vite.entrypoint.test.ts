import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("development Vite entrypoint", () => {
  it("does not append a per-request query token to the client module entry", () => {
    const source = readFileSync(resolve(import.meta.dirname, "vite.ts"), "utf8");

    expect(source).not.toContain('src="/src/main.tsx?v=${nanoid()}"');
    expect(source).not.toContain('from "nanoid"');
    expect(source).toContain('typeof viteConfig === "function"');
    expect(source).toContain('command: "serve"');
  });
});
