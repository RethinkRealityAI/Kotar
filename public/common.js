/* Kotar Estimates - shared front-end module (app + client page).
   Scope library, templates, money/date helpers, paper preview HTML, jsPDF builder. ASCII only. */
window.Kotar = (function () {
  "use strict";

  var COMPANY = {
    name: "Kotar Renovations",
    contact: "Trevor Kotar",
    address: "440 Cochrane Rd, Hamilton, ON",
    phone: "289-237-9622",
    email: "info@kotarrenovationsinc.ca",
    hst: "732482419 RT0001",
    logo: "/kotar-logo.png"
  };

  var CATS = ["Prep & Demo", "Bathroom", "Kitchen", "Interior", "Exterior", "Systems", "Finishing", "Custom"];
  var DEFAULT_LIB = [
    { k: "siteprep", c: "Prep & Demo", t: "Site Prep", i: ["Install floor protection from the main entrance to the working area"] },
    { k: "demo", c: "Prep & Demo", t: "Demo", i: ["Complete gut of bathroom", "Dispose of all garbage"] },
    { k: "permits", c: "Prep & Demo", t: "Permits & Inspections", i: ["Apply for building permit on the client's behalf", "Schedule and attend all required inspections", "Permit fees billed at cost"] },
    { k: "cleanup", c: "Prep & Demo", t: "Clean Up", i: ["Work area to be swept daily", "Main path of travel from entrance to work area to be swept daily", "Tools to be put away neatly at the end of each day"] },
    { k: "plumbing", c: "Bathroom", t: "Plumbing", i: ["Rough in and finish of:", "New toilet (re-use toilet, new location)", "New vanity", "New shower"] },
    { k: "electrical", c: "Bathroom", t: "Electrical", i: ["Rough in and finish of:", "New bathroom fan", "New vanity light fixture", "New potlight", "Upgrade existing electrical items such as switch, receptacle"] },
    { k: "tile", c: "Bathroom", t: "Tile", i: ["Pour self leveller on bathroom floor", "Install uncoupling membrane on bathroom floor", "Install pre-waterproofed shower base", "Waterproof shower walls", "Install shower niche", "Tile shower floor", "Tile shower walls", "Tile bathroom floor", "Grout all tiled areas"] },
    { k: "glass", c: "Bathroom", t: "Glass", i: ["Glass to be installed with door for shower"] },
    { k: "misc", c: "Bathroom", t: "Misc", i: ["Install vanity", "Install toilet paper holder", "Install towel bars"] },
    { k: "tub", c: "Bathroom", t: "Tub", i: ["Remove existing tub", "Install new tub (client-supplied), level and secure", "Install tub filler and drain", "Waterproof and tile tub surround"] },
    { k: "heatedfloor", c: "Bathroom", t: "Heated Floor", i: ["Install electric in-floor heating mat under tile", "Install thermostat and dedicated circuit"] },
    { k: "cabinets", c: "Kitchen", t: "Cabinets", i: ["Install client-supplied cabinets, level and secure", "Install crown, fillers and toe kick", "Install cabinet hardware"] },
    { k: "countertops", c: "Kitchen", t: "Countertops", i: ["Template for countertop after cabinets are installed", "Coordinate countertop fabricator and installation", "Cut out and mount undermount sink"] },
    { k: "backsplash", c: "Kitchen", t: "Backsplash", i: ["Prep wall surface", "Tile backsplash", "Grout and seal"] },
    { k: "appliances", c: "Kitchen", t: "Appliances", i: ["Disconnect and remove existing appliances", "Hook up dishwasher, range and hood fan", "Vent hood fan to exterior"] },
    { k: "framing", c: "Interior", t: "Framing", i: ["Frame new walls as per plan", "Frame openings for doors and windows", "Frame bulkheads as required"] },
    { k: "insulation", c: "Interior", t: "Insulation & Vapour Barrier", i: ["Insulate exterior walls to code", "Install 6 mil vapour barrier and seal all seams", "Insulate and vapour barrier ceiling where required"] },
    { k: "drywall", c: "Interior", t: "Drywall", i: ["Install resilient channel on the ceiling", "Drywall entire bathroom", "Tape and mud all drywall", "Sand drywall to a paint ready finish"] },
    { k: "flooring", c: "Interior", t: "Flooring", i: ["Remove existing flooring", "Level subfloor as required", "Install new flooring (client-supplied)", "Install transitions and thresholds"] },
    { k: "doors", c: "Interior", t: "Doors & Windows", i: ["Supply and install pre-hung interior doors", "Install door hardware", "Install new window(s), insulate and seal", "Casing and trim around new units"] },
    { k: "stairs", c: "Interior", t: "Stairs & Railings", i: ["Install new stair treads and risers", "Install handrail and pickets", "Sand and finish"] },
    { k: "ceiling", c: "Interior", t: "Ceilings", i: ["Remove popcorn ceiling", "Install resilient channel", "Drywall, tape and sand ceiling"] },
    { k: "egress", c: "Interior", t: "Egress Window", i: ["Cut foundation for egress window", "Install window and window well", "Waterproof, drain and backfill"] },
    { k: "laundry", c: "Interior", t: "Laundry", i: ["Rough in washer box and dryer vent", "Install laundry sink", "Install shelving"] },
    { k: "closet", c: "Interior", t: "Closets & Shelving", i: ["Install closet organizer (client-supplied)", "Install shelving"] },
    { k: "fireplace", c: "Interior", t: "Fireplace", i: ["Frame and finish fireplace surround", "Install electric fireplace insert (client-supplied)", "Tile or stone facing"] },
    { k: "deck", c: "Exterior", t: "Deck", i: ["Dig and pour footings", "Frame deck with pressure-treated lumber", "Install decking (client's choice of material)", "Install railings and stairs"] },
    { k: "siding", c: "Exterior", t: "Siding", i: ["Remove existing siding", "Install house wrap and strapping", "Install new siding, trim and flashing"] },
    { k: "soffit", c: "Exterior", t: "Soffit, Fascia & Eavestrough", i: ["Remove existing soffit, fascia and eavestrough", "Install aluminum soffit and fascia", "Install eavestrough and downspouts"] },
    { k: "extdoor", c: "Exterior", t: "Exterior Doors", i: ["Remove existing door and frame", "Install new entry door (client-supplied)", "Insulate, seal and trim"] },
    { k: "fence", c: "Exterior", t: "Fence", i: ["Remove existing fence", "Dig and set posts in concrete", "Install rails, boards and gate"] },
    { k: "hvac", c: "Systems", t: "HVAC", i: ["Relocate or add supply and return ducts", "Vent bathroom and range exhaust to exterior", "Coordinate HVAC subtrade"] },
    { k: "panel", c: "Systems", t: "Electrical Panel", i: ["Upgrade panel (licensed electrician)", "Add circuits for new work", "ESA inspection"] },
    { k: "waterproofing", c: "Systems", t: "Waterproofing", i: ["Excavate along foundation", "Apply membrane and install drainage board", "Install weeping tile and backfill"] },
    { k: "trim", c: "Finishing", t: "Trim", i: ["Install casing around door and window", "Install baseboard along walls where necessary"] },
    { k: "paint", c: "Finishing", t: "Paint", i: ["Paint all drywall and trim"] },
    { k: "extpaint", c: "Finishing", t: "Exterior Paint & Stain", i: ["Power wash and prep surfaces", "Prime and paint trim", "Stain deck or fence"] }
  ];
  var DEFAULT_BY_KEY = {};
  DEFAULT_LIB.forEach(function (l) { DEFAULT_BY_KEY[l.k] = l; });

  /* The live library = defaults + the owner's edits (overrides / custom / hidden), kept in Netlify Blobs.
     LIB, BY_KEY and ORDER are mutated in place so everything holding a reference stays current. */
  var LIB = [], BY_KEY = {}, ORDER = [], LIBRARY_CFG = { overrides: {}, custom: [], hidden: [] };
  function applyLibrary(cfg) {
    cfg = cfg || {}; LIBRARY_CFG = { overrides: cfg.overrides || {}, custom: cfg.custom || [], hidden: cfg.hidden || [] };
    var next = DEFAULT_LIB.map(function (d) {
      var o = LIBRARY_CFG.overrides[d.k];
      return { k: d.k, c: (o && o.c) || d.c, t: (o && o.t) || d.t, i: (o && Array.isArray(o.i) ? o.i : d.i).slice(), builtin: true, hidden: LIBRARY_CFG.hidden.indexOf(d.k) >= 0, edited: !!o };
    });
    LIBRARY_CFG.custom.forEach(function (c) { if (c && c.k && c.t) next.push({ k: c.k, c: c.c || "Custom", t: c.t, i: (c.i || []).slice(), builtin: false, hidden: LIBRARY_CFG.hidden.indexOf(c.k) >= 0, edited: false }); });
    // keep category grouping: custom sections sit at the end of their category
    var catIdx = function (c) { var i = CATS.indexOf(c); return i < 0 ? CATS.length : i; };
    next.sort(function (a, b) { var d = catIdx(a.c) - catIdx(b.c); if (d) return d; if (a.builtin !== b.builtin) return a.builtin ? -1 : 1; return 0; });
    LIB.length = 0; next.forEach(function (l) { LIB.push(l); });
    Object.keys(BY_KEY).forEach(function (k) { delete BY_KEY[k]; }); LIB.forEach(function (l) { BY_KEY[l.k] = l; });
    ORDER.length = 0; LIB.map(function (l) { return l.k; }).filter(function (k) { return k !== "cleanup"; }).concat("cleanup").forEach(function (k) { ORDER.push(k); });
  }
  applyLibrary(null);
  function visibleLib() { return LIB.filter(function (l) { return !l.hidden; }); }
  function libraryConfig() { return JSON.parse(JSON.stringify(LIBRARY_CFG)); }
  function orderIdx(k) { var i = ORDER.indexOf(k); return i < 0 ? ORDER.length - 1.5 : i; }

  var TEMPLATES = {
    bathroom: { name: "Bathroom", desc: "Full gut - 11 sections, exactly the standard scope", keys: ["siteprep", "demo", "plumbing", "electrical", "drywall", "tile", "trim", "paint", "misc", "glass", "cleanup"] },
    kitchen: { name: "Kitchen", desc: "Demo through appliances - 13 sections", keys: ["siteprep", ["demo", ["Remove existing cabinets, countertop and flooring", "Dispose of all garbage"]], ["plumbing", ["Rough in and finish of:", "Relocate sink supply and drain", "Install faucet and sink", "Hook up dishwasher"]], ["electrical", ["Rough in and finish of:", "New potlights", "Under-cabinet lighting", "Dedicated circuits for appliances", "Upgrade switches and receptacles to code"]], ["drywall", ["Patch and repair drywall as required", "Tape and mud all drywall", "Sand drywall to a paint ready finish"]], "cabinets", "countertops", "backsplash", "flooring", "appliances", "trim", "paint", "cleanup"] },
    basement: { name: "Basement", desc: "Framing to paint - 13 sections", keys: ["siteprep", ["demo", ["Remove existing finishes as per scope", "Dispose of all garbage"]], "framing", "insulation", ["plumbing", ["Rough in and finish of:", "Bathroom rough-in (toilet, vanity, shower)", "Laundry connections"]], ["electrical", ["Rough in and finish of:", "Potlights throughout", "Switches and receptacles to code", "Smoke and CO detectors"]], "hvac", ["drywall", ["Drywall all new walls and ceilings", "Tape and mud all drywall", "Sand drywall to a paint ready finish"]], "doors", "flooring", "trim", "paint", "cleanup"] },
    blank: { name: "Blank", desc: "Start empty and add scope as you go", keys: [] }
  };
  var STANDARD_NOTES = [
    "Overall cost and scope of work is subject to change upon the completion of demo",
    "All design choices such as tile, vanity, mirror, light fixture etc. are not included",
    "Kotar Renovations tool trailer to remain on site from beginning to end if possible"
  ];

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function round2(n) { return Math.round((+n + Number.EPSILON) * 100) / 100; }
  var fmt = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
  function money(n) { return fmt.format(round2(n)); }
  function parseMoney(s) { var n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; }
  function longDate(iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-").map(Number); if (!p[0]) return iso; return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }); }
  function whenText(iso) { if (!iso) return ""; var d = new Date(iso); return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function sectionsFromTemplate(id) {
    return (TEMPLATES[id] || TEMPLATES.blank).keys.map(function (k) {
      var key = Array.isArray(k) ? k[0] : k; var lib = BY_KEY[key] || DEFAULT_BY_KEY[key];
      if (!lib || lib.hidden) return null;
      var items = Array.isArray(k) ? k[1] : lib.i;
      return { id: uid(), key: key, title: lib.t, items: items.slice(), amount: 0 };
    }).filter(Boolean);
  }
  /* Does this estimate section differ from its library version? */
  function differsFromLibrary(s) {
    var l = s.key && BY_KEY[s.key]; if (!l) return false;
    var a = s.items.map(function (x) { return x.trim(); }).filter(Boolean), b = l.i.map(function (x) { return x.trim(); }).filter(Boolean);
    return s.title.trim() !== l.t || a.length !== b.length || a.some(function (x, i) { return x !== b[i]; });
  }
  function newEstimate(tpl) {
    return { id: "", number: "", date: todayISO(), project: "", clientId: "", client: { name: "", address: "", email: "", phone: "" },
      pricingMode: "lump", lumpSubtotal: 0, taxRate: 13, sections: sectionsFromTemplate(tpl || "bathroom"), notesText: STANDARD_NOTES.join("\n"), status: "draft", share: null };
  }
  function keyForTitle(t) { var n = String(t || "").trim().toLowerCase(); var hit = LIB.filter(function (l) { return l.t.toLowerCase() === n; })[0]; return hit ? hit.k : ""; }
  function normalize(e) {
    e = e || {};
    var n = newEstimate("blank");
    var out = Object.assign({}, n, e);
    out.client = Object.assign({}, n.client, e.client || {});
    out.sections = (Array.isArray(e.sections) ? e.sections : []).filter(function (s) { return s && s.on !== false; }).map(function (s) {
      return { id: s.id || uid(), key: s.key || keyForTitle(s.title), title: String(s.title || ""), items: Array.isArray(s.items) ? s.items.map(String) : String(s.items || "").split("\n"), amount: +s.amount || 0 };
    });
    out.notesText = String(out.notesText || "");
    out.taxRate = isFinite(+e.taxRate) ? +e.taxRate : 13;
    out.lumpSubtotal = +e.lumpSubtotal || 0;
    out.pricingMode = e.pricingMode === "section" ? "section" : "lump";
    out.number = String(out.number || ""); out.project = String(out.project || ""); out.clientId = String(out.clientId || "");
    out.status = out.status || "draft";
    return out;
  }
  function insertSection(est, sec) { var pos = 0; est.sections.forEach(function (s, i) { if (orderIdx(s.key) <= orderIdx(sec.key)) pos = i + 1; }); est.sections.splice(pos, 0, sec); }
  function totals(e) {
    var sub = e.pricingMode === "section" ? e.sections.reduce(function (a, s) { return a + (+s.amount || 0); }, 0) : (+e.lumpSubtotal || 0);
    var tax = round2(round2(sub) * (+e.taxRate || 0) / 100);
    return { sub: round2(sub), tax: tax, total: round2(round2(sub) + tax) };
  }
  function activeSections(e) { return e.sections.filter(function (s) { return s.title.trim() || s.items.some(function (i) { return i.trim(); }); }); }
  function notesList(e) { return (e.notesText || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean); }
  function fileBase(e) { var who = (e.client.name || "Client").replace(/[\\/:*?"<>|]+/g, " ").trim(); return "Kotar Estimate - " + who + " - " + (e.date || todayISO()); }

  var STATUS = {
    draft: { label: "Draft", cls: "s-draft" },
    sent: { label: "Sent", cls: "s-sent" },
    viewed: { label: "Viewed", cls: "s-viewed" },
    approved: { label: "Approved", cls: "s-approved" },
    changes: { label: "Changes requested", cls: "s-changes" },
    changed: { label: "Edited after approval", cls: "s-changes" }
  };
  function statusPill(st) { var s = STATUS[st] || STATUS.draft; return '<span class="pill ' + s.cls + '">' + s.label + "</span>"; }

  /* ---------- paper preview (shared by app + client page) ---------- */
  function paperHTML(est, co) {
    co = co || COMPANY;
    var t = totals(est), perSec = est.pricingMode === "section";
    var coMeta = [co.contact, co.address, co.phone, co.email, co.hst ? "GST/HST " + co.hst : ""].filter(Boolean).map(esc).join("<br>");
    var clientLines = [est.client.address, est.client.email, est.client.phone].filter(Boolean).map(esc).join("\n");
    var html = '<div class="ph"><div class="co"><img src="' + esc(co.logo || COMPANY.logo) + '" alt=""><div><div class="name">' + esc(co.name) + '</div><div class="meta">' + coMeta + "</div></div></div>" +
      '<div class="est"><div class="word">Estimate</div><div class="meta">' + (est.number ? "No. " + esc(est.number) + "<br>" : "") + esc(longDate(est.date)) + "</div></div></div>" +
      '<div class="pclient"><div><div class="lab">Estimate for</div><div class="who">' + (est.client.name ? esc(est.client.name) : '<span class="empty">Client name</span>') + '</div><div>' + clientLines + "</div></div>" +
      "<div>" + (est.project ? '<div class="lab">Project</div><div class="who">' + esc(est.project) + "</div>" : "") + "</div></div>" +
      '<h2 class="scope">Scope of Work</h2>';
    var secs = activeSections(est);
    if (!secs.length) html += '<p class="empty">No scope added yet.</p>';
    secs.forEach(function (s) {
      var items = s.items.map(function (x) { return x.trim(); }).filter(Boolean);
      html += '<div class="psec"><div class="st"><h3>' + esc(s.title) + "</h3>" + (perSec ? '<span class="amt">' + money(s.amount) + "</span>" : "") + "</div>";
      if (items.length) html += "<ul>" + items.map(function (x) { return /:$/.test(x) ? '<li class="sub">' + esc(x) + "</li>" : "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      html += "</div>";
    });
    html += '<div class="ptotals"><div><span>Sub-total</span><span>' + money(t.sub) + "</span></div><div><span>HST (" + (+est.taxRate || 0) + "%)</span><span>" + money(t.tax) + '</span></div><div class="grand"><span>Total</span><span>' + money(t.total) + "</span></div></div>";
    var notes = notesList(est);
    if (notes.length) html += '<div class="pnotes">' + notes.map(function (n) { return "<p>* " + esc(n) + "</p>"; }).join("") + "</div>";
    if (est.status === "approved" && est.share && est.share.approvedAt) html += '<div class="papproved">Approved by ' + esc(est.share.approvedBy) + " on " + esc(longDate(est.share.approvedAt)) + "</div>";
    html += '<div class="pfoot">' + esc(co.name) + (co.phone ? " &middot; " + esc(co.phone) : "") + (co.email ? " &middot; " + esc(co.email) : "") + "</div>";
    return html;
  }

  /* ---------- PDF (jsPDF, letter) ---------- */
  var logoCache = null;
  function loadLogo(src) {
    if (logoCache) return Promise.resolve(logoCache);
    return new Promise(function (resolve) {
      var done = false; function fin(v) { if (!done) { done = true; resolve(v); } }
      var img = new Image(); img.crossOrigin = "anonymous";
      img.onload = function () { try { var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); logoCache = c.toDataURL("image/png"); fin(logoCache); } catch (e) { fin(null); } };
      img.onerror = function () { fin(null); };
      setTimeout(function () { fin(null); }, 3000);
      img.src = src;
    });
  }
  function buildPDF(est, co, logoData) {
    co = co || COMPANY;
    var jsPDF = window.jspdf.jsPDF; var doc = new jsPDF({ unit: "pt", format: "letter" });
    var W = 612, H = 792, M = 54, CW = W - 2 * M, y = M;
    var ACC = [168, 32, 48], INK = [35, 35, 35], MUT = [108, 104, 102], LINE = [222, 219, 215];
    var t = totals(est), perSec = est.pricingMode === "section";
    function footer() { var n = doc.getNumberOfPages(); for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(MUT[0], MUT[1], MUT[2]); doc.text([co.name, co.phone, co.email].filter(Boolean).join("   -   "), M, H - 30); doc.text("Page " + i + " of " + n, W - M, H - 30, { align: "right" }); } }
    function need(h) { if (y + h > H - 60) { doc.addPage(); y = M; } }
    function wrap(txt, w) { return doc.splitTextToSize(String(txt), w); }
    function col(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function line(c) { doc.setDrawColor(c[0], c[1], c[2]); }
    var x = M;
    if (logoData) { try { var p = doc.getImageProperties(logoData); var h = 54, w = Math.min(120, p.width * h / p.height); doc.addImage(logoData, p.fileType || "PNG", x, y - 2, w, h); x += w + 12; } catch (e) {} }
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); col(ACC); doc.text((co.name || "").toUpperCase(), x, y + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); col(MUT);
    var coLines = [co.contact, co.address, co.phone, co.email, co.hst ? "GST/HST " + co.hst : ""].filter(Boolean);
    coLines.forEach(function (l, i) { doc.text(l, x, y + 26 + i * 11); });
    doc.setFont("helvetica", "bold"); doc.setFontSize(26); col(INK); doc.text("ESTIMATE", W - M, y + 20, { align: "right", charSpace: 2 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); col(MUT);
    var meta = [est.number ? "No. " + est.number : "", longDate(est.date)].filter(Boolean);
    meta.forEach(function (l, i) { doc.text(l, W - M, y + 38 + i * 12, { align: "right" }); });
    y += Math.max(26 + coLines.length * 11, 64) + 8;
    line(ACC); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); col(MUT); doc.text("ESTIMATE FOR", M, y, { charSpace: 1 });
    if (est.project) doc.text("PROJECT", M + CW / 2, y, { charSpace: 1 });
    y += 13; doc.setFont("helvetica", "bold"); doc.setFontSize(11); col(INK); doc.text(est.client.name || "", M, y);
    if (est.project) doc.text(wrap(est.project, CW / 2 - 10), M + CW / 2, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); col(MUT);
    var cl = [est.client.address, est.client.email, est.client.phone].filter(Boolean);
    cl.forEach(function (l, i) { doc.text(l, M, y + 13 + i * 12); });
    y += 13 + cl.length * 12 + 6; line(LINE); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 22;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); col(ACC); doc.text("SCOPE OF WORK", M, y, { charSpace: 1.5 }); y += 12;
    activeSections(est).forEach(function (s, si) {
      var items = s.items.map(function (v) { return v.trim(); }).filter(Boolean);
      need(34);
      if (si > 0) { line(LINE); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); }
      y += 14;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); col(INK); doc.text(s.title.toUpperCase(), M, y, { charSpace: 0.8 });
      if (perSec) doc.text(money(s.amount), W - M, y, { align: "right" });
      y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      items.forEach(function (it) {
        var sub = /:$/.test(it); var lines = wrap(it, CW - (sub ? 0 : 16));
        need(lines.length * 12 + 2);
        if (sub) { doc.setFont("helvetica", "bold"); col(MUT); y += 12; doc.text(lines, M, y); }
        else { doc.setFont("helvetica", "normal"); col(INK); y += 12; doc.text("-", M + 5, y); doc.text(lines, M + 16, y); }
        y += (lines.length - 1) * 12;
      });
      y += 8;
    });
    need(90); y += 14; var tx = W - M - 220;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); col(INK);
    [["Sub-total", money(t.sub)], ["HST (" + (+est.taxRate || 0) + "%)", money(t.tax)]].forEach(function (r) { doc.text(r[0], tx, y); doc.text(r[1], W - M, y, { align: "right" }); y += 6; line(LINE); doc.setLineWidth(0.4); doc.line(tx, y, W - M, y); y += 14; });
    line(ACC); doc.setLineWidth(2); doc.line(tx, y - 6, W - M, y - 6); y += 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); col(ACC); doc.text("TOTAL", tx, y, { charSpace: 1.5 }); doc.setFontSize(15); doc.text(money(t.total), W - M, y, { align: "right" }); y += 24;
    var notes = notesList(est);
    if (notes.length) { need(30 + notes.length * 12); line(LINE); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 14; doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); col(MUT);
      notes.forEach(function (n) { var lines = wrap("* " + n, CW); need(lines.length * 11); doc.text(lines, M, y); y += lines.length * 11 + 2; }); }
    if (est.status === "approved" && est.share && est.share.approvedAt) { need(30); y += 10; doc.setFont("helvetica", "bold"); doc.setFontSize(9); col(ACC); doc.text("APPROVED BY " + String(est.share.approvedBy || "").toUpperCase() + " ON " + longDate(est.share.approvedAt).toUpperCase(), M, y); }
    footer();
    return doc;
  }
  function downloadPDF(est, co) {
    return loadLogo((co && co.logo) || COMPANY.logo).then(function (logo) {
      var doc = buildPDF(est, co, logo); var filename = fileBase(est) + ".pdf";
      var url = URL.createObjectURL(doc.output("blob")); var a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return filename;
    });
  }

  return { COMPANY: COMPANY, CATS: CATS, LIB: LIB, BY_KEY: BY_KEY, DEFAULT_BY_KEY: DEFAULT_BY_KEY, TEMPLATES: TEMPLATES, STANDARD_NOTES: STANDARD_NOTES, STATUS: STATUS,
    applyLibrary: applyLibrary, libraryConfig: libraryConfig, visibleLib: visibleLib, differsFromLibrary: differsFromLibrary,
    uid: uid, todayISO: todayISO, round2: round2, money: money, parseMoney: parseMoney, longDate: longDate, whenText: whenText, esc: esc,
    sectionsFromTemplate: sectionsFromTemplate, newEstimate: newEstimate, normalize: normalize, insertSection: insertSection, totals: totals, activeSections: activeSections, notesList: notesList, fileBase: fileBase,
    statusPill: statusPill, paperHTML: paperHTML, buildPDF: buildPDF, downloadPDF: downloadPDF, loadLogo: loadLogo };
})();
