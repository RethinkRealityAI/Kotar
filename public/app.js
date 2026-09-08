/* Kotar Estimates - app logic (dashboard, clients, scope library, builder). ASCII only. */
(function () {
  "use strict";
  var K = window.Kotar;
  var $ = function (id) { return document.getElementById(id); };
  var esc = K.esc, money = K.money;
  var PASS_KEY = "kotar.passcode";
  var ICON = {
    grip: '<svg class="i" viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
    up: '<svg class="i" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    del: '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    close: '<button class="iconbtn" data-close aria-label="Close"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    check: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>'
  };

  /* ---------- API ---------- */
  var passcode = "";
  try { passcode = sessionStorage.getItem(PASS_KEY) || localStorage.getItem(PASS_KEY) || ""; } catch (e) {}
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ "content-type": "application/json" }, opts.headers || {});
    if (passcode) headers["x-passcode"] = passcode;
    return fetch("/api/" + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 401) { showGate("Your passcode is no longer valid."); throw new Error("unauthorized"); }
          if (!r.ok) throw new Error(data.error || ("Request failed (" + r.status + ")"));
          return data;
        });
      });
  }

  /* ---------- state ---------- */
  var state = { estimates: [], clients: [], est: null, dirty: false, saving: false, aiReady: false, filter: "all", q: "", cq: "", lq: "", libShowHidden: false, libDirty: {} };

  function toast(msg, ms) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, ms || 2600); }

  /* ---------- gate ---------- */
  function showGate(err) { $("shell").hidden = true; $("gate").hidden = false; $("gateErr").textContent = err || ""; setTimeout(function () { $("gatePass").focus(); }, 30); }
  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pc = $("gatePass").value.trim();
    fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: pc }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { $("gateErr").textContent = d.error || "That passcode is not right."; return; }
        passcode = pc; try { localStorage.setItem(PASS_KEY, pc); } catch (e2) {}
        state.aiReady = !!d.ai; boot();
      })
      .catch(function () { $("gateErr").textContent = "Could not reach the server. Try again."; });
  });

  function boot() {
    $("gate").hidden = true; $("shell").hidden = false;
    Promise.all([api("estimates"), api("clients"), api("library")]).then(function (r) {
      K.applyLibrary(r[2]);
      state.estimates = r[0].map(K.normalize); state.clients = r[1];
      route();
    }).catch(function (e) { if (e.message !== "unauthorized") toast("Could not load: " + e.message); });
  }

  fetch("/api/auth").then(function (r) { return r.json(); }).then(function (d) {
    state.aiReady = !!d.ai;
    if (d.gated && !passcode) return showGate("");
    if (d.gated) {
      return fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: passcode }) })
        .then(function (r) { return r.json(); }).then(function (v) { if (v.ok) boot(); else showGate(""); });
    }
    boot();
  }).catch(function () { showGate("Could not reach the server. Refresh to try again."); });

  /* ---------- routing ---------- */
  window.addEventListener("hashchange", route);
  function nav(h) { if (location.hash === h) route(); else location.hash = h; }
  document.querySelectorAll("[data-nav]").forEach(function (b) { b.onclick = function () { nav(b.dataset.nav); }; });
  function route() {
    var h = location.hash || "#/";
    var isClients = h.indexOf("#/clients") === 0, isLib = h.indexOf("#/library") === 0, isReview = h.indexOf("#/review") === 0, isEst = h.indexOf("#/estimate/") === 0, isNew = h.indexOf("#/new") === 0;
    if (state.dirty && state.est && !isEst) flushSave();
    $("viewList").hidden = !(!isClients && !isLib && !isReview && !isEst && !isNew);
    $("viewClients").hidden = !isClients;
    $("viewLibrary").hidden = !isLib;
    $("viewReview").hidden = !isReview;
    $("viewBuilder").hidden = !(isEst || isNew);
    $("tabEstimates").classList.toggle("on", !isClients && !isLib && !isReview);
    $("tabClients").classList.toggle("on", isClients);
    $("tabLibrary").classList.toggle("on", isLib);
    $("tabReview").classList.toggle("on", isReview);
    updateReviewBadge();
    if (isClients) renderClients();
    else if (isLib) renderLibrary();
    else if (isReview) renderReview();
    else if (isEst) openEstimate(h.slice("#/estimate/".length));
    else if (!isNew) renderList();
    window.scrollTo(0, 0);
  }

  /* ---------- modal helper ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    var host = $("modalHost");
    host.innerHTML = '<div class="overlay" role="dialog" aria-modal="true"><div class="modal' + (opts.narrow ? " narrow" : "") + '">' + html + "</div></div>";
    var ov = host.firstElementChild;
    function close() { host.innerHTML = ""; document.removeEventListener("keydown", onKey); if (opts.onClose) opts.onClose(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = close; });
    document.addEventListener("keydown", onKey);
    return { el: ov.firstElementChild, close: close };
  }
  /* In-app confirmation (never the browser's confirm()). Resolves true/false. */
  function ask(o) {
    return new Promise(function (resolve) {
      var m = openModal('<header><h2>' + esc(o.title || "Are you sure?") + "</h2>" + ICON.close + '</header><div class="form"><p>' + esc(o.body || "") + "</p>" + (o.sub ? '<p class="sub">' + esc(o.sub) + "</p>" : "") + "</div>" +
        '<footer><span class="spacer"></span><button class="btn quiet" type="button" data-close>' + esc(o.cancelText || "Cancel") + '</button><button class="btn ' + (o.danger ? "primary" : "primary") + '" type="button" id="askOk">' + esc(o.okText || "Continue") + "</button></footer>", { narrow: true, onClose: function () { resolve(false); } });
      m.el.classList.add("confirm");
      var ok = m.el.querySelector("#askOk"); if (o.danger) { ok.style.background = "var(--danger)"; ok.style.borderColor = "var(--danger)"; }
      ok.onclick = function () { resolve(true); m.close(); };
      setTimeout(function () { ok.focus(); }, 30);
    });
  }

  /* ---------- line editor (shared) ----------
     host: element; items: array of strings (mutated in place); onChange(): called after any edit.
     Enter = new line below, Backspace on empty = remove, arrows move between lines, "+" under each line. */
  function lineEditor(host, items, onChange, opts) {
    opts = opts || {};
    function isSub(v) { return /:\s*$/.test(v); }
    function draw(focusIdx, caretEnd) {
      host.innerHTML = "";
      var wrap = document.createElement("div"); wrap.className = "lines";
      if (!items.length) { var em = document.createElement("div"); em.className = "empty-lines"; em.textContent = opts.emptyText || "No lines yet."; wrap.appendChild(em); }
      items.forEach(function (v, i) {
        var row = document.createElement("div"); row.className = "line" + (isSub(v) ? " sub" : "");
        row.innerHTML = '<span class="mark" aria-hidden="true">-</span><input value="' + esc(v) + '" placeholder="' + esc(opts.placeholder || "Describe the work") + '" aria-label="Line ' + (i + 1) + '">' +
          '<div class="ltools"><button type="button" class="iconbtn" data-a="add" title="Add a line below (Enter)">' + ICON.plus + '</button><button type="button" class="iconbtn" data-a="del" title="Remove line">' + ICON.x + "</button></div>";
        var inp = row.querySelector("input");
        inp.addEventListener("input", function () { items[i] = inp.value; row.classList.toggle("sub", isSub(inp.value)); onChange(); });
        inp.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { ev.preventDefault(); items.splice(i + 1, 0, ""); onChange(); draw(i + 1); }
          else if (ev.key === "Backspace" && inp.value === "" && items.length > 0) { ev.preventDefault(); items.splice(i, 1); onChange(); draw(Math.max(0, i - 1), true); }
          else if (ev.key === "ArrowUp" && i > 0) { ev.preventDefault(); focus(i - 1); }
          else if (ev.key === "ArrowDown" && i < items.length - 1) { ev.preventDefault(); focus(i + 1); }
        });
        row.querySelector('[data-a="add"]').onclick = function () { items.splice(i + 1, 0, ""); onChange(); draw(i + 1); };
        row.querySelector('[data-a="del"]').onclick = function () { items.splice(i, 1); onChange(); draw(Math.min(i, items.length - 1), true); };
        if (opts.decorate) opts.decorate(row, i, v);
        wrap.appendChild(row);
      });
      var add = document.createElement("button"); add.type = "button"; add.className = "addline"; add.innerHTML = ICON.plus + (opts.addLabel || "Add line");
      add.onclick = function () { items.push(""); onChange(); draw(items.length - 1); };
      wrap.appendChild(add);
      host.appendChild(wrap);
      if (focusIdx != null && focusIdx >= 0) focus(focusIdx, caretEnd);
    }
    function focus(i, caretEnd) { var inp = host.querySelectorAll(".line input")[i]; if (inp) { inp.focus(); if (caretEnd) { var n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} } } }
    draw();
    return { redraw: draw, focus: focus };
  }
  function cleanItems(items) { return items.map(function (x) { return String(x).trim(); }).filter(Boolean); }

  /* ---------- dashboard ---------- */
  $("listSearch").addEventListener("input", function () { state.q = this.value.trim().toLowerCase(); renderList(); });
  $("listFilters").querySelectorAll("button").forEach(function (b) { b.onclick = function () { state.filter = b.dataset.f; $("listFilters").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderList(); }; });
  function renderList() {
    var list = state.estimates.slice();
    var counts = { total: list.length, open: 0, pipeline: 0, won: 0 };
    list.forEach(function (e) { var t = K.totals(e).total; if (e.status === "approved") counts.won += t; else if (e.status !== "draft") { counts.open++; counts.pipeline += t; } });
    $("stats").innerHTML =
      '<div class="stat"><b>' + counts.total + "</b><span>Estimates</span></div>" +
      '<div class="stat"><b>' + counts.open + "</b><span>Waiting on clients</span></div>" +
      '<div class="stat"><b>' + money(counts.pipeline) + "</b><span>Out for approval</span></div>" +
      '<div class="stat hot"><b>' + money(counts.won) + "</b><span>Approved</span></div>";
    if (state.filter !== "all") list = list.filter(function (e) { return state.filter === "changes" ? (e.status === "changes" || e.status === "changed") : e.status === state.filter; });
    if (state.q) list = list.filter(function (e) { return [e.client.name, e.project, e.number, e.client.address].join(" ").toLowerCase().indexOf(state.q) >= 0; });
    var html = '<div class="thead"><span>Client</span><span>Project</span><span style="text-align:right">Total</span><span>Status</span><span>Updated</span><span></span></div>';
    if (!list.length) html += '<div class="empty"><b>' + (state.estimates.length ? "Nothing matches" : "No estimates yet") + "</b>" + (state.estimates.length ? "Try another filter or search." : "Press New estimate, describe the job, and send it to the client.") + "</div>";
    list.forEach(function (e) {
      html += '<div class="row" data-id="' + esc(e.id) + '"><div class="t">' + esc(e.client.name || "Untitled") + "<small>" + esc(e.number || "") + "</small></div>" +
        '<div class="cl">' + esc(e.project || "") + '</div><div class="num">' + money(K.totals(e).total) + "</div><div>" + K.statusPill(e.status) + '</div><div class="dt">' + esc(K.whenText(e.updatedAt)) + '</div>' +
        '<button class="iconbtn del" data-del="' + esc(e.id) + '" title="Delete">' + ICON.del + "</button></div>";
    });
    $("listTable").innerHTML = html;
    $("listTable").querySelectorAll(".row").forEach(function (r) { r.onclick = function (ev) { if (ev.target.closest("[data-del]")) return; nav("#/estimate/" + r.dataset.id); }; });
    $("listTable").querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { deleteEstimate(b.dataset.del); }; });
  }
  function deleteEstimate(id) {
    var e = state.estimates.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    ask({ title: "Delete this estimate?", body: "The estimate for " + (e.client.name || "this client") + " will be removed and its client link will stop working.", sub: "This cannot be undone.", okText: "Delete", danger: true }).then(function (yes) { if (!yes) return;
    api("estimates?id=" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
      state.estimates = state.estimates.filter(function (x) { return x.id !== id; });
      if (state.est && state.est.id === id) { state.est = null; state.dirty = false; }
      toast("Deleted"); nav("#/");
    }).catch(function (er) { toast(er.message); });
    });
  }

  /* ---------- clients ---------- */
  $("clientSearch").addEventListener("input", function () { state.cq = this.value.trim().toLowerCase(); renderClients(); });
  $("btnNewClient").onclick = function () { openClientModal(null, function () { renderClients(); }); };
  function renderClients() {
    var list = state.clients.filter(function (c) { return !state.cq || [c.name, c.address, c.email, c.phone].join(" ").toLowerCase().indexOf(state.cq) >= 0; });
    if (!list.length) { $("clientCards").innerHTML = '<div class="table"><div class="empty"><b>' + (state.clients.length ? "No matches" : "No clients yet") + "</b>" + (state.clients.length ? "" : "Add your first client, or create one from inside an estimate.") + "</div></div>"; return; }
    $("clientCards").innerHTML = list.map(function (c) {
      var n = state.estimates.filter(function (e) { return e.clientId === c.id; }).length;
      return '<div class="ccard" data-id="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><div class="meta">' + [c.address, c.email, c.phone].filter(Boolean).map(esc).join("\n") + '</div><div class="foot"><span>' + n + " estimate" + (n === 1 ? "" : "s") + '</span><span>Edit</span></div></div>';
    }).join("");
    $("clientCards").querySelectorAll(".ccard").forEach(function (card) { card.onclick = function () { var c = state.clients.filter(function (x) { return x.id === card.dataset.id; })[0]; openClientModal(c, function () { renderClients(); }); }; });
  }
  function upsertClientLocal(c) { var i = state.clients.findIndex(function (x) { return x.id === c.id; }); if (i >= 0) state.clients[i] = c; else state.clients.push(c); state.clients.sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function openClientModal(client, done) {
    var c = client || { name: "", address: "", email: "", phone: "", notes: "" };
    var m = openModal('<header><h2>' + (client ? "Edit client" : "New client") + "</h2>" + ICON.close + "</header>" +
      '<form class="form" id="clientForm"><div class="grid2">' +
      '<div class="field span"><label>Name</label><input class="in" name="name" required value="' + esc(c.name) + '" placeholder="e.g. Debbie Thomson"></div>' +
      '<div class="field span"><label>Project address</label><input class="in" name="address" value="' + esc(c.address) + '" placeholder="Street, City, Province"></div>' +
      '<div class="field"><label>Email</label><input class="in" name="email" type="email" value="' + esc(c.email) + '"></div>' +
      '<div class="field"><label>Phone</label><input class="in" name="phone" value="' + esc(c.phone) + '"></div>' +
      '<div class="field span"><label>Notes <em>(private, never printed)</em></label><textarea class="in" name="notes" rows="2">' + esc(c.notes || "") + "</textarea></div></div></form>" +
      '<footer>' + (client ? '<button class="btn quiet danger" type="button" id="clientDel">Delete client</button>' : "") + '<span class="spacer"></span><button class="btn quiet" type="button" data-close>Cancel</button><button class="btn primary" type="submit" form="clientForm">' + (client ? "Save changes" : "Add client") + "</button></footer>", { narrow: true });
    var form = m.el.querySelector("#clientForm");
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var fd = new FormData(form); var payload = { id: c.id || "", name: fd.get("name"), address: fd.get("address"), email: fd.get("email"), phone: fd.get("phone"), notes: fd.get("notes") };
      if (!String(payload.name).trim()) return;
      api("clients", { method: "POST", body: payload }).then(function (saved) {
        upsertClientLocal(saved); m.close(); toast(client ? "Client updated" : "Client added");
        if (state.est && state.est.clientId === saved.id) applyClient(saved);
        if (done) done(saved);
      }).catch(function (er) { toast(er.message); });
    };
    var del = m.el.querySelector("#clientDel");
    if (del) del.onclick = function () {
      ask({ title: "Delete " + c.name + "?", body: "Existing estimates keep their copy of the client details. Their portal link will stop working.", okText: "Delete client", danger: true }).then(function (yes) { if (!yes) return;
        api("clients?id=" + encodeURIComponent(c.id), { method: "DELETE" }).then(function () { state.clients = state.clients.filter(function (x) { return x.id !== c.id; }); m.close(); toast("Client deleted"); if (done) done(null); }).catch(function (er) { toast(er.message); });
      });
    };
    setTimeout(function () { form.querySelector("[name=name]").focus(); }, 30);
  }

  /* ---------- scope library ---------- */
  var libSaveTimer = null;
  function saveLibrary(cfg, msg) {
    $("libState").textContent = "Saving...";
    return api("library", { method: "PUT", body: cfg }).then(function (saved) {
      K.applyLibrary(saved); $("libState").textContent = "Saved"; if (msg) toast(msg);
      if (!$("viewLibrary").hidden) renderLibrary();
      if (state.est && !$("viewBuilder").hidden) renderSections();
      return saved;
    }).catch(function (er) { $("libState").textContent = "Not saved: " + er.message; toast("Could not save library: " + er.message); throw er; });
  }
  function catSelect(value, cls) {
    return '<select class="in ' + (cls || "") + '" aria-label="Category">' + K.CATS.map(function (c) { return '<option value="' + esc(c) + '"' + (c === value ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>";
  }
  $("libSearch").addEventListener("input", function () { state.lq = this.value.trim().toLowerCase(); renderLibrary(); });
  $("libShowHidden").addEventListener("change", function () { state.libShowHidden = this.checked; renderLibrary(); });
  $("btnNewLib").onclick = function () { openNewSectionModal({ toLibrary: true, lockLibrary: true }); };
  function renderLibrary() {
    var host = $("libList"); host.innerHTML = "";
    var lib = K.LIB.filter(function (l) { return (state.libShowHidden || !l.hidden) && (!state.lq || l.t.toLowerCase().indexOf(state.lq) >= 0 || l.i.some(function (i) { return i.toLowerCase().indexOf(state.lq) >= 0; })); });
    if (!lib.length) { host.innerHTML = '<div class="table"><div class="empty"><b>Nothing matches</b>Try another search, or add a new scope section.</div></div>'; return; }
    K.CATS.forEach(function (cat) {
      var items = lib.filter(function (l) { return l.c === cat; }); if (!items.length) return;
      var sec = document.createElement("div"); sec.className = "libcat"; sec.innerHTML = "<h3>" + esc(cat) + "</h3>"; var grid = document.createElement("div"); grid.className = "libgrid"; sec.appendChild(grid);
      items.forEach(function (l) { grid.appendChild(libraryCard(l)); });
      host.appendChild(sec);
    });
  }
  function libraryCard(l) {
    var card = document.createElement("div"); card.className = "libcard" + (l.hidden ? " hidden-sec" : "");
    var draft = { t: l.t, c: l.c, i: l.i.slice() }; var dirty = false;
    var tags = (l.builtin ? "" : '<span class="tag custom">Custom</span>') + (l.edited ? '<span class="tag edited">Edited</span>' : "") + (l.hidden ? '<span class="tag removed">Removed</span>' : "");
    card.innerHTML = '<div class="lhead"><input class="title" value="' + esc(l.t) + '" aria-label="Section name">' + tags + catSelect(l.c) + "</div>" +
      '<div class="lbody"></div>' +
      '<div class="lfoot"><button class="btn sm primary" data-a="save" type="button" disabled>Save changes</button><button class="btn sm quiet" data-a="revert" type="button" hidden>Undo</button><span class="spacer"></span>' +
      (l.builtin && l.edited ? '<button class="btn sm quiet" data-a="reset" type="button" title="Back to the original wording">Reset to default</button>' : "") +
      (l.hidden ? '<button class="btn sm" data-a="restore" type="button">Restore</button>' : '<button class="btn sm quiet danger" data-a="remove" type="button" title="' + (l.builtin ? "Hide from the picker (you can restore it later)" : "Delete this custom section") + '">' + (l.builtin ? "Remove" : "Delete") + "</button>") + "</div>";
    var saveBtn = card.querySelector('[data-a="save"]'), revertBtn = card.querySelector('[data-a="revert"]');
    function mark() { dirty = draft.t.trim() !== l.t || draft.c !== l.c || JSON.stringify(cleanItems(draft.i)) !== JSON.stringify(cleanItems(l.i)); card.classList.toggle("dirty", dirty); saveBtn.disabled = !dirty; revertBtn.hidden = !dirty; }
    card.querySelector(".title").addEventListener("input", function () { draft.t = this.value; mark(); });
    card.querySelector("select").addEventListener("change", function () { draft.c = this.value; mark(); });
    lineEditor(card.querySelector(".lbody"), draft.i, mark, { emptyText: "No standard lines. Add one." });
    saveBtn.onclick = function () {
      if (!draft.t.trim()) { toast("Give the section a name."); return; }
      var cfg = K.libraryConfig(); var entry = { t: draft.t.trim(), c: draft.c, i: cleanItems(draft.i) };
      if (l.builtin) cfg.overrides[l.k] = entry; else { var c = cfg.custom.filter(function (x) { return x.k === l.k; })[0]; if (c) Object.assign(c, entry); else cfg.custom.push(Object.assign({ k: l.k }, entry)); }
      saveLibrary(cfg, "Saved " + entry.t + " to the library");
    };
    revertBtn.onclick = function () { renderLibrary(); };
    var reset = card.querySelector('[data-a="reset"]'); if (reset) reset.onclick = function () { ask({ title: "Reset " + l.t + "?", body: "This puts back Kotar's original wording for this section.", okText: "Reset to default" }).then(function (yes) { if (!yes) return; var cfg = K.libraryConfig(); delete cfg.overrides[l.k]; saveLibrary(cfg, "Reset to default"); }); };
    var remove = card.querySelector('[data-a="remove"]'); if (remove) remove.onclick = function () {
      var cfg = K.libraryConfig();
      if (l.builtin) { if (cfg.hidden.indexOf(l.k) < 0) cfg.hidden.push(l.k); saveLibrary(cfg, "Removed from the picker. Tick Show removed sections to restore it."); }
      else { ask({ title: "Delete " + l.t + " from the library?", body: "Estimates that already use this section are not affected.", okText: "Delete", danger: true }).then(function (yes) { if (!yes) return; cfg.custom = cfg.custom.filter(function (x) { return x.k !== l.k; }); cfg.hidden = cfg.hidden.filter(function (k) { return k !== l.k; }); saveLibrary(cfg, "Deleted " + l.t); }); }
    };
    var restore = card.querySelector('[data-a="restore"]'); if (restore) restore.onclick = function () { var cfg = K.libraryConfig(); cfg.hidden = cfg.hidden.filter(function (k) { return k !== l.k; }); saveLibrary(cfg, "Restored " + l.t); };
    return card;
  }
  // Add a brand-new section to the library (from the Library tab, the picker, or a builder section).
  function addCustomToLibrary(entry) {
    var cfg = K.libraryConfig(); var k = "c_" + K.uid();
    cfg.custom.push({ k: k, t: entry.t.trim(), c: entry.c || "Custom", i: cleanItems(entry.i) });
    return saveLibrary(cfg).then(function () { return k; });
  }
  function updateLibraryFromSection(s) {
    var l = K.BY_KEY[s.key]; if (!l) return Promise.resolve();
    var cfg = K.libraryConfig(); var entry = { t: s.title.trim() || l.t, c: l.c, i: cleanItems(s.items) };
    if (l.builtin) cfg.overrides[s.key] = entry; else { var c = cfg.custom.filter(function (x) { return x.k === s.key; })[0]; if (c) Object.assign(c, entry); }
    return saveLibrary(cfg, "Library updated: " + entry.t);
  }

  /* New section modal - used by the Library tab (lockLibrary), the picker, and the builder's "New one-off section".
     opts: { toLibrary: bool (default checkbox), lockLibrary: bool (always save to library, hide checkbox), addToEstimate: bool, afterId } */
  function openNewSectionModal(opts) {
    opts = opts || {};
    var draft = { t: "", c: "Custom", i: [""] };
    var m = openModal('<header><h2>' + (opts.lockLibrary ? "New scope section" : "New section") + "</h2>" + ICON.close + "</header>" +
      '<div class="form"><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><div class="field" style="flex:1;min-width:200px"><label>Section name</label><input class="in" id="nsName" placeholder="e.g. Pantry, Mudroom, Garage"></div><div class="field"><label>Category</label>' + catSelect("Custom") + "</div></div>" +
      '<div class="field"><label>Lines <em>(what the client sees under this section)</em></label><div class="lines-host" style="border:1px solid var(--line);border-radius:8px;padding:4px"></div></div>' +
      (opts.lockLibrary ? '<p class="note">Saved to the Scope Library so you can pick it on any estimate.</p>' : '<label class="check"><input type="checkbox" id="nsLib"' + (opts.toLibrary ? " checked" : "") + '> Also save to the Scope Library for future estimates</label>') +
      '</div><footer><span class="spacer"></span><button class="btn quiet" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="nsAdd">' + (opts.lockLibrary ? "Add to library" : "Add to estimate") + "</button></footer>", { narrow: true });
    var name = m.el.querySelector("#nsName"), cat = m.el.querySelector("select");
    lineEditor(m.el.querySelector(".lines-host"), draft.i, function () {}, { emptyText: "Add at least one line." });
    name.addEventListener("input", function () { draft.t = this.value; }); cat.addEventListener("change", function () { draft.c = this.value; });
    m.el.querySelector("#nsAdd").onclick = function () {
      draft.t = name.value.trim(); if (!draft.t) { name.focus(); toast("Give the section a name."); return; }
      var lib = opts.lockLibrary || (m.el.querySelector("#nsLib") && m.el.querySelector("#nsLib").checked);
      var finish = function (key) {
        if (opts.addToEstimate && state.est) {
          var sec = { id: K.uid(), key: key || "", title: draft.t, items: cleanItems(draft.i), amount: 0 };
          if (opts.afterId) { var idx = state.est.sections.findIndex(function (s) { return s.id === opts.afterId; }); state.est.sections.splice(idx + 1, 0, sec); } else K.insertSection(state.est, sec);
          renderSections(); changed(); toast("Added " + draft.t + (lib ? " (and saved to the library)" : ""));
          var el = $("sections").querySelector('[data-id="' + sec.id + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else toast("Added " + draft.t + " to the library");
        m.close(); if (opts.onDone) opts.onDone(key);
      };
      if (lib) addCustomToLibrary(draft).then(finish).catch(function () {}); else finish("");
    };
    setTimeout(function () { name.focus(); }, 30);
  }

  /* ---------- builder: load / new / save ---------- */
  function autoNumber(e) { var d = (e.date || K.todayISO()).replace(/-/g, ""); var n = state.estimates.filter(function (x) { return x.id !== e.id && (x.number || "").indexOf("KR-" + d) === 0; }).length + 1; return "KR-" + d + (n > 1 ? "-" + n : ""); }
  $("btnNew").onclick = openTemplatePicker;
  function openTemplatePicker() {
    var ICONS = { bathroom: '<svg viewBox="0 0 24 24"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V5a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/></svg>', kitchen: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 10v10M16 10v10M7 7h.01M11 7h.01"/></svg>', basement: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/><path d="M3 15h18M9 20v-5"/></svg>', blank: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/></svg>' };
    var m = openModal('<header><h2>New estimate: start from</h2>' + ICON.close + '</header><div class="tmpl">' +
      Object.keys(K.TEMPLATES).map(function (id) { var t = K.TEMPLATES[id]; return '<button type="button" data-t="' + id + '">' + ICONS[id] + "<b>" + esc(t.name) + "</b><span>" + esc(t.desc) + "</span></button>"; }).join("") + "</div>");
    m.el.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { m.close(); newEstimate(b.dataset.t); }; });
  }
  function newEstimate(tpl) {
    if (state.dirty && state.est) flushSave();
    var e = K.newEstimate(tpl); e.id = K.uid() + K.uid().slice(0, 3); e.number = autoNumber(e); e.updatedAt = new Date().toISOString();
    state.est = e; state.dirty = true; state.estimates.unshift(e);
    location.hash = "#/estimate/" + e.id;
    $("aiText").value = ""; fillForm(); render(); scheduleSave();
    toast("New " + K.TEMPLATES[tpl].name.toLowerCase() + " estimate. Describe the job above, or pick a client and fill it in.", 3200);
    setTimeout(function () { $("aiText").focus(); }, 50);
  }
  function openEstimate(id) {
    if (state.est && state.est.id === id) { fillForm(); render(); return; }
    var e = state.estimates.filter(function (x) { return x.id === id; })[0];
    if (!e) { toast("That estimate was not found."); nav("#/"); return; }
    if (state.dirty && state.est) flushSave();
    state.est = K.normalize(JSON.parse(JSON.stringify(e))); state.dirty = false;
    $("aiText").value = ""; fillForm(); render(); setSaveState("");
    api("estimates?id=" + encodeURIComponent(id)).then(function (fresh) { if (state.est && state.est.id === id && !state.dirty && fresh.updatedAt !== state.est.updatedAt) { state.est = K.normalize(fresh); replaceLocal(state.est); fillForm(); render(); } }).catch(function () {});
  }
  function replaceLocal(e) { var i = state.estimates.findIndex(function (x) { return x.id === e.id; }); if (i >= 0) state.estimates[i] = e; else state.estimates.unshift(e); }
  var saveTimer = null;
  function setSaveState(t) { $("saveState").textContent = t; }
  function changed() { if (!state.est) return; state.dirty = true; state.est.updatedAt = new Date().toISOString(); render(); setSaveState("Unsaved changes"); scheduleSave(); }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 900); }
  function flushSave() {
    clearTimeout(saveTimer);
    if (!state.est || !state.dirty || state.saving) return Promise.resolve();
    var e = state.est; state.saving = true; setSaveState("Saving...");
    return api("estimates", { method: "POST", body: e }).then(function (saved) {
      state.saving = false; state.dirty = false;
      var merged = K.normalize(saved); merged.sections.forEach(function (s, i) { if (e.sections[i]) s.id = e.sections[i].id; });
      if (state.est === e) { e.status = merged.status; e.share = merged.share; e.review = merged.review || null; e.reviewHistory = merged.reviewHistory || []; e.updatedAt = merged.updatedAt; e.createdAt = merged.createdAt; }
      replaceLocal(state.est === e ? e : merged); setSaveState("Saved " + K.whenText(merged.updatedAt).split(" ").slice(-2).join(" ")); renderStatus(); updateCrumb();
    }).catch(function (er) { state.saving = false; setSaveState("Not saved: " + er.message); if (er.message !== "unauthorized") toast("Could not save: " + er.message); });
  }
  window.addEventListener("beforeunload", function (ev) { if (state.dirty) { flushSave(); ev.preventDefault(); ev.returnValue = ""; } });

  $("btnDup").onclick = function () {
    if (!state.est) return; flushSave();
    var e = K.normalize(JSON.parse(JSON.stringify(state.est))); e.id = K.uid() + K.uid().slice(0, 3); e.date = K.todayISO(); e.number = autoNumber(e); e.status = "draft"; e.share = null; e.updatedAt = new Date().toISOString();
    state.est = e; state.dirty = true; state.estimates.unshift(e); location.hash = "#/estimate/" + e.id; fillForm(); render(); scheduleSave(); toast("Duplicated. You are now editing the copy.");
  };
  $("btnDelete").onclick = function () { if (state.est) deleteEstimate(state.est.id); };
  $("btnPdf").onclick = function () { if (!state.est) return; $("btnPdf").disabled = true; K.downloadPDF(state.est).then(function () { toast("PDF downloaded"); }).catch(function () { toast("Could not build the PDF. Try Print > Save as PDF."); }).then(function () { $("btnPdf").disabled = false; }); };

  /* ---------- builder: form ---------- */
  function getPath(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split("."); var last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k] = a[k] || {}; }, o); t[last] = v; }
  document.querySelectorAll("[data-k]").forEach(function (el) { el.addEventListener("input", function () {
    if (!state.est) return; var v = el.value;
    if (el.dataset.k === "taxRate") { v = K.parseMoney(v); document.querySelectorAll('[data-k="taxRate"]').forEach(function (o) { if (o !== el) o.value = el.value; }); }
    setPath(state.est, el.dataset.k, v); changed(); if (el.dataset.k === "number") updateCrumb();
  }); });
  $("lump").addEventListener("input", function () { state.est.lumpSubtotal = K.parseMoney(this.value); changed(); });
  $("lump").addEventListener("blur", function () { if (this.value) this.value = state.est.lumpSubtotal.toFixed(2); });
  $("modeLump").onclick = function () { state.est.pricingMode = "lump"; fillForm(); changed(); };
  $("modeSection").onclick = function () { state.est.pricingMode = "section"; fillForm(); changed(); };
  function fillForm() {
    var e = state.est; if (!e) return;
    document.querySelectorAll("[data-k]").forEach(function (el) { el.value = getPath(e, el.dataset.k) == null ? "" : getPath(e, el.dataset.k); });
    $("lump").value = e.lumpSubtotal ? e.lumpSubtotal.toFixed(2) : "";
    $("modeLump").classList.toggle("on", e.pricingMode !== "section"); $("modeSection").classList.toggle("on", e.pricingMode === "section");
    $("lumpRow").hidden = e.pricingMode === "section"; $("secRow").hidden = e.pricingMode !== "section";
    $("aiUpdate").checked = !!e.client.name;
    renderClientPicker(); renderSections(); renderStatus(); updateCrumb();
  }
  function updateCrumb() { var e = state.est; if (!e) return; $("crumbName").textContent = (e.client.name || "New estimate") + (e.number ? " (" + e.number + ")" : ""); $("crumbStatus").innerHTML = K.statusPill(e.status); document.title = (e.client.name ? e.client.name + " - " : "") + "Kotar Estimates"; }

  /* client picker */
  $("clientSelect").addEventListener("change", function () {
    var id = this.value;
    if (id === "__new") { openClientModal(null, function (c) { if (c) applyClient(c); else renderClientPicker(); }); return; }
    var c = state.clients.filter(function (x) { return x.id === id; })[0];
    if (c) applyClient(c); else { state.est.clientId = ""; renderClientPicker(); changed(); }
  });
  $("btnClientNew").onclick = function () { openClientModal(null, function (c) { if (c) applyClient(c); }); };
  function applyClient(c) { state.est.clientId = c.id; state.est.client = { name: c.name, address: c.address, email: c.email, phone: c.phone }; renderClientPicker(); changed(); }
  function renderClientPicker() {
    var e = state.est; var sel = $("clientSelect");
    sel.innerHTML = '<option value="">Choose a client...</option>' + state.clients.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.address ? " - " + esc(c.address.split(",")[0]) : "") + "</option>"; }).join("") + '<option value="__new">+ New client</option>';
    sel.value = e.clientId && state.clients.some(function (c) { return c.id === e.clientId; }) ? e.clientId : "";
    var c = e.client;
    if (!c.name) { $("clientCard").innerHTML = '<p class="note">No client on this estimate yet. Choose one above, or describe the job and the client details fill in.</p>'; return; }
    var initials = c.name.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
    var linked = !!sel.value;
    var rec = linked ? state.clients.filter(function (x) { return x.id === e.clientId; })[0] : null;
    var portal = rec && rec.portalToken ? location.origin + "/c/" + rec.portalToken : "";
    $("clientCard").innerHTML = '<div class="clientcard"><div class="av">' + esc(initials) + '</div><div class="who"><b>' + esc(c.name) + "</b>" + [c.address, c.email, c.phone].filter(Boolean).map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") +
      (linked ? '<span class="portalrow">' + (portal ? '<a href="' + esc(portal) + '" target="_blank" rel="noopener">Client portal</a> <button type="button" class="linkbtn" id="btnPortalCopy">Copy link</button>' : '<button type="button" class="linkbtn" id="btnPortalMake">Create client portal link</button>') + "</span>" : "") + "</div>" +
      (linked ? '<button class="btn sm quiet" type="button" id="btnClientEdit">Edit</button>' : '<button class="btn sm soft" type="button" id="btnClientSave" title="Save these details as a client you can reuse">Save as client</button>') + "</div>";
    var pc = $("btnPortalCopy"); if (pc) pc.onclick = function () { copyText(portal); };
    var pm = $("btnPortalMake"); if (pm) pm.onclick = function () { api("share", { method: "POST", body: { clientId: e.clientId, portal: true } }).then(function (r) { rec.portalToken = r.token; renderClientPicker(); copyText(r.url); }).catch(function (er) { toast(er.message); }); };
    var ed = $("btnClientEdit"); if (ed) ed.onclick = function () { var cc = state.clients.filter(function (x) { return x.id === e.clientId; })[0]; openClientModal(cc, function (saved) { if (saved) applyClient(saved); }); };
    var sv = $("btnClientSave"); if (sv) sv.onclick = function () { api("clients", { method: "POST", body: c }).then(function (saved) { upsertClientLocal(saved); applyClient(saved); toast("Saved " + saved.name + " to clients"); }).catch(function (er) { toast(er.message); }); };
  }

  /* ---------- builder: sections ---------- */
  function itemCount(s) { return s.items.filter(function (x) { return x.trim() && !/:\s*$/.test(x.trim()); }).length; }
  function renderSections() {
    var e = state.est, host = $("sections"); if (!e) return; host.innerHTML = "";
    var perSec = e.pricingMode === "section";
    if (!e.sections.length) { host.innerHTML = '<div class="empty-scope"><b>No scope yet</b>Press Add scope of work to pick trades, or describe the job above and let it draft for you.</div>'; return; }
    e.sections.forEach(function (s, i) {
      var d = document.createElement("div"); d.className = "sec"; d.dataset.id = s.id;
      var lib = s.key && K.BY_KEY[s.key];
      d.innerHTML = '<div class="row"><span class="grip" aria-hidden="true">' + ICON.grip + '</span><input class="title" value="' + esc(s.title) + '" placeholder="Section name" aria-label="Section name"><span class="count"></span>' +
        (perSec ? '<div class="amt money-wrap"><input class="in" inputmode="decimal" placeholder="0.00" value="' + (s.amount ? s.amount.toFixed(2) : "") + '" aria-label="Amount for ' + esc(s.title) + '"></div>' : "") +
        '<div class="tools"><button type="button" class="iconbtn" data-act="up" title="Move up" ' + (i === 0 ? "disabled" : "") + ">" + ICON.up + '</button><button type="button" class="iconbtn" data-act="down" title="Move down" ' + (i === e.sections.length - 1 ? "disabled" : "") + ">" + ICON.down + '</button><button type="button" class="iconbtn" data-act="del" title="Remove section">' + ICON.del + "</button></div></div>" +
        '<div class="items"></div><div class="secfoot"></div>';
      var countEl = d.querySelector(".count");
      function refreshFoot() {
        var c = itemCount(s); countEl.textContent = c + " line" + (c === 1 ? "" : "s");
        var foot = d.querySelector(".secfoot"); var html = '<button type="button" class="btn sm quiet" data-act="addsec" title="Add a new section right after this one">' + ICON.plus + "Section below</button>";
        if (!lib) html += '<button type="button" class="btn sm soft" data-act="tolib" title="Save this section to the Scope Library so you can pick it next time">Save to library</button><span class="libnote">One-off section</span>';
        else if (K.differsFromLibrary(s)) html += '<button type="button" class="btn sm soft" data-act="updlib" title="Make the library version match these lines">Update library</button><button type="button" class="btn sm quiet" data-act="fromlib" title="Replace these lines with the library version">Use library version</button><span class="libnote">Changed from library</span>';
        else html += '<span class="libnote">Matches library</span>';
        foot.innerHTML = html;
        foot.querySelector('[data-act="addsec"]').onclick = function () { openNewSectionModal({ addToEstimate: true, afterId: s.id, toLibrary: false }); };
        var tl = foot.querySelector('[data-act="tolib"]'); if (tl) tl.onclick = function () {
          if (!s.title.trim()) { toast("Give the section a name first."); d.querySelector(".title").focus(); return; }
          openSaveToLibraryModal(s, function (key) { s.key = key; changed(); renderSections(); });
        };
        var ul = foot.querySelector('[data-act="updlib"]'); if (ul) ul.onclick = function () { ask({ title: "Update the library?", body: "The library version of " + lib.t + " will match these lines. Future estimates use the new wording; existing ones are not changed.", okText: "Update library" }).then(function (yes) { if (!yes) return; updateLibraryFromSection(s).then(function () { lib = K.BY_KEY[s.key]; refreshFoot(); }); }); };
        var fl = foot.querySelector('[data-act="fromlib"]'); if (fl) fl.onclick = function () { s.items.length = 0; lib.i.forEach(function (x) { s.items.push(x); }); s.title = lib.t; d.querySelector(".title").value = lib.t; editor.redraw(); changed(); refreshFoot(); };
      }
      var title = d.querySelector(".title"); title.oninput = function () { s.title = title.value; changed(); refreshFoot(); };
      var amt = d.querySelector(".amt input"); if (amt) { amt.oninput = function () { s.amount = K.parseMoney(amt.value); changed(); }; amt.onblur = function () { if (amt.value) amt.value = s.amount.toFixed(2); }; }
      var cmts = ((e.review && e.review.comments) || []).filter(function (c) { return c.sectionId === s.id; });
      var editor = lineEditor(d.querySelector(".items"), s.items, function () { changed(); refreshFoot(); }, { emptyText: "No lines yet. Add one below.", decorate: function (row, idx, val) {
        var c = null; for (var k = 0; k < cmts.length; k++) { if (cmts[k].idx === idx || (cmts[k].itemText && cmts[k].itemText === val.trim())) { c = cmts[k]; break; } }
        if (!c) return;
        var el = document.createElement("div"); el.className = "ccall" + (c.resolved ? " done" : "");
        el.innerHTML = '<div class="txt"><b>' + (c.resolved ? "Client comment - resolved" : "Client comment") + "</b>" + esc(c.text) + '</div><button type="button" class="btn sm ' + (c.resolved ? "quiet" : "soft") + '">' + (c.resolved ? "Reopen" : "Resolve") + "</button>";
        el.querySelector("button").onclick = function () { c.resolved = !c.resolved; saveReview(e); };
        row.appendChild(el);
      } });
      d.querySelectorAll(".row [data-act]").forEach(function (b) { b.onclick = function () {
        var idx = e.sections.indexOf(s);
        if (b.dataset.act === "del") { e.sections.splice(idx, 1); renderSections(); changed(); toast("Removed " + (s.title || "section")); return; }
        if (b.dataset.act === "up" && idx > 0) e.sections.splice(idx - 1, 0, e.sections.splice(idx, 1)[0]);
        else if (b.dataset.act === "down" && idx < e.sections.length - 1) e.sections.splice(idx + 1, 0, e.sections.splice(idx, 1)[0]);
        renderSections(); changed();
      }; });
      refreshFoot();
      host.appendChild(d);
    });
  }
  function openSaveToLibraryModal(s, done) {
    var m = openModal('<header><h2>Save to Scope Library</h2>' + ICON.close + '</header><div class="form">' +
      '<div class="field"><label>Section name</label><input class="in" id="slName" value="' + esc(s.title) + '"></div>' +
      '<div class="field"><label>Category</label>' + catSelect("Custom") + "</div>" +
      '<p class="note">' + itemCount(s) + " line" + (itemCount(s) === 1 ? "" : "s") + ' will be saved as the standard wording. You can edit it later in the Scope Library.</p></div>' +
      '<footer><span class="spacer"></span><button class="btn quiet" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="slSave">Save to library</button></footer>', { narrow: true });
    m.el.querySelector("#slSave").onclick = function () {
      var t = m.el.querySelector("#slName").value.trim(); if (!t) return;
      addCustomToLibrary({ t: t, c: m.el.querySelector("select").value, i: s.items }).then(function (key) { s.title = t; m.close(); toast("Saved " + t + " to the library"); done(key); }).catch(function () {});
    };
  }
  $("btnAddScope").onclick = openScopePicker; $("btnAddScope2").onclick = openScopePicker;
  $("btnNewSecInline").onclick = function () { openNewSectionModal({ addToEstimate: true, toLibrary: false }); };

  /* Picker: library tiles (search, categories) + "New section" form. */
  function openScopePicker() {
    var e = state.est; var present = {}; e.sections.forEach(function (s) { if (s.key) present[s.key] = true; }); var selected = {};
    var m = openModal('<header><h2>Add scope of work</h2><div class="search">' + ICON.search + '<input class="in" id="scopeSearch" placeholder="Search trades or lines" aria-label="Search scope"></div>' + ICON.close + "</header>" +
      '<div class="scroll"><div class="picker-tabs"><button type="button" class="on" data-pt="lib">From the library</button><button type="button" data-pt="new">' + ICON.plus + ' New section</button><span class="spacer" style="flex:1"></span><a class="btn sm quiet" href="#/library" id="pickerManage">Manage library</a></div><div id="scopeList"></div><div id="scopeNew" hidden></div></div>' +
      '<footer><span class="note" id="pickerHint">Tick the sections to add. Sections already on the estimate are marked.</span><span class="spacer"></span><button class="btn primary" id="scopeAdd" type="button" disabled>Add selected</button></footer>');
    var list = m.el.querySelector("#scopeList"), search = m.el.querySelector("#scopeSearch"), addBtn = m.el.querySelector("#scopeAdd"), newHost = m.el.querySelector("#scopeNew");
    m.el.querySelector("#pickerManage").onclick = function () { m.close(); };
    function renderList(q) {
      q = (q || "").trim().toLowerCase(); var html = "";
      K.CATS.forEach(function (c) {
        var items = K.visibleLib().filter(function (l) { return l.c === c && (!q || l.t.toLowerCase().indexOf(q) >= 0 || l.i.some(function (i) { return i.toLowerCase().indexOf(q) >= 0; })); });
        if (!items.length) return;
        html += '<div class="cat"><h3>' + esc(c) + '</h3><div class="tiles">' + items.map(function (l) {
          var added = !!present[l.k], on = !!selected[l.k];
          return '<label class="tile' + (added ? " added" : "") + (on ? " on" : "") + '" data-k="' + esc(l.k) + '"><input type="checkbox" ' + (added ? "disabled checked" : on ? "checked" : "") + ' aria-label="' + esc(l.t) + '"><div><div class="tt">' + esc(l.t) + (added ? '<span class="badge">Added</span>' : "") + (!l.builtin ? '<span class="badge" style="background:var(--info-soft);color:var(--info)">Custom</span>' : "") + '</div><div class="ti">' + esc(l.i.filter(function (i) { return !/:\s*$/.test(i); }).join(" / ") || "No standard lines") + "</div></div></label>";
        }).join("") + "</div></div>";
      });
      list.innerHTML = html || '<div class="nores">Nothing matches "' + esc(q) + '". Use New section to add it.</div>';
      list.querySelectorAll(".tile:not(.added) input").forEach(function (cb) { cb.addEventListener("change", function () { var k = cb.closest(".tile").dataset.k; if (cb.checked) selected[k] = true; else delete selected[k]; cb.closest(".tile").classList.toggle("on", cb.checked); sync(); }); });
    }
    function sync() { var n = Object.keys(selected).length; addBtn.disabled = !n; addBtn.textContent = n ? "Add " + n + " section" + (n > 1 ? "s" : "") : "Add selected"; }
    addBtn.onclick = function () {
      var added = [];
      Object.keys(selected).forEach(function (k) { var l = K.BY_KEY[k]; if (!l || present[k]) return; K.insertSection(e, { id: K.uid(), key: k, title: l.t, items: l.i.slice(), amount: 0 }); present[k] = true; added.push(l.t); });
      m.close(); renderSections(); changed(); toast(added.length ? "Added " + added.join(", ") : "Nothing new to add");
    };
    // "New section" tab: inline form (name, category, lines, save-to-library choice)
    var draft = { t: "", c: "Custom", i: [""] };
    newHost.innerHTML = '<div class="newsec"><div class="row"><div class="field" style="flex:2;min-width:200px"><label>Section name</label><input class="in" id="pnName" placeholder="e.g. Pantry, Mudroom, Garage"></div><div class="field" style="flex:1"><label>Category</label>' + catSelect("Custom") + '</div></div>' +
      '<div class="field"><label>Lines</label><div class="lines-host"></div></div>' +
      '<label class="check"><input type="checkbox" id="pnLib"> Also save to the Scope Library for future estimates</label>' +
      '<div class="row"><button class="btn primary" type="button" id="pnAdd">Add to estimate</button></div></div>';
    lineEditor(newHost.querySelector(".lines-host"), draft.i, function () {}, { emptyText: "Add at least one line." });
    newHost.querySelector("#pnName").addEventListener("input", function () { draft.t = this.value; });
    newHost.querySelector("select").addEventListener("change", function () { draft.c = this.value; });
    newHost.querySelector("#pnAdd").onclick = function () {
      draft.t = newHost.querySelector("#pnName").value.trim(); if (!draft.t) { newHost.querySelector("#pnName").focus(); toast("Give the section a name."); return; }
      var lib = newHost.querySelector("#pnLib").checked;
      var finish = function (key) {
        // also add anything ticked on the library tab
        Object.keys(selected).forEach(function (k) { var l = K.BY_KEY[k]; if (l && !present[k]) { K.insertSection(e, { id: K.uid(), key: k, title: l.t, items: l.i.slice(), amount: 0 }); present[k] = true; } });
        var sec = { id: K.uid(), key: key || "", title: draft.t, items: cleanItems(draft.i), amount: 0 }; K.insertSection(e, sec);
        m.close(); renderSections(); changed(); toast("Added " + draft.t + (lib ? " (and saved to the library)" : ""));
      };
      if (lib) addCustomToLibrary(draft).then(finish).catch(function () {}); else finish("");
    };
    m.el.querySelectorAll("[data-pt]").forEach(function (b) { b.onclick = function () {
      var isNew = b.dataset.pt === "new"; m.el.querySelectorAll("[data-pt]").forEach(function (x) { x.classList.toggle("on", x === b); });
      list.hidden = isNew; newHost.hidden = !isNew; search.parentElement.hidden = isNew; addBtn.hidden = isNew;
      m.el.querySelector("#pickerHint").textContent = isNew ? "A one-off section lives only on this estimate; tick the box to keep it in the library too." : "Tick the sections to add. Sections already on the estimate are marked.";
      if (isNew) setTimeout(function () { newHost.querySelector("#pnName").focus(); }, 30);
    }; });
    search.addEventListener("input", function () { renderList(search.value); });
    renderList(""); sync(); setTimeout(function () { search.focus(); }, 30);
  }

  /* ---------- preview ---------- */
  function render() {
    var e = state.est; if (!e) return;
    var t = K.totals(e);
    $("tSub").textContent = money(t.sub); $("tTax").textContent = money(t.tax); $("tTot").textContent = money(t.total); $("tTaxLab").textContent = "HST (" + (+e.taxRate || 0) + "%)";
    $("paper").innerHTML = K.paperHTML(e);
  }

  /* ---------- client link, approval status, review ---------- */
  function openComments(e) { return ((e.review && e.review.comments) || []).filter(function (c) { return !c.resolved; }); }
  function hasFeedback(e) { return !!(e.review && ((e.review.comments && e.review.comments.length) || e.review.note)); }
  function updateReviewBadge() {
    var n = state.estimates.filter(function (e) { return hasFeedback(e) && (openComments(e).length || (e.status === "changes" && !e.review.comments.length)); }).length;
    var b = $("reviewBadge"); b.textContent = n; b.hidden = !n;
  }
  function renderStatus() {
    var e = state.est; if (!e) return; var sh = e.share || {};
    var url = sh.token ? location.origin + "/e/" + sh.token : "";
    $("btnSendLabel").textContent = sh.token ? "Copy client link" : "Generate client link";
    var hint = { draft: "No client link yet", sent: "Waiting for the client to open it", viewed: "Client has opened it", approved: "Approved", changes: "Client asked for changes", changed: "Edited since approval - generate a new link" }[e.status] || "";
    $("statusHint").textContent = hint;
    var steps = [
      { k: "sent", label: "Link generated", when: sh.sentAt, done: !!sh.sentAt },
      { k: "viewed", label: "Opened by client", when: sh.viewedAt, done: !!sh.viewedAt },
      e.status === "changes" ? { k: "changes", label: "Changes requested", when: sh.changesAt, done: true, hot: true } : { k: "approved", label: "Approved" + (sh.approvedBy ? " by " + sh.approvedBy : ""), when: sh.approvedAt, done: !!sh.approvedAt, note: sh.approvedNote }
    ];
    var html = "";
    if (!sh.token) html += '<p class="note">Press <b>Generate client link</b> to create a private page for this client. They can review every line, leave comments, download the PDF, and approve with a typed name. Nothing is emailed automatically; you send the link however you like.</p>';
    else {
      html += '<div class="timeline">' + steps.map(function (s) { return '<div class="tl' + (s.done ? " done" : "") + (s.hot ? " hot" : "") + '"><div class="dot">' + (s.done ? ICON.check : "") + "</div><div><b>" + esc(s.label) + "</b><span>" + (s.when ? esc(K.whenText(s.when)) : "Not yet") + "</span>" + (s.note ? "<blockquote>" + esc(s.note) + "</blockquote>" : "") + "</div></div>"; }).join("") + "</div>";
      if (hasFeedback(e)) { var oc = openComments(e).length, tc = (e.review.comments || []).length; html += '<div class="rnote" style="margin:0"><b>Client feedback' + (e.review.withApproval ? " (sent with approval)" : "") + "</b>" + (e.review.note ? esc(e.review.note) + "<br>" : "") + (tc ? '<span class="note">' + tc + " line comment" + (tc === 1 ? "" : "s") + (oc ? ", " + oc + " open - shown under the lines above" : ", all resolved") + '. <a href="#/review">Open Review</a></span>' : "") + "</div>"; }
      html += '<div class="field"><label>Client link</label><div class="linkbox"><input class="in" readonly value="' + esc(url) + '" id="shareUrl"><button class="btn sm" type="button" id="btnCopy">Copy</button><a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">Open</a></div></div>';
      html += '<div class="addbar"><a class="btn sm" id="btnEmail" href="#">Email the link</a><button class="btn sm quiet" type="button" id="btnResend" title="Re-issue the same link and reset the status to Sent">Re-issue link</button><button class="btn sm quiet danger" type="button" id="btnRevoke" title="Make a new link; the old one stops working">New link</button></div>';
      if (e.status === "changed") html += '<p class="note">You changed this estimate after the client approved it. Re-issue the link so they can approve the new version.</p>';
      if (e.status === "changes") html += '<p class="note">Once you have made the changes, re-issue the link so the client can approve the updated estimate. Their comments move to history.</p>';
    }
    $("statusBody").innerHTML = html;
    var c = $("btnCopy"); if (c) c.onclick = function () { copyText(url); };
    var em = $("btnEmail"); if (em) em.href = mailto(e, url);
    var rs = $("btnResend"); if (rs) rs.onclick = function () { send(false, true); };
    var rv = $("btnRevoke"); if (rv) rv.onclick = function () { ask({ title: "Create a new link?", body: "The old link will stop working for the client. Use this if a link was shared with the wrong person.", okText: "New link", danger: true }).then(function (yes) { if (yes) send(true, true); }); };
  }
  function mailto(e, url) {
    var t = K.totals(e);
    var subject = "Your estimate from Kotar Renovations" + (e.project ? " - " + e.project : "");
    var body = "Hi " + (e.client.name.split(" ")[0] || "") + ",\n\nHere is your estimate" + (e.project ? " for the " + e.project.toLowerCase() : "") + " (" + money(t.total) + " including HST).\n\nReview, comment, and approve it here:\n" + url + "\n\nQuestions? Just reply to this email or call 289-237-9622.\n\nThanks,\nTrevor Kotar\nKotar Renovations";
    return "mailto:" + encodeURIComponent(e.client.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function copyText(t) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Link copied"); }, function () { toast("Select the link and copy it."); }); else toast("Select the link and copy it."); }
  $("btnSend").onclick = function () {
    var e = state.est; if (!e) return;
    if (e.share && e.share.token && e.status !== "changed" && e.status !== "changes") { copyText(location.origin + "/e/" + e.share.token); showLinkModal(location.origin + "/e/" + e.share.token, false); return; }
    send(false, false);
  };
  function showLinkModal(url, fresh) {
    var e = state.est; var first = esc((e.client.name || "").split(" ")[0]);
    openModal('<header><h2>' + (fresh ? "Client link ready" : "Client link") + "</h2>" + ICON.close + '</header><div class="form"><p class="note" style="font-size:13.5px">Copied to your clipboard. Send it to ' + first + ' by text or email; this page does not email it for you. You will see here when they open it, comment, or approve.</p><div class="linkbox"><input class="in" readonly value="' + esc(url) + '"></div>' + (e.portalUrl ? '<p class="note">' + first + " can also see all their estimates at their portal link (in the Client card).</p>" : "") + '</div><footer><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Preview as client</a><span class="spacer"></span><a class="btn primary" href="' + mailto(e, url) + '">Email it</a></footer>', { narrow: true });
  }
  function send(refresh, force) {
    var e = state.est; if (!e) return;
    if (!e.client.name) { toast("Choose or add a client first."); $("clientSelect").focus(); return; }
    var go = function () {
      $("btnSend").disabled = true;
      flushSave().then(function () { return api("share", { method: "POST", body: { id: e.id, refresh: !!refresh } }); }).then(function (r) {
        e.share = r.estimate.share; e.status = r.estimate.status; e.review = r.estimate.review || null; e.reviewHistory = r.estimate.reviewHistory || []; e.updatedAt = r.estimate.updatedAt; e.portalUrl = r.portalUrl || null; replaceLocal(e);
        if (r.portalUrl) { var cl = state.clients.filter(function (c) { return c.id === e.clientId; })[0]; if (cl) cl.portalToken = r.portalUrl.split("/c/")[1]; }
        renderStatus(); renderClientPicker(); renderSections(); updateCrumb(); render(); updateReviewBadge();
        copyText(r.url); showLinkModal(r.url, true);
      }).catch(function (er) { toast(er.message); }).then(function () { $("btnSend").disabled = false; });
    };
    if (K.totals(e).total <= 0 && !force) ask({ title: "The total is $0", body: "This estimate has no price yet. The client would see a $0 total.", sub: "Add a sub-total (or amounts per section) first, or generate the link anyway.", okText: "Generate anyway", cancelText: "Go back" }).then(function (yes) { if (yes) go(); });
    else go();
  }

  /* ---------- Review tab ---------- */
  state.reviewFilter = "open";
  $("reviewFilters").querySelectorAll("button").forEach(function (b) { b.onclick = function () { state.reviewFilter = b.dataset.f; $("reviewFilters").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderReview(); }; });
  function renderReview() {
    var all = state.estimates.filter(hasFeedback);
    var open = all.filter(function (e) { return openComments(e).length || (e.status === "changes" && !(e.review.comments || []).length); });
    var totalComments = all.reduce(function (a, e) { return a + (e.review.comments || []).length; }, 0), openCount = all.reduce(function (a, e) { return a + openComments(e).length; }, 0);
    $("reviewStats").innerHTML = '<div class="stat hot"><b>' + open.length + '</b><span>Estimates needing attention</span></div><div class="stat"><b>' + openCount + '</b><span>Open comments</span></div><div class="stat"><b>' + (totalComments - openCount) + '</b><span>Resolved</span></div><div class="stat"><b>' + money(open.reduce(function (a, e) { return a + K.totals(e).total; }, 0)) + '</b><span>Value awaiting changes</span></div>';
    var list = (state.reviewFilter === "open" ? open : all).slice().sort(function (a, b) { return ((b.review && b.review.submittedAt) || "").localeCompare((a.review && a.review.submittedAt) || ""); });
    var host = $("reviewCards"); host.innerHTML = "";
    if (!list.length) { host.innerHTML = '<div class="rempty"><b>' + (all.length ? "All caught up" : "No client feedback yet") + "</b>" + (all.length ? "Every comment has been resolved. Switch to All feedback to look back." : "When a client comments on a line or requests changes, it shows up here with the exact line they meant.") + "</div>"; return; }
    list.forEach(function (e) { host.appendChild(reviewCard(e)); });
  }
  function reviewCard(e) {
    var rv = e.review, cs = rv.comments || [], oc = cs.filter(function (c) { return !c.resolved; }).length;
    var card = document.createElement("div"); card.className = "rcard" + (oc || (e.status === "changes" && !cs.length) ? "" : " resolved");
    var order = {}; e.sections.forEach(function (s, i) { order[s.id] = i; });
    var sorted = cs.slice().sort(function (a, b) { return (order[a.sectionId] - order[b.sectionId]) || (a.idx - b.idx); });
    card.innerHTML = '<div class="rhead"><div class="who"><b>' + esc(e.client.name || "Client") + "</b><span>" + esc(e.project || "") + (e.number ? " / " + esc(e.number) : "") + " / " + (rv.withApproval ? "sent with approval " : "changes requested ") + esc(K.whenText(rv.submittedAt)) + "</span></div>" + K.statusPill(e.status) + '<span class="tot">' + money(K.totals(e).total) + "</span></div>" +
      '<div class="rbody"><div>' + (rv.note ? '<div class="rnote"><b>General note</b>' + esc(rv.note) + "</div>" : "") +
      (sorted.length ? '<ul class="rlist">' + sorted.map(function (c) { return '<li class="' + (c.resolved ? "done" : "") + '" data-cid="' + esc(c.id) + '"><button type="button" class="tick" title="' + (c.resolved ? "Mark as open" : "Mark as resolved") + '">' + ICON.check + '</button><div><div class="where">' + esc(c.sectionTitle) + " <span>/</span> " + esc(c.itemText) + '</div><div class="what">' + esc(c.text) + "</div></div>" + (c.resolved ? '<span class="note">Resolved</span>' : "") + "</li>"; }).join("") + "</ul>" : '<p class="note">No line comments, just the note above.</p>') + "</div>" +
      '<div class="rside"><div class="prog">' + (cs.length ? (cs.length - oc) + " of " + cs.length + " resolved" : "") + '</div><a class="btn primary" href="#/estimate/' + esc(e.id) + '">Open estimate</a>' + (cs.length && oc ? '<button class="btn" type="button" data-a="all">Mark all resolved</button>' : "") + (!oc && (e.status === "changes" || e.status === "changed") ? '<button class="btn ok" type="button" data-a="reissue">Re-issue client link</button>' : "") + '<a class="btn quiet" href="/e/' + esc((e.share || {}).token || "") + '" target="_blank" rel="noopener">View as client</a></div></div>';
    card.querySelectorAll(".tick").forEach(function (t) { t.onclick = function () { var id = t.closest("li").dataset.cid; var c = cs.filter(function (x) { return x.id === id; })[0]; c.resolved = !c.resolved; saveReview(e); }; });
    var all = card.querySelector('[data-a="all"]'); if (all) all.onclick = function () { cs.forEach(function (c) { c.resolved = true; }); saveReview(e); };
    var re = card.querySelector('[data-a="reissue"]'); if (re) re.onclick = function () { state.est = e; send(false, true); };
    return card;
  }
  function saveReview(e) {
    api("estimates", { method: "POST", body: e }).then(function (saved) { e.review = saved.review; e.updatedAt = saved.updatedAt; replaceLocal(e); if (state.est && state.est.id === e.id) { state.est.review = saved.review; renderSections(); renderStatus(); } renderReview(); updateReviewBadge(); }).catch(function (er) { toast("Could not save: " + er.message); });
  }

  /* ---------- AI draft ---------- */
  function setAiStatus(msg, busy) { var s = $("aiStatus"); s.textContent = msg || ""; s.classList.toggle("busy", !!busy); }
  $("btnAi").onclick = draftWithAI;
  $("aiText").addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") draftWithAI(); });
  function draftWithAI() {
    var e = state.est; if (!e) return;
    var desc = $("aiText").value.trim();
    if (!desc) { toast("Describe the job first: client, what is being done, and the price."); $("aiText").focus(); return; }
    if (!state.aiReady) { setAiStatus("AI drafting is not set up yet. Add GEMINI_API_KEY in Netlify and redeploy."); return; }
    var update = $("aiUpdate").checked;
    $("btnAi").disabled = true; setAiStatus(update ? "Applying your changes..." : "Drafting the estimate...", true);
    var payload = { description: desc, library: K.visibleLib().map(function (l) { return { key: l.k, category: l.c, title: l.t, items: l.i }; }), templates: templateKeys(), notes: K.STANDARD_NOTES };
    if (update) payload.current = { client: e.client, project: e.project, pricingMode: e.pricingMode, lumpSubtotal: e.lumpSubtotal, taxRate: e.taxRate, sections: e.sections.map(function (s) { return { key: s.key, title: s.title, items: s.items, amount: s.amount }; }), notesText: e.notesText };
    api("ai-draft", { method: "POST", body: payload }).then(function (r) {
      var out = r.estimate;
      var keep = { id: e.id, date: e.date, number: e.number || autoNumber(e), status: e.status, share: e.share, clientId: e.clientId, createdAt: e.createdAt };
      var merged = K.normalize(Object.assign({}, e, out, keep));
      var match = state.clients.filter(function (c) { return c.name.toLowerCase() === (merged.client.name || "").toLowerCase(); })[0];
      if (match) { merged.clientId = match.id; merged.client = { name: match.name, address: merged.client.address || match.address, email: merged.client.email || match.email, phone: merged.client.phone || match.phone }; }
      state.est = merged; replaceLocal(merged); fillForm(); changed();
      setAiStatus(update ? "Changes applied. Check the preview, then send." : "Drafted. Check the scope and price, then send.");
      toast("Estimate drafted. Give it a once-over before sending.");
      var cs = $("clientSelect"); if (cs.scrollIntoView) cs.scrollIntoView({ behavior: "smooth", block: "center" });
    }).catch(function (er) { setAiStatus(er.message === "unauthorized" ? "" : er.message); }).then(function () { $("btnAi").disabled = false; });
  }
  function templateKeys() { var o = {}; Object.keys(K.TEMPLATES).forEach(function (id) { o[id] = K.TEMPLATES[id].keys.map(function (k) { return Array.isArray(k) ? k[0] : k; }); }); return o; }

  /* voice dictation */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition; var rec = null, recOn = false, baseText = "";
  if (SR) {
    $("btnMic").hidden = false;
    $("btnMic").onclick = function () {
      if (recOn) { rec.stop(); return; }
      rec = new SR(); rec.lang = "en-CA"; rec.continuous = true; rec.interimResults = true;
      baseText = $("aiText").value ? $("aiText").value.replace(/\s*$/, "") + " " : "";
      rec.onstart = function () { recOn = true; $("btnMic").classList.add("live"); $("btnMic").querySelector("span").textContent = "Stop"; setAiStatus("Listening... describe the job, then press Stop."); };
      rec.onresult = function (ev) { var fin = "", tmp = ""; for (var i = 0; i < ev.results.length; i++) { var r = ev.results[i]; if (r.isFinal) fin += r[0].transcript + " "; else tmp += r[0].transcript; } $("aiText").value = baseText + fin + tmp; };
      rec.onerror = function (ev) { var m = { "not-allowed": "Microphone access was blocked. Allow the mic in your browser, or type instead.", "no-speech": "Did not catch anything. Try again a little closer to the mic.", "audio-capture": "No microphone found. Type the description instead." }[ev.error] || "Voice input stopped. You can type instead."; setAiStatus(m); };
      rec.onend = function () { recOn = false; $("btnMic").classList.remove("live"); $("btnMic").querySelector("span").textContent = "Talk"; if ($("aiStatus").textContent.indexOf("Listening") === 0) setAiStatus("Got it. Press Draft the estimate when you are ready."); };
      try { rec.start(); } catch (e) { setAiStatus("Could not start the microphone. Type the description instead."); }
    };
  }

  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flushSave(); } });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && $("shell").hidden === false) api("estimates").then(function (list) { var cur = state.est; state.estimates = list.map(K.normalize); if (cur) { var fresh = state.estimates.filter(function (x) { return x.id === cur.id; })[0]; if (fresh && !state.dirty) { cur.status = fresh.status; cur.share = fresh.share; renderStatus(); updateCrumb(); render(); } replaceLocal(cur); } if (!$("viewList").hidden) renderList(); }).catch(function () {}); });
})();
