import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { getOfferLetterContent, getNDAContent } from "../shared/offerDocumentContentV1";

export type OfferDocumentSource = {
  applicantName: string;
  role: string;
  location: string;
  offerLetterType: string;
  puppyMonitorShiftPayCad?: number | null;
  movementInstructorHourlyPayCad?: number | null;
  socialMediaHourlyPayCad?: number | null;
  createdAt: Date;
};
const snapshotSchema = z.object({
  version: z.literal(1),
  documentDate: z.string().datetime(),
  offerHtml: z.string().min(1).max(50000),
  ndaHtml: z.string().min(1).max(30000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type OfferDocumentSnapshot = z.infer<typeof snapshotSchema>;
function digest(content: Omit<OfferDocumentSnapshot, "sha256">) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
/** Only call for an unsigned record or an explicitly labelled legacy reconstruction. */
export function createOfferDocumentSnapshot(record: OfferDocumentSource): OfferDocumentSnapshot {
  if (!["puppy_monitor_kw", "puppy_monitor_hamilton", "yoga_instructor", "movement_instructor", "puppy_specialist", "operations_specialist", "operations_manager", "bdr", "social_media_intern", "social_media_specialist"].includes(record.offerLetterType)) {
    throw new Error("No approved offer letter exists for this document type.");
  }
  const documentDate = new Date(record.createdAt).toISOString();
  const content = {
    version: 1 as const,
    documentDate,
    offerHtml: renderToStaticMarkup(getOfferLetterContent(record.applicantName, record.role, record.location,
      record.offerLetterType, record.puppyMonitorShiftPayCad, record.movementInstructorHourlyPayCad,
      record.socialMediaHourlyPayCad, documentDate)),
    ndaHtml: renderToStaticMarkup(getNDAContent(record.applicantName, record.role, documentDate)),
  };
  return { ...content, sha256: digest(content) };
}
/** Never silently replace a corrupt or unsupported saved snapshot with today's template. */
export function readOfferDocumentSnapshot(value: string): OfferDocumentSnapshot {
  const parsed = snapshotSchema.parse(JSON.parse(value));
  const { sha256, ...content } = parsed;
  if (digest(content) !== sha256) throw new Error("The saved document could not be verified. Please contact APY.");
  return parsed;
}
