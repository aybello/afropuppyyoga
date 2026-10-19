import { createHash } from "node:crypto";
import { parseDocument } from "htmlparser2";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import {
  createOfferDocumentSnapshot,
  readOfferDocumentSnapshot,
  type OfferDocumentSnapshot,
} from "./offerDocumentSnapshot";
import {
  buildSignedOfferPdf,
  type SignedOfferPdfRecord,
} from "./signedOfferPdf";

const WARNING =
  "Reconstructed copy. Original signed document snapshot was not retained. Wording may differ from the original.";
const record: SignedOfferPdfRecord = {
  id: 147,
  applicantName: "Zoë François",
  role: "Puppy Monitor",
  location: "Kitchener–Waterloo",
  signedName: "Zoë François",
  signedAt: new Date("2026-07-10T16:23:45.000Z"),
  createdAt: new Date("2026-02-03T02:04:05.000Z"),
  offerLetterType: "puppy_monitor_kw",
  puppyMonitorShiftPayCad: 60,
  movementInstructorHourlyPayCad: 22,
  socialMediaHourlyPayCad: 19,
};
const roles = [
  {
    offerLetterType: "puppy_monitor_kw",
    role: "Puppy Monitor",
    pay: "CA$60.00 per shift",
  },
  {
    offerLetterType: "puppy_monitor_hamilton",
    role: "Puppy Monitor",
    pay: "CA$60.00 per shift",
  },
  {
    offerLetterType: "yoga_instructor",
    role: "Yoga Instructor",
    pay: "$22.00 per hour for teaching yoga classes",
  },
  {
    offerLetterType: "movement_instructor",
    role: "Movement Instructor",
    pay: "CA$22.00 per hour for guided movement sessions",
  },
  {
    offerLetterType: "puppy_specialist",
    role: "Puppy Specialist",
    pay: "$18.00 per hour",
  },
  {
    offerLetterType: "operations_specialist",
    role: "Operations Specialist",
    pay: "$20.00 per hour",
  },
  {
    offerLetterType: "operations_manager",
    role: "Operations Manager",
    pay: "Compensation and approved hours will follow the terms confirmed in writing by APY.",
  },
  {
    offerLetterType: "bdr",
    role: "Business Development Representative",
    pay: "7% commission on inbound business and 10% commission on outbound business, calculated on Eligible Collected Revenue.",
  },
  {
    offerLetterType: "social_media_intern",
    role: "Social Media Intern",
    pay: "CA$19.00 per hour. Following successful completion of a 3-month probationary period, your rate increases to CA$20.00 per hour.",
  },
  {
    offerLetterType: "social_media_specialist",
    role: "Social Media Specialist",
    pay: "CA$19.00 per hour. Following successful completion of a 3-month probationary period, your rate increases to CA$20.00 per hour.",
  },
];
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

async function extract(bytes: Buffer) {
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(1000);
  const task = getDocument({
    data: Uint8Array.from(bytes),
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  try {
    const pages: string[] = [];
    const bodyPages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        normalize(
          content.items.map(item => ("str" in item ? item.str : "")).join(" ")
        )
      );
      // PDF.js returns stamps after body content. Exclude their reserved geometry
      // when checking paragraphs spanning pages, but retain them in `pages` above.
      const height = page.getViewport({ scale: 1 }).height;
      bodyPages.push(
        normalize(
          content.items
            .map(item =>
              "str" in item &&
              item.transform[5] >= 54 &&
              item.transform[5] <= height - 76
                ? item.str
                : ""
            )
            .join(" ")
        )
      );
    }
    return { pages, text: normalize(bodyPages.join(" ")) };
  } finally {
    await task.destroy();
  }
}

