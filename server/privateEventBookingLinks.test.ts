import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import PrivateEvents from "../client/src/components/sections/PrivateEvents";
import Memberships from "../client/src/components/sections/Memberships";
import LoyaltyProgram from "../client/src/components/sections/LoyaltyProgram";

const read = (file: string) => readFileSync(new URL(`../client/src/${file}`, import.meta.url), "utf8");
const plainText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const anchorsTo = (html: string, path: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  .filter(match => match[1].includes(`href="${path}"`));

function destinationJsx(file: string, path: string) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const links: ts.JsxOpeningElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(attribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "href" &&
      attribute.initializer && ts.isStringLiteral(attribute.initializer) &&
      attribute.initializer.text === path)) links.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, links };
}

describe("reliable cross-page links from the lean public homepage", () => {
  it("renders Book Your Private Event as a real quote-form link without a router provider", () => {
    const html = renderToStaticMarkup(createElement(PrivateEvents));
    const links = anchorsTo(html, "/private-events/quote");
    expect(links).toHaveLength(1);
    expect(plainText(links[0][2])).toBe("Book Your Private Event");
    expect(links[0][1]).not.toContain('target="_blank"');
    expect(links[0][1]).toContain("rounded-full");
    expect(links[0][2]).not.toMatch(/<(?:button|a)\b/);
    expect(read("components/sections/PrivateEvents.tsx")).toContain('trackCTAClick("Book Your Private Event — Private Events")');
  });

  it.each([
    ["components/sections/PrivateEvents.tsx", "/private-events/quote"],
    ["components/sections/Memberships.tsx", "/loyalty"],
    ["components/sections/LoyaltyProgram.tsx", "/loyalty"],
  ] as const)("uses native navigation rather than history-only routing in %s", (file, path) => {
    const { source, links } = destinationJsx(file, path);
    expect(links).toHaveLength(1);
    expect(links[0].tagName.getText(source)).toBe("a");
    expect(links[0].getText(source)).not.toContain("preventDefault");
  });

  it("keeps membership and Rewards cross-page actions available without a router provider", () => {
    const memberships = renderToStaticMarkup(createElement(Memberships));
    const rewards = renderToStaticMarkup(createElement(LoyaltyProgram));
    expect(anchorsTo(memberships, "/loyalty").map(link => plainText(link[2]))).toEqual(["See our loyalty program →"]);
    expect(anchorsTo(rewards, "/loyalty").map(link => plainText(link[2]))).toEqual(["Learn More"]);
    expect(plainText(memberships)).toContain("$40/month");
    expect(plainText(memberships)).toContain("$60/month");
    expect(plainText(memberships)).toContain("Guelph");
    expect(plainText(rewards)).toContain("60");
  });

  it("does not leave client-only Wouter links in any active homepage section", () => {
    const home = read("pages/Home.tsx");
    const sections = readdirSync(new URL("../client/src/components/sections/", import.meta.url))
      .filter(file => file.endsWith(".tsx") && home.includes(`@/components/sections/${file.slice(0, -4)}`));
    expect(sections).toContain("PrivateEvents.tsx");
    expect(sections).toContain("Memberships.tsx");
    expect(sections).toContain("LoyaltyProgram.tsx");
    for (const file of sections) {
      const path = `components/sections/${file}`;
      const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      for (const node of source.statements) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          expect(node.moduleSpecifier.text, `${file} must not use history-only cross-page links`).not.toBe("wouter");
        }
      }
    }
  });

  it("preserves the lean homepage bootstrap and the actual public quote form route", () => {
    expect(read("main.tsx")).toContain('window.location.pathname === "/"');
    expect(read("homeBootstrap.tsx")).toContain("<Home />");
    expect(read("homeBootstrap.tsx")).not.toContain("<App");
    expect(read("App.tsx")).toContain('<Route path={"/private-events/quote"} component={PrivateEventQuote} />');
    const quote = read("pages/PrivateEventQuote.tsx");
    expect(quote).toContain('id="quote-form"');
    expect(quote).toContain("Send My Inquiry");
  });
});
