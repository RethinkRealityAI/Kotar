// POST /api/ai-draft  { description, current?, library, templates, notes }
//   -> { estimate: {...} }   Gemini turns a plain-language job description into estimate JSON.
// The Gemini key lives only in the GEMINI_API_KEY environment variable.
import { json, bad, requireAuth, body, clean } from "./_lib.js";

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return bad("AI drafting is not set up yet: add GEMINI_API_KEY in Netlify environment variables.", 503);
  const b = await body(req);
  const description = clean(b?.description, 6000);
  if (!description) return bad("Describe the job first.");
  const update = !!b?.current;

  let model;
  try {
    model = await resolveModel(key);
  } catch (err) {
    return bad("Could not list Gemini models: " + err.message, 502);
  }

  const prompt = buildPrompt(description, b);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 8192 },
      }),
    });
  } catch (err) {
    return bad("Could not reach Gemini: " + err.message, 502);
  }
  if (!res.ok) {
    const txt = await res.text();
    let detail = "";
    try { detail = JSON.parse(txt)?.error?.message || ""; } catch {}
    console.error("gemini", model, res.status, txt.slice(0, 500));
    if (res.status === 429) return bad("Gemini is busy - wait a minute and try again.", 502);
    return bad(`Gemini error ${res.status} (${model})${detail ? ": " + detail.slice(0, 200) : ""}`, 502);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let out;
  try {
    out = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return bad("Gemini did not return a usable estimate. Try adding the client, the rooms and the price.", 502);
    try { out = JSON.parse(m[0]); } catch { return bad("Gemini did not return a usable estimate.", 502); }
  }
  if (!out || typeof out !== "object" || !Array.isArray(out.sections)) return bad("Gemini did not return a usable estimate.", 502);
  return json({ estimate: out, update, model });
};

// Pick a model: GEMINI_MODEL if set, otherwise the newest general-purpose "flash" model the key can use.
let cachedModel = null;
async function resolveModel(key) {
  const forced = (process.env.GEMINI_MODEL || "").trim();
  if (forced) return forced;
  if (cachedModel) return cachedModel;
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch {}
    if (res.status === 400 || res.status === 403) throw new Error(`the GEMINI_API_KEY was rejected (${res.status}${detail ? ": " + detail.slice(0, 160) : ""}). Create a key at aistudio.google.com/app/apikey and update it in Netlify.`);
    throw new Error(`models list returned ${res.status}${detail ? ": " + detail.slice(0, 160) : ""}`);
  }
  const data = await res.json();
  const names = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""));
  const score = (n) => {
    if (!/gemini/.test(n) || /(tts|image|audio|embed|live|thinking|exp|preview|8b|lite|nano|robotics|computer-use)/.test(n)) return -1;
    const ver = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
    return ver * 10 + (/flash/.test(n) ? 2 : /pro/.test(n) ? 1 : 0) + (/-latest$/.test(n) ? 0.5 : 0);
  };
  const ranked = names.map((n) => [score(n), n]).filter((r) => r[0] >= 0).sort((a, b) => b[0] - a[0]);
  cachedModel = ranked.length ? ranked[0][1] : "gemini-2.5-flash";
  console.log("gemini model resolved:", cachedModel, "from", names.length, "models");
  return cachedModel;
}

function buildPrompt(description, b) {
  const library = Array.isArray(b.library) ? b.library : [];
  const templates = b.templates || {};
  const notes = Array.isArray(b.notes) ? b.notes : [];
  const current = b.current || null;
  return `You fill in renovation estimates for Kotar Renovations, a residential renovation contractor in Hamilton, Ontario. The owner describes a job in plain words (often dictated, so tolerate speech-to-text errors). Turn it into the estimate JSON below.

Return ONLY a JSON object with exactly this shape:
{"client":{"name":"","address":"","email":"","phone":""},"project":"","pricingMode":"lump"|"section","lumpSubtotal":0,"taxRate":13,"sections":[{"key":"","title":"","items":[""],"amount":0}],"notesText":""}

Rules:
1. Scope comes from Kotar's scope library (below). Use library sections (copy "key" and "title") and their item wording whenever they fit; adjust, add or drop items to match what was described. Include only trades the description mentions or clearly implies: a "full gut" implies siteprep, demo and cleanup; a new shower implies plumbing and tile; "glass door" implies glass; a kitchen job implies cabinets/countertops/backsplash/appliances as mentioned. The TEMPLATES list shows the usual section set per job type - use the matching one as the backbone and prune it. Keep the library's order. For something not in the library, add a section with "key":"" and a short title. A line ending in ":" is a sub-heading (keep "Rough in and finish of:" for plumbing and electrical). Every item is a short, plain, trade-style line like the library's. Adapt bathroom-specific wording to the room described (e.g. "Complete gut of kitchen").
2. Prices: never invent a number. One total given => "pricingMode":"lump" and "lumpSubtotal" = that amount BEFORE HST (if the owner says the figure includes HST, divide by 1.13 and round to cents). Amounts per trade given => "pricingMode":"section" with each section's "amount". No price given => "lump" and 0. Amounts are plain numbers, no "$" or commas.
3. "taxRate" is 13 unless the owner says otherwise.
4. "notesText": the standard notes (below), one per line, plus any condition the owner states (exclusions, timing, allowances). Do not add conditions the owner did not state.
5. "project": a 2-6 word title such as "Main bathroom renovation". Client fields you were not told stay "". Do not guess an address or email.
6. Ontario spelling and terms (e.g. "potlight", "vanity", "HST", "eavestrough").
${current ? "7. A CURRENT ESTIMATE is provided. Treat the description as CHANGES to it: keep everything it does not mention, apply what it does, and return the complete updated estimate." : "7. This is a NEW estimate; ignore any earlier context."}

SCOPE LIBRARY:
${JSON.stringify(library)}

TEMPLATES (section keys per job type):
${JSON.stringify(templates)}

STANDARD NOTES:
${JSON.stringify(notes)}
${current ? `\nCURRENT ESTIMATE:\n${JSON.stringify(current)}\n` : ""}
JOB DESCRIPTION FROM THE OWNER:
"""
${description}
"""`;
}

export const config = { path: "/api/ai-draft" };
