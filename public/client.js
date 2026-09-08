/* Kotar Estimates - client approval page (/e/<token>). ASCII only. */
(function () {
  "use strict";
  var K = window.Kotar, esc = K.esc, money = K.money;
  var $ = function (id) { return document.getElementById(id); };
  var token = (location.pathname.match(/\/e\/([A-Za-z0-9]+)/) || [])[1] || new URLSearchParams(location.search).get("token") || "";
  var est = null, company = null;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600); }

  if (!token) return notFound();
  fetch("/api/share?token=" + encodeURIComponent(token)).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) {
    if (!res.ok) return notFound();
    est = K.normalize(res.d.estimate); company = res.d.company; render();
  }).catch(notFound);

  function notFound() { $("notfound").hidden = false; }

  function render() {
    var first = (est.client.name || "").split(" ")[0];
    var t = K.totals(est);
    $("helloTitle").textContent = (first ? "Hi " + first + ", here is your estimate" : "Your estimate") + (est.project ? " for the " + est.project.toLowerCase() : "");
    $("helloSub").textContent = money(t.total) + " including HST. Review the scope below" + (est.status === "approved" ? "." : ", then approve it or ask for changes.");
    $("hello").hidden = false;
    $("paper").innerHTML = K.paperHTML(est, company); $("paper").hidden = false;
    $("btnPdf").onclick = function () { $("btnPdf").disabled = true; K.downloadPDF(est, company).then(function () { toast("PDF downloaded"); }).catch(function () { toast("Could not build the PDF. Use your browser's Print to save it."); }).then(function () { $("btnPdf").disabled = false; }); };
    renderApprove();
  }

  function renderApprove() {
    var a = $("approve"); a.hidden = false;
    if (est.status === "approved") {
      a.innerHTML = '<div class="done">Approved by ' + esc(est.share.approvedBy || "you") + " on " + esc(K.longDate(est.share.approvedAt)) + '. Thank you! Trevor will be in touch to book a start date.</div><p class="note">Need something changed after all? Call 289-237-9622 or email info@kotarrenovationsinc.ca.</p>';
      return;
    }
    if (est.status === "changes") {
      a.innerHTML = '<div class="done" style="background:var(--warn-soft);color:var(--warn)">Thanks. We received your request for changes on ' + esc(K.longDate(est.share.changesAt)) + " and will send an updated estimate.</div>";
      return;
    }
    a.innerHTML = '<h2>Approve this estimate</h2>' +
      '<p class="note" style="font-size:13.5px">Typing your name below is your approval of the scope and price shown above (' + money(K.totals(est).total) + ' including HST). Trevor will follow up to schedule the work.</p>' +
      '<div class="row"><input class="in" id="apName" placeholder="Type your full name" aria-label="Your full name" style="flex:1;min-width:220px" value="' + esc(est.client.name || "") + '"></div>' +
      '<label class="agree"><input type="checkbox" id="apAgree"> I have read the scope of work and notes, and I approve this estimate.</label>' +
      '<div class="row"><button class="btn ok lg" id="apBtn" type="button" disabled>Approve estimate</button></div>' +
      '<details><summary>Something not right? Ask for changes</summary><textarea class="in" id="chNote" rows="3" placeholder="Tell us what you would like changed"></textarea><div class="row" style="margin-top:8px"><button class="btn" id="chBtn" type="button">Send request</button></div></details>';
    var name = $("apName"), agree = $("apAgree"), btn = $("apBtn");
    function sync() { btn.disabled = !(name.value.trim().length > 1 && agree.checked); }
    name.addEventListener("input", sync); agree.addEventListener("change", sync); sync();
    btn.onclick = function () {
      btn.disabled = true; btn.textContent = "Approving...";
      post({ token: token, action: "approve", name: name.value.trim() }).then(function () {
        est.status = "approved"; est.share = est.share || {}; est.share.approvedBy = name.value.trim(); est.share.approvedAt = new Date().toISOString();
        $("paper").innerHTML = K.paperHTML(est, company); $("helloSub").textContent = money(K.totals(est).total) + " including HST. Approved - thank you!"; renderApprove(); window.scrollTo({ top: a.offsetTop - 20, behavior: "smooth" });
      }).catch(function (er) { btn.disabled = false; btn.textContent = "Approve estimate"; toast(er.message); });
    };
    $("chBtn").onclick = function () {
      var note = $("chNote").value.trim(); if (!note) { $("chNote").focus(); return; }
      $("chBtn").disabled = true;
      post({ token: token, action: "changes", note: note }).then(function () { est.status = "changes"; est.share = est.share || {}; est.share.changesAt = new Date().toISOString(); renderApprove(); }).catch(function (er) { $("chBtn").disabled = false; toast(er.message); });
    };
  }
  function post(body) {
    return fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again."); return d; }); });
  }
})();
