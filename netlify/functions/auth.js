// POST /api/auth  { passcode }  -> { ok, gated, ai }
// GET  /api/auth               -> { gated, ai }   (does the app need a passcode? is AI configured?)
import { json, requireAuth, body } from "./_lib.js";

export default async (req) => {
  const gated = !!(process.env.APP_PASSCODE || "").trim();
  const ai = !!(process.env.GEMINI_API_KEY || "").trim();
  if (req.method === "GET") return json({ gated, ai });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = (await body(req)) || {};
  const probe = new Request(req.url, { method: "GET", headers: { "x-passcode": String(b.passcode || "") } });
  const denied = requireAuth(probe);
  if (denied) return json({ ok: false, error: "That passcode is not right." }, 401);
  return json({ ok: true, gated, ai });
};

export const config = { path: "/api/auth" };
