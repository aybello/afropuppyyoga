import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import ts from "typescript";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveStatic } from "./_core/vite";
import { isRegisteredSpaPath, SPA_ROUTE_PATTERNS } from "./clientSeoRenderer";
import { seoRenderMiddleware } from "./seoRenderer";

let server: Server;
let origin: string;
let dir: string;
const template = readFileSync(process.env.SEO_TEST_BUILT_INDEX || new URL("../client/index.html", import.meta.url), "utf8");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "apy-spa-test-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), template);
  writeFileSync(path.join(dir, "assets", "app.js"), "asset-ok");
  const app = express();
  // Model upstream index.ts behavior and verify the actual SEO and static
  // middleware in their real order without starting the database-backed server.
  app.use((req, res, next) => {
    res.vary("Accept-Encoding");
    if (req.headers["x-test-noindex"] === "yes") res.set("X-Robots-Tag", "noindex, nofollow");
    if (/^\/(?:admin(?:\/|$)|staff(?:\/|$)|staff-access$|sign$|submit-invoice$)/.test(req.path)) {
      res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      res.set("Cache-Control", "private, no-store");
    }
    next();
  });
  app.get("/about", (_req, res) => res.redirect(301, "/"));
  app.get("/api/oauth/callback", (_req, res) => res.status(202).send("oauth-handler"));
  app.post("/api/example", (_req, res) => res.status(202).send("api-handler"));
  app.get(["/privacy", "/terms", "/refund-policy", "/quickbooks-disconnect"], (req, res) => res.send(`legal:${req.path}`));
  app.use(seoRenderMiddleware);
  serveStatic(app, dir);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const get = (url: string, init: RequestInit = {}) => fetch(origin + url, { redirect: "manual", ...init });

