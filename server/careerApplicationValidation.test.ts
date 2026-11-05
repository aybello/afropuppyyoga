import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateCareerApplication, validateVideoFile, validateVideoLink } from "../client/src/pages/careerApplicationValidation";
import { careersRouter } from "./routers/careers";

// Parsing the schema does not execute the mutation or contact the database.
const serverSchema = careersRouter._def.procedures.submitApplication._def.inputs[0];
const serverInput = {
  role: "Puppy Monitor", location: "KW", name: "Applicant Example",
  email: "applicant@example.com", resumeUrl: "https://example.com/resume.pdf",
};

const valid = () => ({
  form: { name: "  Applicant Example  ", email: "  applicant@example.com  ", phone: "", whyAPY: "Motivation", experience: "Experience" },
  resumeFile: { name: "resume.pdf", size: 100 },
  videoMode: "upload" as "upload" | "link",
  videoFile: { name: "intro.mp4", size: 100 },
  videoLink: "",
});

describe("careers form preflight", () => {
  it("accepts exact server limits without trimming or truncating narrative text", () => {
    const input = valid();
    input.form.whyAPY = " ".repeat(2000);
    input.form.experience = " ".repeat(1000);
    input.form.name = "x".repeat(200);
    input.form.phone = "x".repeat(50);
    expect(validateCareerApplication(input)).toBeNull();
    expect(input.form.whyAPY).toHaveLength(2000);
    expect(input.form.experience).toHaveLength(1000);
  });

  it.each([
    ["whyAPY", 2001, /Why APY.*2000.*2001/],
    ["experience", 1001, /Experience.*1000.*1001/],
    ["name", 201, /name.*200/],
    ["phone", 51, /phone.*50/],
  ] as const)("rejects %s over the limit and accepts a correction", (field, length, message) => {
    const input = valid();
    input.form[field] = "x".repeat(length);
    expect(validateCareerApplication(input)).toMatch(message);
    input.form[field] = "x".repeat(length - 1);
    expect(validateCareerApplication(input)).toBeNull();
  });

  it("checks trimmed name and the same email validator used by the server", () => {
    const input = valid();
    input.form.name = "   ";
    expect(validateCareerApplication(input)).toMatch(/full name/i);
    input.form.name = " Applicant ";
    for (const email of ["bad", "user@", "x@foo", "a b@example.com", "name..x@example.com"]) {
      input.form.email = ` ${email} `;
      expect(z.string().email().safeParse(email).success).toBe(false);
      expect(validateCareerApplication(input)).toMatch(/valid email/i);
    }
    input.form.email = " applicant@example.com ";
    expect(validateCareerApplication(input)).toBeNull();
    expect(input.form.email).toBe(" applicant@example.com ");
  });

  it("requires both a resume and either a video file or a video link", () => {
    const input = valid();
    input.resumeFile = null as never;
    expect(validateCareerApplication(input)).toMatch(/resume is required/i);
    input.resumeFile = { name: "resume.pdf", size: 100 };
    input.videoFile = null as never;
    expect(validateCareerApplication(input)).toMatch(/video introduction is required/i);
    input.videoMode = "link";
    expect(validateCareerApplication(input)).toMatch(/video introduction is required/i);
    input.videoLink = " https://example.com/video ";
    expect(validateCareerApplication(input)).toBeNull();
  });

  it.each(["intro.mp4", "INTRO.MOV", "intro.webm", "intro.AVI"])("accepts %s within the 500MB limit", name => {
    expect(validateVideoFile({ name, size: 500 * 1024 * 1024 })).toBeNull();
  });

  it("rejects unsupported, empty, oversized and overlong video files with actionable guidance", () => {
    expect(validateVideoFile({ name: "intro.mkv", size: 100 })).toMatch(/MP4, MOV, WebM, or AVI.*Paste a Link/);
    expect(validateVideoFile({ name: "intro.mp4", size: 500 * 1024 * 1024 + 1 })).toMatch(/500MB/);
    expect(validateVideoFile({ name: "intro.mp4", size: 0 })).toMatch(/empty/);
    expect(validateVideoFile({ name: "x".repeat(252) + ".mp4", size: 1 })).toMatch(/255/);
  });

  it("matches the server's literal LinkedIn restriction and preserves hostname rejection", () => {
    const serverRule = (videoUrl: string) => serverSchema.safeParse({ ...serverInput, videoUrl }).success;
    for (const link of ["https://linkedin.com/in/name", "https://www.linkedin.com/video", "https://example.com/video?source=linkedin.com", "https://notlinkedin.com/video"]) {
      expect(serverRule(link)).toBe(false);
      expect(validateVideoLink(link)).toMatch(/linkedin\.com/);
    }
    expect(validateVideoLink("https://WWW.LINKEDIN.COM/video")).toMatch(/linkedin\.com/);
    expect(validateVideoLink("http://example.com/video")).toMatch(/https/);
    expect(validateVideoLink("not a url")).toMatch(/valid secure/);
    expect(serverRule("https://example.com/video")).toBe(true);
    expect(validateVideoLink("https://example.com/video")).toBeNull();
  });

  it("integrates preflight before any upload, with trimmed identity and no narrative truncation", () => {
    const source = readFileSync(new URL("../client/src/pages/Careers.tsx", import.meta.url), "utf8");
    const submit = source.slice(source.indexOf("  const handleSubmit ="), source.indexOf("  return (\n    <div className=\"fixed"));
    expect(submit).toMatch(/const validationError = validateCareerApplication\([\s\S]*?if \(validationError\) \{[\s\S]*?setError\(validationError\);[\s\S]*?return;/);
    expect(submit.indexOf("validateCareerApplication(")).toBeLessThan(submit.indexOf('fetch("/api/upload-video-init"'));
    expect(submit.indexOf("validateCareerApplication(")).toBeLessThan(submit.indexOf('"/api/upload-resume"'));
    expect(submit).toContain("name: form.name.trim()");
    expect(submit).toContain("email: form.email.trim()");
    expect(submit).toContain("whyAPY: form.whyAPY || undefined");
    expect(submit).toContain("experience: form.experience || undefined");
    expect(source).toContain('accept=".mp4,.mov,.webm,.avi"');
    expect(source).toContain("const fileError = validateVideoFile(file)");
  });
});
