// /api/library  (auth)
//   GET        -> library config { overrides:{key:{t,c,i}}, custom:[{k,t,c,i}], hidden:[key] }
//   PUT {cfg}  -> saved config
// Built-in sections live in public/common.js; this stores the owner's edits on top of them.
import { json, bad, requireAuth, store, body, clean } from "./_lib.js";

const EMPTY = { overrides: {}, custom: [], hidden: [] };

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const s = store("library");

  if (req.method === "GET") {
    const cfg = await s.get("v1", { type: "json" });
    return json(cfg || EMPTY);
  }
  if (req.method === "PUT" || req.method === "POST") {
    const b = await body(req);
    if (!b || typeof b !== "object") return bad("Library config required");
    const cfg = sanitize(b);
    await s.setJSON("v1", cfg);
    return json(cfg);
  }
  return json({ error: "Method not allowed" }, 405);
};

function items(arr) {
  return (Array.isArray(arr) ? arr : []).slice(0, 80).map((i) => clean(i, 300)).filter(Boolean);
}
function sanitize(b) {
  const overrides = {};
  Object.keys(b.overrides || {}).slice(0, 200).forEach((k) => {
    const o = b.overrides[k] || {};
    overrides[clean(k, 40)] = { t: clean(o.t, 80), c: clean(o.c, 40), i: items(o.i) };
  });
  const custom = (Array.isArray(b.custom) ? b.custom : []).slice(0, 200).map((o) => ({
    k: clean(o.k, 40) || "c_" + Math.random().toString(36).slice(2, 9),
    t: clean(o.t, 80),
    c: clean(o.c, 40) || "Custom",
    i: items(o.i),
  })).filter((o) => o.t);
  const hidden = (Array.isArray(b.hidden) ? b.hidden : []).slice(0, 200).map((k) => clean(k, 40)).filter(Boolean);
  return { overrides, custom, hidden, updatedAt: new Date().toISOString() };
}

export const config = { path: "/api/library" };