// Parse JSX rather than relying on prop order, whitespace, or a single line.
function extractRoutes(source: string) {
  const file = ts.createSourceFile("routes.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes: string[] = [];
  const dynamic: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === "Route") {
      for (const spread of node.attributes.properties.filter(ts.isJsxSpreadAttribute)) dynamic.push(`spread props: ${spread.getText(file)}`);
      const prop = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(file) === "path");
      if (prop && ts.isJsxAttribute(prop)) {
        const value = prop.initializer;
        if (value && ts.isStringLiteral(value)) routes.push(value.text);
        else if (value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) routes.push(value.expression.text);
        else dynamic.push(`dynamic path: ${prop.getText(file)}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { routes, dynamic };
}

describe("SPA document routing over HTTP", () => {
  it("tracks every explicit App.tsx route, but not its catch-all", () => {
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const { routes, dynamic } = extractRoutes(app);
    expect(dynamic, `Dynamic Route paths or spread props require manual registry review: ${dynamic.join(", ")}`).toEqual([]);
    expect(routes.length).toBeGreaterThan(40);
    expect([...SPA_ROUTE_PATTERNS].sort()).toEqual(routes.sort());
  });
  it("detects multiline and reordered JSX props and warns on dynamic paths and spreads", () => {
    const result = extractRoutes(`<Switch><Route component={Foo}
 path = {"/multiline"} /><Route component={Bar} path='/other'></Route><Route path={variable} /><Route {...props} /><Route /></Switch>`);
    expect(result.routes).toEqual(["/multiline", "/other"]);
    expect(result.dynamic).toHaveLength(2);
    expect(result.dynamic.join(" ")).toMatch(/dynamic path/);
    expect(result.dynamic.join(" ")).toMatch(/spread props/);
  });
  it("serves identical crawler snapshots for encoded mixed-case GET and HEAD, and refuses explicit noindex", async () => {
    for (const url of ["/PUPPY-YOGA-GUEL%70H", "/Puppy-Yoga-Guelph/?x=1"]) {
      const headers = { "user-agent": "Googlebot" };
      const response = await get(url, { headers });
      const head = await get(url, { method: "HEAD", headers });
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain('<h1>Puppy Yoga in Guelph</h1>');
      expect(html).not.toContain('id="root"');
      expect(head.status).toBe(response.status);
      for (const header of ["content-type", "cache-control", "surrogate-control", "vary", "x-robots-tag"]) expect(head.headers.get(header), header).toBe(response.headers.get(header));
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toMatch(/Accept-Encoding/i);
      expect(response.headers.get("vary")).toMatch(/User-Agent/i);
      expect(await head.text()).toBe("");
      const noindexHeaders = { ...headers, "x-test-noindex": "yes" };
      const blocked = await get(url, { headers: noindexHeaders });
      const blockedHead = await get(url, { method: "HEAD", headers: noindexHeaders });
      const blockedHtml = await blocked.text();
      expect(blockedHtml).toContain('id="root"');
      expect(blockedHtml).not.toContain('<h1>Puppy Yoga in Guelph</h1>');
      expect(blockedHtml).not.toContain('rel="canonical"');
      expect(blockedHtml).toContain('content="noindex, nofollow, noarchive"');
      expect(blocked.headers.get("x-robots-tag")).toContain("noindex");
      expect(blockedHead.status).toBe(blocked.status);
      for (const header of ["cache-control", "surrogate-control", "vary", "x-robots-tag"]) expect(blockedHead.headers.get(header), header).toBe(blocked.headers.get(header));
    }
  });
  it.each([...SPA_ROUTE_PATTERNS])("serves registered route %s", async pattern => {
    const url = pattern.replace(":id", "example-42");
    const response = await get(`${url}?test=1`);
    expect(response.status).toBe(200);
  });
  it.each(["Googlebot", "Mozilla/5.0"])("returns an uncached noindex 404 for unknown HTML to %s", async agent => {
    const response = await get("/totally-missing?from=search", { headers: { "user-agent": agent, accept: "text/html" } });
    const body = await response.text();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("surrogate-control")).toBe("no-store");
    expect(response.headers.get("vary")).toMatch(/User-Agent/i);
    expect(body).toContain("404 Not Found");
    expect(body).not.toContain('rel="canonical"');
  });
  it("protects registered staff and parameterized routes even for Googlebot", async () => {
    for (const url of ["/staff", "/staff-access?token=example", "/admin-login", "/ADMIN-LOGIN/", "/%61DMIN-login", "/%61DMIN/breeder-leads/Mixed", "/admin/breeder-leads/AbC123?source=test", "/STAFF/training", "/st%61ff-access", "/SIGN", "/submit-invoice"]) {
      const response = await get(url, { headers: { "user-agent": "Googlebot" } });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("surrogate-control")).toBe("no-store");
      const body = await response.text();
      expect(body).toContain('id="root"');
      expect(body).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
      expect(body).not.toContain('rel="canonical"');
      expect(body).not.toContain('property="og:url"');
      expect(body).toContain("<title>AfroPuppyYoga</title>");
      expect(body).not.toContain('<meta name="robots" content="index, follow"');
      const head = await get(url, { method: "HEAD", headers: { "user-agent": "Googlebot" } });
      expect(head.status, url).toBe(response.status);
      for (const header of ["cache-control", "surrogate-control", "x-robots-tag", "vary"]) expect(head.headers.get(header), `${url} ${header}`).toBe(response.headers.get(header));
      expect(await head.text()).toBe("");
    }
  });
  it.each(["Googlebot", "Mozilla/5.0"])("serves correct uppercase Guelph metadata for %s", async agent => {
    const response = await get("/PUPPY-YOGA-GUELPH?source=test", { headers: { "user-agent": agent } });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('rel="canonical" href="https://afropuppyyoga.ca/puppy-yoga-guelph"');
    expect(body).toContain('<meta property="og:url" content="https://afropuppyyoga.ca/puppy-yoga-guelph"');
    expect(body.match(/<title>(.*?)<\/title>/i)?.[1]).toMatch(/Guelph/i);
    expect(body).not.toContain('<meta name="robots" content="noindex');
  });
  it("matches GET and HEAD status and cache policies for public, private and missing documents", async () => {
    for (const agent of ["Googlebot", "Mozilla/5.0"]) {
      for (const url of ["/puppy-yoga-guelph", "/PUPPY-YOGA-GUELPH", "/admin-login?token=example", "/ADMIN/breeder-leads/AbC", "/unknown"]) {
        const headers = { "user-agent": agent };
        const response = await get(url, { headers });
        const head = await get(url, { method: "HEAD", headers });
        expect(head.status, `${agent} ${url}`).toBe(response.status);
        for (const header of ["cache-control", "surrogate-control", "x-robots-tag"]) {
          expect(head.headers.get(header), `${agent} ${url} ${header}`).toBe(response.headers.get(header));
        }
        expect(await head.text()).toBe("");
      }
    }
  });
  it("does not accept malformed parameterized or prototype paths", async () => {
    for (const url of ["/admin/breeder-leads/123/extra", "/constructor", "/missing//", "/careers//", "/puppy-yoga-guelph%2F"]) {
      for (const agent of ["Googlebot", "Mozilla/5.0"]) {
        expect((await get(url, { headers: { "user-agent": agent } })).status).toBe(404);
      }
    }
  });
  it("refuses malformed escapes without leaking a snapshot", async () => {
    const response = await get("/careers%ZZ", { headers: { "user-agent": "Googlebot" } });
    expect([400, 404]).toContain(response.status);
    expect(await response.text()).not.toContain("Careers at AfroPuppyYoga | Join Our Team");
  });
  it("matches Wouter's case, decodeURI and single-trailing-slash rules", () => {
    expect(isRegisteredSpaPath("/STAFF/TRAINING/")).toBe(true);
    expect(isRegisteredSpaPath("/staff/train%69ng")).toBe(true);
    expect(isRegisteredSpaPath("/staff/training//")).toBe(false);
    expect(isRegisteredSpaPath("/admin/breeder-leads/%2F")).toBe(true);
    expect(isRegisteredSpaPath("/admin/breeder-leads")).toBe(true);
  });
  it("preserves legal and upstream OAuth/API/redirect handling", async () => {
    for (const url of ["/privacy", "/terms?src=1", "/refund-policy", "/quickbooks-disconnect"]) {
      const response = await get(url, { headers: { "user-agent": "Googlebot" } });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("legal:");
    }
    const oauth = await get("/api/oauth/callback?code=example");
    expect(oauth.status).toBe(202);
    expect(await oauth.text()).toBe("oauth-handler");
    expect((await get("/api/example", { method: "POST" })).status).toBe(202);
    const redirect = await get("/about?src=test");
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("/");
  });
  it("serves assets before the document fallback", async () => {
    const asset = await get("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("asset-ok");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect((await get("/assets/missing.js")).status).toBe(404);
  });
  it("preserves non-GET fallback behavior and returns 404 for HEAD unknown", async () => {
    expect((await get("/unknown", { method: "POST" })).status).toBe(200);
    const head = await get("/unknown", { method: "HEAD" });
    expect(head.status).toBe(404);
    expect(await head.text()).toBe("");
  });
  it("varies both crawler and browser documents without clobbering upstream Vary", async () => {
    const bot = await get("/careers", { headers: { "user-agent": "Googlebot" } });
    const browser = await get("/careers", { headers: { "user-agent": "Mozilla/5.0" } });
    for (const response of [bot, browser]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("vary")).toMatch(/Accept-Encoding/i);
      expect(response.headers.get("vary")).toMatch(/User-Agent/i);
    }
    expect(bot.headers.get("cache-control")).toContain("no-store");
    expect(bot.headers.get("surrogate-control")).toBe("no-store");
    expect(browser.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await bot.text()).not.toContain('id="root"');
    expect(await browser.text()).toContain('id="root"');
  });
});