// Independently walk the parsed source tree, comparing every complete legal paragraph/list item.
type HtmlNode = ReturnType<typeof parseDocument>["children"][number];
function legalParagraphs(html: string): string[] {
  const allText = (node: HtmlNode): string => {
    if (node.type === "text") return node.data;
    return "children" in node ? node.children.map(allText).join("") : "";
  };
  const result: string[] = [];
  const visit = (node: HtmlNode) => {
    if (node.type === "tag" && (node.name === "p" || node.name === "li")) {
      const text = normalize(
        allText(node).replace(new RegExp("\\p{RGI_Emoji}", "gv"), "")
      );
      if (text) result.push(text);
    } else if ("children" in node) node.children.forEach(visit);
  };
  parseDocument(html).children.forEach(visit);
  return result;
}
function expectFullLegalText(text: string, snapshot: OfferDocumentSnapshot) {
  for (const paragraph of [
    ...legalParagraphs(snapshot.offerHtml),
    ...legalParagraphs(snapshot.ndaHtml),
  ]) {
    expect(text).toContain(paragraph);
  }
  for (const clause of [
    "1. Confidential Information",
    "2. Obligations",
    "3. Social Media and Brand Representation",
    "4. Duration",
    "5. Remedies",
    "6. Governing Law",
    "This Agreement shall be governed by the laws of the Province of Ontario, Canada.",
    "By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.",
  ])
    expect(text).toContain(clause);
}
function withSnapshot(source = record): SignedOfferPdfRecord {
  return {
    ...source,
    signedDocumentSnapshot: JSON.stringify(createOfferDocumentSnapshot(source)),
  };
}
function rehash(
  snapshot: OfferDocumentSnapshot,
  changes: Partial<Omit<OfferDocumentSnapshot, "sha256">>
) {
  const { sha256: _oldHash, ...content } = { ...snapshot, ...changes };
  return {
    ...content,
    sha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
  };
}

for (const archival of [false, true]) {
  describe(
    archival ? "retained HTML snapshot PDFs" : "legacy reconstructed PDFs",
    () => {
      it.each(roles)(
        "includes full $offerLetterType offer, pay, NDA and signature",
        async ({ pay, ...role }) => {
          const source = { ...record, ...role };
          const snapshot = createOfferDocumentSnapshot(source);
          const input = archival
            ? withSnapshot(source)
            : { ...source, signedDocumentSnapshot: null };
          const { text, pages } = await extract(
            await buildSignedOfferPdf(input)
          );
          expectFullLegalText(text, snapshot);
          expect(text).toContain(pay);
          expect(text).toContain(`Position: ${role.role}`);
          expect(text).toContain("Signing record ID: 147");
          expect(text).toContain("Recorded signature name: Zoë François");
          expect(text).toContain(
            "Recorded signing time: July 10, 2026 at 12:23:45 EDT (America/Toronto)"
          );
          expect(text).toContain(
            "not a cryptographically digitally signed PDF"
          );
          expect(pages.length).toBeGreaterThanOrEqual(4);
          pages.forEach((page, index) => {
            expect(page).toContain(
              `Signing record 147 | Page ${index + 1} of ${pages.length}`
            );
            if (archival)
              expect(page).toContain(
                "Source: retained, checksum-verified document snapshot"
              );
            else expect(page).toContain(WARNING);
          });
          if (archival) {
            expect(text).not.toContain(WARNING);
            expect(text).toContain(snapshot.sha256);
            expect(text).toContain(
              "Archival source: retained signed-document snapshot, version 1"
            );
            expect(text).toContain(
              "not a cryptographic digital signature or independent proof of signer identity"
            );
          } else {
            expect(text).toContain("The saved signing record remains intact");
            expect(text).toContain(
              "not a new signature on the reconstructed wording"
            );
            expect(text).toContain(
              "saved offer creation time (createdAt): February 2, 2026 at 21:04:05 EST"
            );
            expect(text).toContain(
              "not a known or proven date originally displayed to the signer"
            );
          }
        }
      );
    }
  );
}

