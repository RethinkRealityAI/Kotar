// Regenerates every screenshot used by public/guide.html.
//
//   node tools/guide-screenshots.mjs            (uses BASE_URL / APP_PASSCODE from .env or the environment)
//   BASE_URL=http://localhost:8888 node tools/guide-screenshots.mjs
//
// Uses the Chrome already installed on this computer (no browser download). It creates a
// "Sample Client" with one estimate, walks through the app, saves PNGs to public/guide/, then
// deletes the sample data. Run it after any UI change and commit the new images with the code.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "guide");
mkdirSync(out, { recursive: true });

// .env (local) -> environment
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const BASE = (process.env.BASE_URL || process.env.PUBLIC_URL || "https://kotar-estimates.netlify.app").replace(/\/+$/, "");
const PASS = process.env.APP_PASSCODE || "";
const H = { "content-type": "application/json", ...(PASS ? { "x-passcode": PASS } : {}) };
const api = async (path, method = "GET", body) => {
  const r = await fetch(`${BASE}/api/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${d.error || r.status}`);
  return d;
};

const SAMPLE = {
  client: { name: "Sample Client", address: "478 East 37th Street, Hamilton, ON", email: "sample@example.com", phone: "289-555-0100" },
  estimate: (clientId) => ({
    number: "KR-SAMPLE", date: new Date().toISOString().slice(0, 10), project: "Main bathroom renovation", clientId,
    client: { name: "Sample Client", address: "478 East 37th Street, Hamilton, ON", email: "sample@example.com", phone: "289-555-0100" },
    pricingMode: "lump", lumpSubtotal: 18440.39, taxRate: 13,
    sections: [
      { id: "g1", key: "siteprep", title: "Site Prep", items: ["Install floor protection from the main entrance to the working area"] },
      { id: "g2", key: "demo", title: "Demo", items: ["Complete gut of bathroom", "Dispose of all garbage"] },
      { id: "g3", key: "plumbing", title: "Plumbing", items: ["Rough in and finish of:", "New toilet (re-use toilet, new location)", "New vanity", "New shower"] },
      { id: "g4", key: "electrical", title: "Electrical", items: ["Rough in and finish of:", "New bathroom fan", "New vanity light fixture", "New potlight"] },
      { id: "g5", key: "tile", title: "Tile", items: ["Pour self leveller on bathroom floor", "Install pre-waterproofed shower base", "Tile shower walls", "Tile bathroom floor", "Grout all tiled areas"] },
      { id: "g6", key: "paint", title: "Paint", items: ["Paint all drywall and trim"] },
      { id: "g7", key: "cleanup", title: "Clean Up", items: ["Work area to be swept daily", "Tools to be put away neatly at the end of each day"] },
    ],
    notesText: "Overall cost and scope of work is subject to change upon the completion of demo\nAll design choices such as tile, vanity, mirror, light fixture etc. are not included",
  }),
};

let clientId = null, estId = null;
async function seed() {
  const c = await api("clients", "POST", SAMPLE.client); clientId = c.id;
  const e = await api("estimates", "POST", SAMPLE.estimate(clientId)); estId = e.id;
  const s = await api("share", "POST", { id: estId });
  // the client leaves two comments and a note so the Review tab and callouts have content
  await fetch(`${BASE}/api/share`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: s.token, action: "review",
    comments: [
      { sectionId: "g3", sectionTitle: "Plumbing", idx: 3, itemText: "New shower", text: "Could this be a rain shower head instead?" },
      { sectionId: "g5", sectionTitle: "Tile", idx: 3, itemText: "Tile bathroom floor", text: "We would like larger format tile here" },
    ], note: "Is an October start possible?" }) });
  const portal = await api("share", "POST", { clientId, portal: true });
  return { token: s.token, portal: portal.token };
}
async function cleanup() {
  try { if (estId) await api(`estimates?id=${estId}`, "DELETE"); } catch {}
  try { if (clientId) await api(`clients?id=${clientId}`, "DELETE"); } catch {}
}

const shots = [];
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.wait || 500);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: !!opts.full, clip: opts.clip });
  shots.push(name); console.log("  saved", name + ".png");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    console.log("Seeding sample data on", BASE);
    const { token, portal } = await seed();

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
    if (PASS) await ctx.addInitScript((p) => { try { localStorage.setItem("kotar.passcode", p); } catch {} }, PASS);
    const page = await ctx.newPage();

    // --- owner app ---
    await page.goto(`${BASE}/#/`); await page.waitForSelector("#shell:not([hidden])"); await page.waitForSelector("#listTable .row");
    await shot(page, "01-dashboard");

    await page.click("#btnNew"); await page.waitForSelector(".tmpl"); await shot(page, "02-new-estimate-templates");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/#/estimate/${estId}`); await page.waitForSelector("#sections .sec");
    await page.fill("#aiText", "Debbie Thomson, 478 East 37th Street Hamilton. Full gut of the main bathroom. New shower with a niche and glass door, re-use the toilet in a new spot, new vanity, fan, vanity light and a potlight. Tile the floor and shower. Paint. $18,440 plus HST.");
    await shot(page, "03-describe-the-job", { clip: { x: 0, y: 60, width: 1440, height: 560 } });

    await page.evaluate(() => document.querySelector("#btnAddScope").scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -80));
    await shot(page, "04-scope-of-work");

    await page.click("#btnAddScope"); await page.waitForSelector("#scopeList .tile"); await shot(page, "05-add-scope-picker");
    await page.click('[data-pt="new"]'); await page.waitForSelector("#scopeNew:not([hidden])"); await page.fill("#pnName", "Mudroom"); await shot(page, "06-new-section-form");
    await page.keyboard.press("Escape");

    await page.evaluate(() => document.querySelector("#statusCard").scrollIntoView({ block: "center" })); await shot(page, "07-pricing-and-client-link");

    await page.goto(`${BASE}/#/review`); await page.waitForSelector(".rcard"); await shot(page, "08-review-tab");
    await page.goto(`${BASE}/#/estimate/${estId}`); await page.waitForSelector(".ccall");
    await page.evaluate(() => document.querySelector(".ccall").scrollIntoView({ block: "center" })); await shot(page, "09-client-comment-in-builder");

    await page.goto(`${BASE}/#/clients`); await page.waitForSelector(".ccard"); await shot(page, "10-clients");
    await page.goto(`${BASE}/#/library`); await page.waitForSelector(".libcard"); await shot(page, "11-scope-library");

    // --- client pages (no passcode) ---
    const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
    const cp = await cctx.newPage();
    await cp.goto(`${BASE}/e/${token}`); await cp.waitForSelector("#paper .psec"); await shot(cp, "12-client-review-page");
    await cp.click('.cbtn[data-c="g4:2"]'); await cp.waitForSelector("#paper .cedit"); await cp.fill("#paper .cedit textarea", "Can this be a dimmable fixture?");
    await cp.evaluate(() => document.querySelector("#paper .cedit").scrollIntoView({ block: "center" })); await shot(cp, "13-client-adds-a-comment");
    await cp.goto(`${BASE}/c/${portal}`); await cp.waitForSelector(".pcard"); await shot(cp, "14-client-portal");

    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
    const mp = await mctx.newPage(); await mp.goto(`${BASE}/e/${token}`); await mp.waitForSelector("#paper .psec"); await shot(mp, "15-client-review-mobile");

    console.log(`Done: ${shots.length} screenshots in public/guide/`);
  } finally {
    await cleanup();
    await browser.close();
  }
})().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
