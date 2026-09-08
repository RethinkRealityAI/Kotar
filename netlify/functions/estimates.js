// /api/estimates
//   GET               -> [estimates]  (summary + full, sorted newest first)
//   GET ?id=          -> estimate
//   POST {estimate}   -> estimate (create or update)
//   DELETE ?id=       -> { ok }
import { json, bad, requireAuth, store, readAll, body, clean, normalizeEstimate } from "./_lib.js";

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const s = store("estimates");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = clean(url.searchParams.get("id"), 40);
    if (id) {
      const e = await s.get(id, { type: "json" });
      return e ? json(e) : bad("Not found", 404);
    }
    const list = await readAll("estimates");
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return json(list);
  }

  if (req.method === "POST") {
    const b = await body(req);
    if (!b) return bad("Estimate body required");
    const id = clean(b.id, 40);
    const existing = id ? await s.get(id, { type: "json" } ) : null;
    const e = normalizeEstimate(b, existing);
    // A draft that changes after being sent goes back to "sent" state untouched; the client link
    // always shows the latest version. Approval is preserved as history, but a material change
    // after approval flags the estimate so Trevor re-sends.
    if (existing && existing.status === "approved" && JSON.stringify(strip(existing)) !== JSON.stringify(strip(e))) {
      e.status = "changed";
    }
    await s.setJSON(e.id, e);
    return json(e);
  }

  if (req.method === "DELETE") {
    const id = clean(url.searchParams.get("id"), 40);
    if (!id) return bad("id required");
    const e = await s.get(id, { type: "json" });
    if (e?.share?.token) await store("shares").delete(e.share.token);
    // keep the client's portal; it simply stops listing this estimate
    await s.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

// The parts of an estimate the client actually agreed to.
function strip(e) {
  return { client: e.client, project: e.project, pricingMode: e.pricingMode, lumpSubtotal: e.lumpSubtotal, taxRate: e.taxRate, sections: e.sections, notesText: e.notesText };
}

export const config = { path: "/api/estimates" };