describe("saved compensation and immutable archival source", () => {
  it.each([
    {
      offerLetterType: "puppy_monitor_kw",
      puppyMonitorShiftPayCad: null,
      pay: "$50.00 per shift",
    },
    {
      offerLetterType: "puppy_monitor_hamilton",
      puppyMonitorShiftPayCad: 50,
      pay: "$50.00 per shift",
    },
    {
      offerLetterType: "movement_instructor",
      movementInstructorHourlyPayCad: null,
      pay: "CA$20.00 per hour",
    },
    {
      offerLetterType: "movement_instructor",
      movementInstructorHourlyPayCad: 20,
      pay: "CA$20.00 per hour",
    },
    {
      offerLetterType: "social_media_intern",
      socialMediaHourlyPayCad: null,
      pay: "Paid part-time role. Compensation and approved hours will follow the terms confirmed in writing by APY.",
    },
  ])(
    "preserves legacy $offerLetterType saved compensation",
    async ({ pay, ...fields }) => {
      const { text } = await extract(
        await buildSignedOfferPdf({ ...record, ...fields })
      );
      expect(text).toContain(pay);
    }
  );

  it("uses the retained HTML even when all current scalar source fields differ or are unusable", async () => {
    const original = createOfferDocumentSnapshot(record);
    const archived = rehash(original, {
      offerHtml:
        original.offerHtml +
        "<p>Archived bespoke term: CA$73.25 per shift — expressly agreed.</p>",
    });
    const input = {
      ...record,
      applicantName: "CHANGED APPLICANT",
      role: "CHANGED ROLE",
      location: "CHANGED LOCATION",
      offerLetterType: "operations_manager",
      puppyMonitorShiftPayCad: 999,
      movementInstructorHourlyPayCad: 999,
      socialMediaHourlyPayCad: 999,
      createdAt: new Date("invalid"),
      signedDocumentSnapshot: JSON.stringify(archived),
    };
    const { text } = await extract(await buildSignedOfferPdf(input));
    expectFullLegalText(text, original);
    expect(text).toContain(
      "Archived bespoke term: CA$73.25 per shift — expressly agreed."
    );
    expect(text).toContain(archived.sha256);
    expect(text).not.toContain("CHANGED");
    expect(text).not.toContain("999");
    expect(input.signedDocumentSnapshot).toBe(JSON.stringify(archived));
  });
});

