/* Kotar Estimates - client review page (/e/<token>): line comments, approval, change requests. ASCII only. */
(function () {
  "use strict";
  var K = window.Kotar, esc = K.esc, money = K.money;
  var $ = function (id) { return document.getElementById(id); };
  var token = (location.pathname.match(/\/e\/([A-Za-z0-9]+)/) || [])[1] || new URLSearchParams(location.search).get("token") || "";
  var est = null, company = null, portalToken = null;
  var comments = [];           // [{id, sectionId, sectionTitle, idx, itemText, text}]
  var note = "";               // general comment
  var editing = null;          // "sid:idx" currently open inline editor
  var DRAFT_KEY = "kotar.review." + token;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  var uid = function () { return Math.random().toString(36).slice(2, 10); };

  if (!token) return notFound();
  fetch("/api/share?token=" + encodeURIComponent(token)).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) {
    if (!res.ok) return notFound();
    est = K.normalize(res.d.estimate); est.review = res.d.estimate.review || null; company = res.d.company; portalToken = res.d.portalToken;
    // Pre-fill from an earlier submission (so the client can adjust) or an unsent draft on this device
    if (est.review && est.review.comments) { comments = est.review.comments.map(function (c) { return { id: c.id, sectionId: c.sectionId, sectionTitle: c.sectionTitle, idx: c.idx, itemText: c.itemText, text: c.text }; }); note = est.review.note || ""; }
    else { try { var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d) { comments = d.comments || []; note = d.note || ""; } } catch (e) {} }
    render();
  }).catch(notFound);

  function notFound() { $("notfound").hidden = false; }
  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ comments: comments, note: note })); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  var open = function () { return est.status !== "approved"; };

  function render() {
    var first = (est.client.name || "").split(" ")[0];
    var t = K.totals(est);
    $("helloTitle").textContent = (first ? "Hi " + first + ", here is your estimate" : "Your estimate") + (est.project ? " for the " + est.project.toLowerCase() : "");
    $("helloSub").textContent = money(t.total) + " including HST" + (est.number ? " (No. " + est.number + ")" : "") + ".";
    $("hello").hidden = false; $("page").hidden = false;
    if (portalToken) { $("btnPortal").hidden = false; $("btnPortal").href = "/c/" + portalToken; $("portalLink").href = "/c/" + portalToken; } else $("portalLink").removeAttribute("href");
    $("btnPdf").onclick = function () { $("btnPdf").disabled = true; K.downloadPDF(est, company).then(function () { toast("PDF downloaded"); }).catch(function () { toast("Could not build the PDF. Use your browser's Print to save it."); }).then(function () { $("btnPdf").disabled = false; }); };
    $("cmHint").hidden = !open();
    renderPaper(); renderApprove(); renderComments();
  }

  /* ---------- paper with inline comment editors ---------- */
  function renderPaper() {
    $("paper").innerHTML = K.paperHTML(est, company, { commentable: open(), comments: comments, commentLabel: "Your comment" });
    if (!open()) return;
    Array.prototype.forEach.call(document.querySelectorAll("#paper .cbtn"), function (b) { b.onclick = function () { openEditor(b.dataset.c); }; });
    if (editing) mountEditor(editing);
  }
  function findComment(key) { for (var i = 0; i < comments.length; i++) if (comments[i].sectionId + ":" + comments[i].idx === key) return comments[i]; return null; }
  function openEditor(key) { editing = key; renderPaper(); }
  function mountEditor(key) {
    var li = document.querySelector('#paper li[data-sid="' + key.split(":")[0] + '"][data-idx="' + key.split(":")[1] + '"]'); if (!li) { editing = null; return; }
    var existing = findComment(key);
    var box = document.createElement("div"); box.className = "cedit";
    box.innerHTML = '<textarea rows="2" placeholder="e.g. Can this be a rain shower head instead?" aria-label="Your comment on this line">' + esc(existing ? existing.text : "") + '</textarea><div class="row"><button type="button" class="btn sm primary" data-a="save">Save comment</button><button type="button" class="btn sm quiet" data-a="cancel">Cancel</button>' + (existing ? '<button type="button" class="btn sm quiet danger" data-a="remove">Remove</button>' : "") + "</div>";
    var old = li.querySelector(".lc"); if (old) old.hidden = true;
    li.appendChild(box);
    var ta = box.querySelector("textarea"); setTimeout(function () { ta.focus(); }, 20);
    ta.addEventListener("keydown", function (ev) { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") save(); if (ev.key === "Escape") cancel(); });
    function save() {
      var text = ta.value.trim(); if (!text) { cancel(); return; }
      var sec = est.sections.filter(function (s) { return s.id === key.split(":")[0]; })[0];
      if (existing) existing.text = text; else comments.push({ id: uid(), sectionId: key.split(":")[0], sectionTitle: sec ? sec.title : "", idx: +key.split(":")[1], itemText: li.querySelector(".lt").textContent, text: text });
      editing = null; saveDraft(); renderPaper(); renderComments(); renderApprove();
    }
    function cancel() { editing = null; renderPaper(); }
    box.querySelector('[data-a="save"]').onclick = save;
    box.querySelector('[data-a="cancel"]').onclick = cancel;
    var rm = box.querySelector('[data-a="remove"]'); if (rm) rm.onclick = function () { removeComment(existing.id); };
    box.scrollIntoView && box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function removeComment(id) { comments = comments.filter(function (c) { return c.id !== id; }); editing = null; saveDraft(); renderPaper(); renderComments(); renderApprove(); }

  /* ---------- left column: approve ---------- */
  function renderApprove() {
    var a = $("approve"); var t = K.totals(est);
    if (est.status === "approved") {
      a.innerHTML = '<div class="done"><b>Approved</b>' + (est.share.approvedBy ? " by " + esc(est.share.approvedBy) : "") + " on " + esc(K.longDate(est.share.approvedAt)) + '. Thank you! Trevor will be in touch to book a start date.</div><p class="note">Need something changed after all? Call 289-237-9622 or email info@kotarrenovationsinc.ca.</p>';
      return;
    }
    var n = comments.length;
    a.innerHTML = '<h2>Approve this estimate</h2>' +
      '<div class="bigtotal">' + money(t.total) + '<span>including HST</span></div>' +
      (n ? '<p class="note warn">You have ' + n + " comment" + (n === 1 ? "" : "s") + ". If you want changes made first, send them from the panel below instead of approving.</p>" : '<p class="note">Typing your name is your approval of the scope and price shown. Trevor will follow up to schedule the work.</p>') +
      '<input class="in" id="apName" placeholder="Type your full name" aria-label="Your full name" value="' + esc(est.client.name || "") + '">' +
      '<label class="agree"><input type="checkbox" id="apAgree"> I have read the scope of work and notes, and I approve this estimate' + (n ? " as written (my comments will be passed along as notes)" : "") + ".</label>" +
      '<button class="btn ok lg" id="apBtn" type="button" disabled>Approve estimate</button>';
    var name = $("apName"), agree = $("apAgree"), btn = $("apBtn");
    function sync() { btn.disabled = !(name.value.trim().length > 1 && agree.checked); }
    name.addEventListener("input", sync); agree.addEventListener("change", sync); sync();
    btn.onclick = function () {
      btn.disabled = true; btn.textContent = "Approving...";
      post({ token: token, action: "approve", name: name.value.trim(), note: note, comments: comments }).then(function () {
        est.status = "approved"; est.share = est.share || {}; est.share.approvedBy = name.value.trim(); est.share.approvedAt = new Date().toISOString(); clearDraft();
        render(); $("helloSub").textContent = money(t.total) + " including HST. Approved - thank you!"; window.scrollTo({ top: 0, behavior: "smooth" });
      }).catch(function (er) { btn.disabled = false; btn.textContent = "Approve estimate"; toast(er.message); });
    };
  }

  /* ---------- left column: comments + change request ---------- */
  function renderComments() {
    var c = $("comments");
    if (est.status === "approved") { c.hidden = !(comments.length || note); if (!c.hidden) c.innerHTML = '<h2>Your notes</h2>' + listHTML(false) + (note ? '<blockquote class="gnote">' + esc(note) + "</blockquote>" : ""); return; }
    c.hidden = false;
    var submitted = est.status === "changes" && est.review;
    c.innerHTML = '<h2>Your comments' + (comments.length ? ' <span class="cnt">' + comments.length + "</span>" : "") + "</h2>" +
      (submitted ? '<div class="done soft">Sent to Kotar on ' + esc(K.longDate(est.review.submittedAt)) + ". Trevor will send an updated estimate. You can still add or change comments and send again.</div>" : "") +
      (comments.length ? listHTML(true) : '<p class="note">No line comments yet. Hover a line in the estimate and press <b>Comment</b>.</p>') +
      '<label class="field"><span class="lbl">Anything else? <em>(optional)</em></span><textarea class="in" id="gnote" rows="3" placeholder="Timing, budget, materials, questions...">' + esc(note) + "</textarea></label>" +
      '<button class="btn primary" id="chBtn" type="button"' + (comments.length || note.trim() ? "" : " disabled") + ">" + (submitted ? "Send updated comments" : "Request changes") + "</button>" +
      '<p class="note">Sends your comments to Trevor without approving. He will update the estimate and send it back.</p>';
    c.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openEditor(b.dataset.edit); var li = document.querySelector('#paper li[data-sid="' + b.dataset.edit.split(":")[0] + '"][data-idx="' + b.dataset.edit.split(":")[1] + '"]'); if (li && li.scrollIntoView) li.scrollIntoView({ behavior: "smooth", block: "center" }); }; });
    c.querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { removeComment(b.dataset.rm); }; });
    var g = $("gnote"), chBtn = $("chBtn");
    g.addEventListener("input", function () { note = g.value; saveDraft(); chBtn.disabled = !(comments.length || note.trim()); });
    chBtn.onclick = function () {
      chBtn.disabled = true; chBtn.textContent = "Sending...";
      post({ token: token, action: "review", comments: comments, note: note.trim() }).then(function (r) {
        est.status = "changes"; est.review = r.review; clearDraft(); render(); toast("Sent. Trevor will get back to you with an updated estimate.");
      }).catch(function (er) { chBtn.disabled = false; chBtn.textContent = "Request changes"; toast(er.message); });
    };
  }
  function listHTML(editable) {
    // group by section, in estimate order
    var order = {}; est.sections.forEach(function (s, i) { order[s.id] = i; });
    var sorted = comments.slice().sort(function (a, b) { return (order[a.sectionId] - order[b.sectionId]) || (a.idx - b.idx); });
    return '<ul class="clist">' + sorted.map(function (c) {
      return '<li><div class="where">' + esc(c.sectionTitle) + ' <span>/</span> ' + esc(c.itemText) + '</div><div class="what">' + esc(c.text) + "</div>" +
        (editable ? '<div class="row"><button type="button" class="linkbtn" data-edit="' + esc(c.sectionId + ":" + c.idx) + '">Edit</button><button type="button" class="linkbtn danger" data-rm="' + esc(c.id) + '">Remove</button></div>' : "") + "</li>";
    }).join("") + "</ul>";
  }

  function post(body) {
    return fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again."); return d; }); });
  }
})();
