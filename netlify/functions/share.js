// /api/share
//   Owner (auth):
//     POST {id, refresh?}            -> { url, token, estimate }   create/refresh an estimate link, status -> sent
//     POST {clientId, portal:true}   -> { url, token }             create/return the client's portal link
//   Public:
//     GET  ?token=                   -> { estimate (client-safe), company, portalToken? }   marks viewed
//     GET  ?portal=                  -> { client:{name}, estimates:[client-safe], company }
//     POST {token, action:"approve", name, note?, comments?}  -> { ok }
//     POST {token, action:"review",  comments, note}          -> { ok }   line comments / change request
import { json, bad, requireAuth, store, uid, now, body, clean, publicUrl, totals, cleanReview } from "./_lib.js";

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
  const portals = store("portals");
  const clients = store("clients");
  const url = new URL(req.url);

  // ---- public reads ----
  if (req.method === "GET") {
    const portal = clean(url.searchParams.get("portal"), 40);
    if (portal) {
      const ref = await portals.get(portal, { type: "json" });
      if (!ref) return bad("This link is no longer available.", 404);
      const client = await clients.get(ref.clientId, { type: "json" });
      if (!client) return bad("This link is no longer available.", 404);
      const { blobs } = await estimates.list();
      const list = [];
      for (const b of blobs) {
        const e = await estimates.get(b.key, { type: "json" });
        if (e && e.clientId === ref.clientId && e.share?.token && e.status !== "draft") list.push(clientSafe(e));
      }
      list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      return json({ client: { name: client.name }, estimates: list, company: COMPANY });
    }
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
    let portalToken = null;
    if (e.clientId) { const c = await clients.get(e.clientId, { type: "json" }); portalToken = c?.portalToken || null; }
    return json({ estimate: clientSafe(e), company: COMPANY, portalToken });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await body(req)) || {};

  // ---- public: approve / review ----
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
      const rv = cleanReview({ comments: b.comments, note: b.note, withApproval: true });
      if (rv.comments.length || rv.note) e.review = rv;
      await estimates.setJSON(e.id, e);
      return json({ ok: true });
    }
    if (b.action === "review" || b.action === "changes") {
      const rv = cleanReview(b);
      if (!rv.comments.length && !rv.note) return bad("Add a comment or tell us what you would like changed.");
      e.status = "changes";
      e.share.changesAt = now();
      e.share.changesNote = rv.note || (rv.comments.length + " line comment" + (rv.comments.length === 1 ? "" : "s"));
      e.review = rv;
      await estimates.setJSON(e.id, e);
      return json({ ok: true, review: rv });
    }
    return bad("Unknown action");
  }

  // ---- owner actions ----
  const denied = requireAuth(req);
  if (denied) return denied;

  if (b.portal) {
    const clientId = clean(b.clientId, 40);
    const c = clientId ? await clients.get(clientId, { type: "json" }) : null;
    if (!c) return bad("Client not found", 404);
    let token = c.portalToken;
    if (!token || b.refresh) {
      if (token) await portals.delete(token);
      token = uid(14);
      await portals.setJSON(token, { clientId: c.id, createdAt: now() });
      c.portalToken = token; c.updatedAt = now();
      await clients.setJSON(c.id, c);
    }
    return json({ ok: true, token, url: `${publicUrl(req)}/c/${token}`, client: c });
  }

  const id = clean(b.id, 40);
  const e = id ? await estimates.get(id, { type: "json" }) : null;
  if (!e) return bad("Estimate not found", 404);
  if (!e.client?.name) return bad("Add a client before generating a link.");
  let token = e.share?.token;
  if (!token || b.refresh) {
    if (token) await shares.delete(token);
    token = uid(14);
    await shares.setJSON(token, { estimateId: e.id, createdAt: now() });
    e.share = { token, sentAt: now() };
  } else {
    e.share.sentAt = now();
  }
  // Re-issuing after feedback: file the review under history so the Review tab clears.
  if (e.review && (e.status === "changes" || e.status === "changed")) {
    e.reviewHistory = (e.reviewHistory || []).concat([{ ...e.review, closedAt: now() }]).slice(-20);
    e.review = null;
  }
  if (e.status === "draft" || e.status === "changed" || e.status === "changes") e.status = "sent";
  await estimates.setJSON(e.id, e);
  // Make sure the client has a portal link too, so the estimate page can link to "all your estimates".
  let portalToken = null;
  if (e.clientId) {
    const c = await clients.get(e.clientId, { type: "json" });
    if (c) {
      if (!c.portalToken) { c.portalToken = uid(14); await portals.setJSON(c.portalToken, { clientId: c.id, createdAt: now() }); c.updatedAt = now(); await clients.setJSON(c.id, c); }
      portalToken = c.portalToken;
    }
  }
  return json({ ok: true, token, url: `${publicUrl(req)}/e/${token}`, portalUrl: portalToken ? `${publicUrl(req)}/c/${portalToken}` : null, estimate: e });
};

function clientSafe(e) {
  const { share, reviewHistory, ...rest } = e;
  return { ...rest, share: { token: share?.token, sentAt: share?.sentAt, approvedAt: share?.approvedAt, approvedBy: share?.approvedBy, changesAt: share?.changesAt } };
}

export const config = { path: "/api/share" };