describe("literal safe text, Unicode, complete pagination and private record fields", () => {
  it("preserves escaped literal markup, words, accents and punctuation; strips only emoji without mutating the snapshot", async () => {
    const original = createOfferDocumentSnapshot(record);
    const stored = rehash(original, {
      offerHtml:
        original.offerHtml +
        '<p>Résumé: Zoë, François &amp; Chloé — “agreed”; £5 © ® ™; 7% CA$60.00. 🐶💕 ❤️ 1️⃣ 👩🏽‍💻 🇨🇦</p><p>Literal &lt;img src=x onerror=alert(1)&gt; is text.</p><script>EXECUTABLE_SHOULD_NOT_APPEAR</script><style>STYLE_SHOULD_NOT_APPEAR</style><p>After active tags.</p><p><a href="https://secret.example/token">Visible link label only.</a></p>',
    });
    const input = {
      ...record,
      signedDocumentSnapshot: JSON.stringify(stored),
      applicantEmail: "private-applicant@example.com",
      token: "private-token-must-not-appear",
      signedIp: "192.0.2.197",
    };
    const { text } = await extract(await buildSignedOfferPdf(input));
    expect(text).toContain(
      "Résumé: Zoë, François & Chloé — “agreed”; £5 © ® ™; 7% CA$60.00."
    );
    expect(text).toContain("Literal <img src=x onerror=alert(1)> is text.");
    expect(text).toContain("After active tags.");
    expect(text).toContain("Visible link label only.");
    for (const secret of [
      "EXECUTABLE_SHOULD_NOT_APPEAR",
      "STYLE_SHOULD_NOT_APPEAR",
      "https://secret.example",
      input.applicantEmail,
      input.token,
      input.signedIp,
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/🐶|💕|❤|👩|🇨🇦|�/u);
    expect(readOfferDocumentSnapshot(input.signedDocumentSnapshot)).toEqual(
      stored
    );
    expect(input.signedDocumentSnapshot).toContain("🐶💕");
  });

  it("renders a single very long archived paragraph through all automatic page breaks without losing words", async () => {
    const words = Array.from(
      { length: 1500 },
      (_, index) => `clause${String(index).padStart(4, "0")}`
    );
    const original = createOfferDocumentSnapshot(record);
    const archived = rehash(original, {
      offerHtml:
        original.offerHtml +
        `<p>LONG_PARAGRAPH_START ${words.join(" ")} LONG_PARAGRAPH_END.</p>`,
    });
    const { text, pages } = await extract(
      await buildSignedOfferPdf({
        ...record,
        signedDocumentSnapshot: JSON.stringify(archived),
      })
    );
    expect(pages.length).toBeGreaterThan(6);
    expect(text).toContain("LONG_PARAGRAPH_START");
    expect(text).toContain("LONG_PARAGRAPH_END.");
    let previous = -1;
    for (const word of words) {
      const position = text.indexOf(word);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expectFullLegalText(text, original);
    expect(text).toContain("Recorded signature name: Zoë François");
    pages.forEach((page, index) =>
      expect(page).toContain(`Page ${index + 1} of ${pages.length}`)
    );
  });

  it("puts the reconstruction warning on every automatically-created legacy page, including signature pages", async () => {
    const location = Array.from(
      { length: 700 },
      (_, index) => `legacyLocation${index}`
    ).join(" ");
    const input = { ...record, location };
    const { text, pages } = await extract(await buildSignedOfferPdf(input));
    expect(pages.length).toBeGreaterThan(5);
    pages.forEach(page => expect(page).toContain(WARNING));
    expect(text).toContain("legacyLocation0");
    expect(text).toContain("legacyLocation699");
    expect(text).toContain("Recorded signature name: Zoë François");
  });

  it("formats a winter signing timestamp in Toronto rather than server local time", async () => {
    const { text } = await extract(
      await buildSignedOfferPdf({
        ...withSnapshot(),
        signedAt: new Date("2026-01-04T02:03:04.000Z"),
      })
    );
    expect(text).toContain(
      "Recorded signing time: January 3, 2026 at 21:03:04 EST (America/Toronto)"
    );
  });
});

describe("fail-closed validation", () => {
  it.each([
    { signedName: null },
    { signedName: "" },
    { signedName: " \n\t " },
    { signedAt: null },
    { signedAt: new Date("invalid") },
  ])("rejects unsigned or incomplete signing details: %j", async fields => {
    await expect(buildSignedOfferPdf({ ...record, ...fields })).rejects.toThrow(
      /recorded signature name and valid signing time/i
    );
  });

  it.each(["", "puppy_monitor", "unsupported", "__proto__", "toString"])(
    "refuses unknown offer type %j rather than falling through to Puppy Monitor",
    async offerLetterType => {
      await expect(
        buildSignedOfferPdf({ ...record, offerLetterType })
      ).rejects.toThrow(/Unsupported offer letter type/);
      await expect(
        buildSignedOfferPdf({ ...withSnapshot(), offerLetterType })
      ).rejects.toThrow(/Unsupported offer letter type/);
    }
  );

  it("rejects a tampered non-null snapshot instead of regenerating a legacy copy", async () => {
    const snapshot = createOfferDocumentSnapshot(record);
    snapshot.offerHtml = snapshot.offerHtml.replace("CA$60.00", "CA$900.00");
    await expect(
      buildSignedOfferPdf({
        ...record,
        signedDocumentSnapshot: JSON.stringify(snapshot),
      })
    ).rejects.toThrow(/could not be verified/);
  });

  it.each(["", "not-json", "null", "{}", "[]"])(
    "rejects malformed non-null snapshot %j without legacy fallback",
    async signedDocumentSnapshot => {
      await expect(
        buildSignedOfferPdf({ ...record, signedDocumentSnapshot })
      ).rejects.toThrow();
    }
  );

  it("rejects unsupported snapshot versions even with a matching digest", async () => {
    const snapshot = rehash(createOfferDocumentSnapshot(record), {
      version: 2 as 1,
    });
    await expect(
      buildSignedOfferPdf({
        ...record,
        signedDocumentSnapshot: JSON.stringify(snapshot),
      })
    ).rejects.toThrow();
  });

  it("rejects an empty document rather than silently emitting an incomplete copy", async () => {
    const snapshot = rehash(createOfferDocumentSnapshot(record), {
      ndaHtml: "<div> </div>",
    });
    await expect(
      buildSignedOfferPdf({
        ...record,
        signedDocumentSnapshot: JSON.stringify(snapshot),
      })
    ).rejects.toThrow(/both contain readable document text/);
  });

  it("rejects invalid legacy creation dates instead of inventing a document date", async () => {
    await expect(
      buildSignedOfferPdf({ ...record, createdAt: new Date("invalid") })
    ).rejects.toThrow();
  });

  it.each([0, -1, NaN, 1.5])(
    "rejects invalid signing record ID %j",
    async id => {
      await expect(buildSignedOfferPdf({ ...record, id })).rejects.toThrow(
        /valid signing record ID/
      );
    }
  );
});
