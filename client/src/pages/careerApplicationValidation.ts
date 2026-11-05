import { z } from "zod";

export const WHY_APY_LIMIT = 2000;
export const EXPERIENCE_LIMIT = 1000;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const emailSchema = z.string().email();

export function validateVideoFile(file: { name: string; size: number }): string | null {
  if (!/\.(mp4|mov|webm|avi)$/i.test(file.name)) {
    return "Unsupported video format. Choose an MP4, MOV, WebM, or AVI file, or use Paste a Link for a viewable video link.";
  }
  if (file.name.length > 255) return "Please rename your video file to 255 characters or fewer.";
  if (file.size === 0) return "Your video file is empty. Please choose another video or paste a video link.";
  if (file.size > MAX_VIDEO_SIZE) return "Video must be 500MB or smaller.";
  return null;
}

export function validateVideoLink(value: string): string | null {
  const link = value.trim();
  if (!link) return "A video introduction is required. Please upload a video or paste a link.";
  try {
    const url = new URL(link);
    if (!link.startsWith("https://") || url.protocol !== "https:") {
      return "Please use a secure https:// video link.";
    }
    // The server currently rejects this exact substring anywhere in the URL.
    // Also retain the existing hostname check for case-insensitive URL hosts.
    if (link.includes("linkedin.com") || url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) {
      return "This link can't be accepted because it contains linkedin.com. Please use a viewable YouTube, Google Drive, Dropbox, Loom, or similar video link.";
    }
  } catch {
    return "Please enter a valid secure video URL (e.g. a YouTube, Google Drive, Dropbox, or Loom link).";
  }
  return null;
}

type ApplicationInput = {
  form: { name: string; email: string; phone: string; whyAPY: string; experience: string };
  resumeFile: { name: string; size: number } | null;
  videoMode: "upload" | "link";
  videoFile: { name: string; size: number } | null;
  videoLink: string;
};

export function validateCareerApplication({ form, resumeFile, videoMode, videoFile, videoLink }: ApplicationInput): string | null {
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) return "Please enter your full name.";
  if (name.length > 200) return "Your name must be 200 characters or fewer.";
  if (!email) return "Please enter your email address.";
  if (!emailSchema.safeParse(email).success) return "Please enter a valid email address, such as name@example.com.";
  if (form.phone.length > 50) return "Your phone number must be 50 characters or fewer.";
  if (form.whyAPY.length > WHY_APY_LIMIT) return `Why APY must be ${WHY_APY_LIMIT} characters or fewer (currently ${form.whyAPY.length}).`;
  if (form.experience.length > EXPERIENCE_LIMIT) return `Relevant Experience must be ${EXPERIENCE_LIMIT} characters or fewer (currently ${form.experience.length}).`;
  if (!resumeFile) return "A resume is required. Please upload your resume (PDF or Word).";
  if (videoMode === "link") return validateVideoLink(videoLink);
  if (!videoFile) return "A video introduction is required. Please upload a video or paste a link.";
  return validateVideoFile(videoFile);
}
