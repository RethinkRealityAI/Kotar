// /api/share
//   POST {id}                       (auth)   -> { url, token }   create/refresh a client link, status -> sent
//   GET  ?token=                    (public) -> { estimate (client-safe), company } and marks viewed
//   POST {token, action:"approve", name, note}   (public) -> { ok }  typed-signature approval
//   POST {token, action:"changes", note}         (public) -> { ok }  client requests changes
import { json, bad, requireAuth, store, uid, now, body, clean, publicUrl, totals } from "./_lib.js";

const COMPANY = {
  name: "Kotar Renovations",
  contact: "Trevor Kotar",
  address: "440 Cochrane Rd, Hamilton, ON",
  phone: "289-237-9622",
  email: "info@kotarrenovationsinc.ca",
  hst: "732482419 RT0001",
};

export default async (req) => {
  const estimates = store("estimates");
  const shares = store("shares");
  const url = new URL(req.url);

  // ---- public: client opens the link ----
  if (req.method === "GET") {
    const token = clean(url.searchParams.get("token"), 40);
    if (!token) return bad("token required");
    const ref = await shares.get(token, { type: "json" });
    if (!ref) return bad("This estimate link is no longer available.", 404);
    const e = await estimates.get(ref.estimateId, { type: "json" });
    if (!e || e.share?.token !== token) return bad("This estimate link is no longer available.", 404);
    if (!e.share.viewedAt) {
      e.share.viewedAt = now();
      if (e.status === "sent") e.status = "viewed";
      await estimates.setJSON(e.id, e);
    }
    return json({ estimate: clientSafe(e), company: COMPANY });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await body(req)) || {};

  // ---- public: approve / request changes ----
  if (b.token) {
    const token = clean(b.token, 40);
    const ref = await shares.get(token, { type: "json" });
    if (!ref) return bad("This estimate link is no longer available.", 404);
    const e = await estimates.get(ref.estimateId, { type: "json" });
    if (!e || e.share?.token !== token) return bad("This estimate link is no longer available.", 404);
    const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
    if (b.action === "approve") {
      const name = clean(b.name, 120);
      if (!name) return bad("Please type your full name to approve.");
      if (e.status === "approved") return json({ ok: true, already: true });
      e.status = "approved";
      e.share.approvedAt = now();
      e.share.approvedBy = name;
      e.share.approvedNote = clean(b.note, 1000);
      e.share.approvedIp = clean(ip, 60);
      e.share.approvedTotal = totals(e).total;
      await estimates.setJSON(e.id, e);
      return json({ ok: true });
    }
    if (b.action === "changes") {
      const note = clean(b.note, 2000);
      if (!note) return bad("Tell us what you would like changed.");
      e.status = "changes";
      e.share.changesAt = now();
      e.share.changesNote = note;
      await estimates.setJSON(e.id, e);
      return json({ ok: true });
    }
    return bad("Unknown action");
  }

  // ---- owner: create or refresh the link ----
  const denied = requireAuth(req);
  if (denied) return denied;
  const id = clean(b.id, 40);
  const e = id ? await estimates.get(id, { type: "json" }) : null;
  if (!e) return bad("Estimate not found", 404);
  if (!e.client?.name) return bad("Add a client before sending.");
  let token = e.share?.token;
  if (!token || b.refresh) {
    if (token) await shares.delete(token);
    token = uid(14);
    await shares.setJSON(token, { estimateId: e.id, createdAt: now() });
    e.share = { token, sentAt: now() };
  } else {
    e.share.sentAt = now();
  }
  if (e.status === "draft" || e.status === "changed" || e.status === "changes") e.status = "sent";
  await estimates.setJSON(e.id, e);
  return json({ ok: true, token, url: `${publicUrl(req)}/e/${token}`, estimate: e });
};

function clientSafe(e) {
  const { share, ...rest } = e;
  return { ...rest, share: { sentAt: share?.sentAt, approvedAt: share?.approvedAt, approvedBy: share?.approvedBy, changesAt: share?.changesAt } };
}

export const config = { path: "/api/share" };
