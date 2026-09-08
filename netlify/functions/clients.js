// /api/clients
//   GET            -> [clients]
//   POST   {client}-> client (create or update; id optional)
//   DELETE ?id=    -> { ok }
import { json, bad, requireAuth, store, readAll, uid, now, body, clean } from "./_lib.js";

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const s = store("clients");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const list = await readAll("clients");
    list.sort((a, b) => a.name.localeCompare(b.name));
    return json(list);
  }

  if (req.method === "POST") {
    const b = await body(req);
    if (!b || !clean(b.name)) return bad("Client name is required");
    const id = clean(b.id, 40) || uid();
    const existing = await s.get(id, { type: "json" });
    const client = {
      id,
      name: clean(b.name, 120),
      address: clean(b.address, 240),
      email: clean(b.email, 160),
      phone: clean(b.phone, 60),
      notes: clean(b.notes, 2000),
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    await s.setJSON(id, client);
    return json(client);
  }

  if (req.method === "DELETE") {
    const id = clean(url.searchParams.get("id"), 40);
    if (!id) return bad("id required");
    await s.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/clients" };
