// Shared helpers for Kotar Estimates functions (Netlify Functions v2, ESM).
import { getStore } from "@netlify/blobs";

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const bad = (message, status = 400) => json({ error: message }, status);

// Passcode gate. If APP_PASSCODE is unset the gate is open (local development only).
export function requireAuth(req) {
  const want = (process.env.APP_PASSCODE || "").trim();
  if (!want) return null;
  const got = (req.headers.get("x-passcode") || "").trim();
  if (got && safeEqual(got, want)) return null;
  return json({ error: "Passcode required" }, 401);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const store = (name) => getStore({ name, consistency: "strong" });

export async function readAll(name) {
  const s = store(name);
  const { blobs } = await s.list();
  const out = [];
  for (const b of blobs) {
    const v = await s.get(b.key, { type: "json" });
    if (v) out.push(v);
  }
  return out;
}

export const uid = (n = 10) => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  for (const b of buf) s += chars[b % chars.length];
  return s;
};

export const now = () => new Date().toISOString();

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export const clean = (v, max = 400) => String(v ?? "").slice(0, max).trim();

export function publicUrl(req) {
  const env = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  if (env) return env;
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

// Normalise an estimate coming from the client into the stored shape.
export function normalizeEstimate(e, existing) {
  const secs = Array.isArray(e.sections) ? e.sections : [];
  const out = {
    id: clean(e.id || existing?.id || uid(), 40),
    number: clean(e.number, 40),
    date: clean(e.date, 10),
    project: clean(e.project, 120),
    clientId: clean(e.clientId, 40),
    client: {
      name: clean(e.client?.name, 120),
      address: clean(e.client?.address, 240),
      email: clean(e.client?.email, 160),
      phone: clean(e.client?.phone, 60),
    },
    pricingMode: e.pricingMode === "section" ? "section" : "lump",
    lumpSubtotal: round2(+e.lumpSubtotal || 0),
    taxRate: isFinite(+e.taxRate) ? +e.taxRate : 13,
    sections: secs.slice(0, 60).map((s) => ({
      id: clean(s.id || uid(6), 20),
      key: clean(s.key, 40),
      title: clean(s.title, 80),
      items: (Array.isArray(s.items) ? s.items : String(s.items || "").split("\n")).slice(0, 80).map((i) => clean(i, 300)),
      amount: round2(+s.amount || 0),
    })),
    notesText: clean(e.notesText, 4000),
    status: existing?.status || "draft",
    share: existing?.share || null,
    // Client feedback is written only by the share function; the owner may just flip "resolved".
    review: mergeReview(existing?.review || null, e.review),
    reviewHistory: existing?.reviewHistory || [],
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  };
  return out;
}

export function mergeReview(current, incoming) {
  if (!current) return null;
  if (!incoming || !Array.isArray(incoming.comments)) return current;
  const byId = {};
  incoming.comments.forEach((c) => { if (c && c.id) byId[c.id] = !!c.resolved; });
  return { ...current, comments: (current.comments || []).map((c) => (c.id in byId ? { ...c, resolved: byId[c.id], resolvedAt: byId[c.id] ? (c.resolvedAt || now()) : null } : c)) };
}

// Sanitize a client review submission (line comments + general note).
export function cleanReview(b) {
  const comments = (Array.isArray(b.comments) ? b.comments : []).slice(0, 60).map((c) => ({
    id: clean(c.id, 20) || uid(8),
    sectionId: clean(c.sectionId, 20),
    sectionTitle: clean(c.sectionTitle, 80),
    idx: Number.isInteger(+c.idx) ? +c.idx : -1,
    itemText: clean(c.itemText, 300),
    text: clean(c.text, 1000),
    resolved: false,
  })).filter((c) => c.text);
  return { comments, note: clean(b.note, 2000), submittedAt: now(), withApproval: !!b.withApproval };
}

export const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

export function totals(e) {
  const sub = e.pricingMode === "section" ? e.sections.reduce((a, s) => a + (+s.amount || 0), 0) : +e.lumpSubtotal || 0;
  const tax = round2(round2(sub) * (+e.taxRate || 0) / 100);
  return { sub: round2(sub), tax, total: round2(round2(sub) + tax) };
}
