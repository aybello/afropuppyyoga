import { createRequire } from "node:module";
import { Parser } from "htmlparser2";
import PDFDocument from "pdfkit";
import {
  createOfferDocumentSnapshot,
  readOfferDocumentSnapshot,
} from "./offerDocumentSnapshot";

export type SignedOfferPdfRecord = {
  id: number;
  applicantName: string;
  role: string;
  location: string;
  signedName: string | null;
  signedAt: Date | null;
  createdAt: Date;
  signedDocumentSnapshot?: string | null;
  offerLetterType: string;
  puppyMonitorShiftPayCad?: number | null;
  movementInstructorHourlyPayCad?: number | null;
  socialMediaHourlyPayCad?: number | null;
};

// Explicit allowlist: the frozen V1 renderer otherwise falls through to Puppy Monitor.
const OFFER_TYPES = new Set([
  "puppy_monitor_kw",
  "puppy_monitor_hamilton",
  "yoga_instructor",
  "movement_instructor",
  "puppy_specialist",
  "operations_specialist",
  "operations_manager",
  "bdr",
  "social_media_intern",
  "social_media_specialist",
]);
const RECONSTRUCTION_WARNING =
  "Reconstructed copy. Original signed document snapshot was not retained. Wording may differ from the original.";
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "table",
  "tr",
  "td",
  "th",
  "dl",
  "dt",
  "dd",
  "hr",
  "br",
]);
const NON_DOCUMENT_TAGS = new Set(["script", "style", "template", "head"]);
// RGI_Emoji matches whole emoji sequences, not ordinary digits, punctuation or accents.
// Construct dynamically so TypeScript's compilation target need not enable /v literals.
const EMOJI = new RegExp("\\p{RGI_Emoji}", "gv");
const require = createRequire(import.meta.url);

function pdfText(text: string): string {
  return text.replace(EMOJI, "").replace(/\s+/g, " ").trim();
}

/** Parse HTML as inert text. Never execute markup, load URLs, or reinterpret decoded text. */
function htmlParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  let pending = "";
  let suppressedDepth = 0;
  const flush = () => {
    const text = pdfText(pending);
    if (text) paragraphs.push(text);
    pending = "";
  };
  const parser = new Parser(
    {
      onopentag(tag) {
        if (suppressedDepth > 0) {
          suppressedDepth++;
          return;
        }
        if (NON_DOCUMENT_TAGS.has(tag)) {
          flush();
          suppressedDepth = 1;
        } else if (BLOCK_TAGS.has(tag)) {
          flush();
        }
      },
      ontext(text) {
        if (!suppressedDepth) pending += text;
      },
      onclosetag(tag) {
        if (suppressedDepth > 0) {
          suppressedDepth--;
        } else if (BLOCK_TAGS.has(tag)) {
          flush();
        }
      },
    },
    { decodeEntities: true }
  );
  parser.end(html);
  flush();
  return paragraphs;
}

