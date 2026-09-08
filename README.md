# Kotar Estimates

Estimate builder for Kotar Renovations, deployed on Netlify. Static front end + Netlify Functions,
with Netlify Blobs as the data store (clients, estimates, client links). No database to manage.

## What it does

- **Dashboard** - every estimate with status (Draft, Sent, Viewed, Approved, Changes requested),
  totals, search and filters; pipeline and approved-value stats.
- **Clients** - add clients once, pick them on any estimate; "Save as client" from a drafted estimate.
- **Builder** - describe the job (type or dictate) and Gemini drafts the estimate; scope library of
  37 trade sections in 7 categories with search and custom sections; Bathroom / Kitchen / Basement /
  Blank templates; single-total or per-section pricing; HST auto-calculated; live preview; PDF.
- **Client approval links** - "Send to client" creates a private link (`/e/<token>`). The client
  reviews, downloads the PDF, and approves with a typed name, or requests changes. The dashboard
  shows sent / opened / approved timestamps. Editing an approved estimate flags it for re-sending.

## Deploy

1. Push this folder to a Git repo and create a Netlify site from it (or drag-and-drop / `netlify deploy`).
   Build settings are in `netlify.toml` (publish `public`, functions `netlify/functions`).
2. In Netlify: **Site configuration > Environment variables**, add:
   - `GEMINI_API_KEY` - from https://aistudio.google.com/app/apikey (required for AI drafting)
   - `GEMINI_MODEL` - optional, defaults to `gemini-2.5-flash`
   - `APP_PASSCODE` - the team passcode that gates the app (set this in production)
   - `PUBLIC_URL` - optional, e.g. `https://estimates.kotarrenovationsinc.ca` (used in client links)
3. Redeploy after adding variables. Netlify Blobs is enabled automatically for the site.

## Local development

```
npm install
cp .env.example .env     # fill in values
npx netlify dev          # http://localhost:8888
```

## Structure

```
public/            static app
  index.html       dashboard, clients, builder
  estimate.html    client approval page (served at /e/<token>)
  app.js           app logic
  client.js        approval page logic
  common.js        scope library, templates, totals, paper preview, PDF (shared)
  styles.css
  kotar-logo.png
netlify/functions/
  auth.js          GET: is the app gated / is AI configured; POST: check passcode
  clients.js       GET / POST / DELETE clients
  estimates.js     GET / POST / DELETE estimates
  share.js         create client link (auth); public GET / approve / request changes
  ai-draft.js      Gemini drafting (key never leaves the server)
  _lib.js          shared helpers (blobs, auth, normalisation, totals)
```

## Security notes

- The Gemini key is read only inside `ai-draft.js`. Never put it in `public/`.
- `APP_PASSCODE` is compared server-side on every API call. The browser remembers it in localStorage
  after a successful login; clearing site data logs out.
- Client links are unguessable 14-character tokens. "New link" in the builder revokes the old one.
- Approval records the typed name, time, and the requester IP.