function torontoTime(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Produces private bytes only. The caller must authenticate/authorize the download.
 * A null snapshot is explicitly reconstructed, never represented as an archival original.
 */
export async function buildSignedOfferPdf(
  record: SignedOfferPdfRecord
): Promise<Buffer> {
  if (
    !record.signedName?.trim() ||
    !(record.signedAt instanceof Date) ||
    !Number.isFinite(record.signedAt.getTime())
  ) {
    throw new Error(
      "A recorded signature name and valid signing time are required for a signed offer PDF."
    );
  }
  if (!Number.isSafeInteger(record.id) || record.id <= 0) {
    throw new Error("A valid signing record ID is required.");
  }
  if (!OFFER_TYPES.has(record.offerLetterType)) {
    throw new Error(
      "Unsupported offer letter type. No approved signed offer PDF is available."
    );
  }

  const reconstructed = record.signedDocumentSnapshot == null;
  // Empty, malformed, unsupported or tampered non-null snapshots must fail closed.
  // Do not regenerate retained documents using today's scalar fields or templates.
  const snapshot = reconstructed
    ? createOfferDocumentSnapshot(record)
    : readOfferDocumentSnapshot(record.signedDocumentSnapshot!);
  const offerParagraphs = htmlParagraphs(snapshot.offerHtml);
  const ndaParagraphs = htmlParagraphs(snapshot.ndaHtml);
  if (!offerParagraphs.length || !ndaParagraphs.length) {
    throw new Error(
      "The saved offer and NDA must both contain readable document text."
    );
  }

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: reconstructed ? 112 : 76, bottom: 54, left: 54, right: 54 },
    bufferPages: true,
    info: {
      Title: reconstructed
        ? "Reconstructed offer and NDA - recorded signing details"
        : "Signed offer and NDA - retained document copy",
      Author: "AfroPuppyYoga",
      Subject: `Signing record ${record.id}`,
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  try {
    let regular = "Helvetica";
    let bold = "Helvetica-Bold";
    // Reuse fonts already distributed with the installed PDF dependency; no font downloads.
    // Helvetica remains a portable fallback if that dependency changes its packaging.
    try {
      const regularPath = require.resolve(
        "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"
      );
      const boldPath = require.resolve(
        "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf"
      );
      doc.registerFont("OfferSans", regularPath);
      doc.registerFont("OfferSans-Bold", boldPath);
      regular = "OfferSans";
      bold = "OfferSans-Bold";
    } catch {
      // PDFKit's built-in Helvetica preserves common Latin accents and punctuation.
    }

    const width = doc.page.width - 108;
    const paragraph = (text: string) => {
      doc
        .font(regular)
        .fontSize(10.5)
        .fillColor("#171717")
        .text(pdfText(text), { width, lineGap: 3, paragraphGap: 8 });
    };
    const heading = (text: string) => {
      doc
        .font(bold)
        .fontSize(15)
        .fillColor("#171717")
        .text(text, { width, paragraphGap: 12 });
    };

    heading(
      reconstructed
        ? "Reconstructed document copy"
        : "Retained signed-document copy"
    );
    if (reconstructed) {
      paragraph(
        "The saved signing record remains intact and is not changed by this reconstruction. The recorded signature details are separate from the reconstructed wording; this copy is not proof of the exact wording originally displayed or accepted."
      );
      paragraph(
        "Source: frozen V1 offer and NDA templates populated from the saved offer fields. No original signed document snapshot was retained."
      );
      paragraph(
        `Reconstruction document date supplied from saved offer creation time (createdAt): ${torontoTime(record.createdAt)} (America/Toronto). Dates printed in the reconstructed offer and NDA come from that saved creation time, not a known or proven date originally displayed to the signer.`
      );
    } else {
      paragraph(
        `Archival source: retained signed-document snapshot, version ${snapshot.version}. The offer and NDA are plain-paragraph renderings of the exact stored HTML; only decorative emoji are omitted from the PDF, not from the retained snapshot.`
      );
      paragraph(
        `Retained snapshot document date (source metadata): ${snapshot.documentDate}`
      );
      paragraph("Verified snapshot SHA-256 (content-integrity checksum):");
      paragraph(snapshot.sha256);
      paragraph(
        "The checksum verifies consistency of the stored snapshot. It is not a cryptographic digital signature or independent proof of signer identity."
      );
    }

    doc.addPage();
    heading(
      reconstructed
        ? "Offer letter - reconstructed wording"
        : "Offer letter - retained snapshot"
    );
    for (const text of offerParagraphs) paragraph(text);

    doc.addPage();
    heading(
      reconstructed ? "NDA - reconstructed wording" : "NDA - retained snapshot"
    );
    for (const text of ndaParagraphs) paragraph(text);

    doc.addPage();
    heading("Recorded signing details");
    paragraph(`Signing record ID: ${record.id}`);
    paragraph(`Recorded signature name: ${record.signedName}`);
    paragraph(
      `Recorded signing time: ${torontoTime(record.signedAt)} (America/Toronto)`
    );
    paragraph(
      reconstructed
        ? "These are the saved signing details, not a new signature on the reconstructed wording. The saved signing record remains intact; the exact original document wording was not retained."
        : "These are the saved signing details associated with the retained document snapshot, not a new signature on this generated PDF."
    );
    paragraph(
      "This PDF is a readable record copy, not a cryptographically digitally signed PDF."
    );

    // Stamp after layout so automatic page breaks never overwrite or omit the warning.
    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
      doc.switchToPage(page);
      doc
        .font(bold)
        .fontSize(10)
        .fillColor("#171717")
        .text("AfroPuppyYoga | Offer and NDA record copy", 54, 25, {
          lineBreak: false,
        });
      if (reconstructed) {
        doc
          .font(bold)
          .fontSize(10)
          .fillColor("#9B1C1C")
          .text(RECONSTRUCTION_WARNING, 54, 44, { width, lineGap: 2 });
      } else {
        doc
          .font(regular)
          .fontSize(9)
          .fillColor("#444444")
          .text(
            "Source: retained, checksum-verified document snapshot",
            54,
            44,
            { lineBreak: false }
          );
      }
      doc
        .font(regular)
        .fontSize(8)
        .fillColor("#444444")
        .text(
          `Signing record ${record.id} | Page ${page - pages.start + 1} of ${pages.count}`,
          54,
          doc.page.height - 32,
          { lineBreak: false }
        );
    }
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error(String(error)));
  }
  return result;
}
