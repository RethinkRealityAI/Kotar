/* Kotar Estimates - client portal (/c/<token>): every estimate sent to this client. ASCII only. */
(function () {
  "use strict";
  var K = window.Kotar, esc = K.esc, money = K.money;
  var $ = function (id) { return document.getElementById(id); };
  var token = (location.pathname.match(/\/c\/([A-Za-z0-9]+)/) || [])[1] || "";
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  if (!token) { $("notfound").hidden = false; return; }

  fetch("/api/share?portal=" + encodeURIComponent(token)).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) {
    if (!res.ok) { $("notfound").hidden = false; return; }
    var company = res.d.company; var list = res.d.estimates.map(function (e) { var n = K.normalize(e); n.share = e.share || {}; n.review = e.review || null; return n; });
    var first = (res.d.client.name || "").split(" ")[0];
    $("top").hidden = false; $("portal").hidden = false;
    var pending = list.filter(function (e) { return e.status !== "approved"; }), done = list.filter(function (e) { return e.status === "approved"; });
    var waiting = pending.filter(function (e) { return e.status === "sent" || e.status === "viewed"; }).length;
    $("pTitle").textContent = first ? "Hi " + first + ", here are your estimates" : "Your estimates";
    $("pSub").textContent = waiting ? (waiting === 1 ? "One estimate is waiting for your approval." : waiting + " estimates are waiting for your approval.") : (pending.length ? "Nothing needs your attention right now." : (list.length ? "All caught up - everything is approved." : "No estimates yet."));
    $("pending").innerHTML = pending.length ? pending.map(function (e) { return card(e, company, true); }).join("") : (list.length ? "" : '<div class="pcard empty"><b>No estimates yet</b>Trevor will send one here when it is ready.</div>');
    $("doneHead").hidden = !done.length; $("done").innerHTML = done.map(function (e) { return card(e, company, false); }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("[data-pdf]"), function (b) {
      b.onclick = function () { var e = list.filter(function (x) { return x.id === b.dataset.pdf; })[0]; if (!e) return; b.disabled = true; K.downloadPDF(e, company).then(function () { toast("PDF downloaded"); }).catch(function () { toast("Could not build the PDF right now."); }).then(function () { b.disabled = false; }); };
    });
  }).catch(function () { $("notfound").hidden = false; });

  function card(e, company, active) {
    var t = K.totals(e); var secs = K.activeSections(e);
    var when = e.status === "approved" ? "Approved " + K.longDate(e.share.approvedAt) : e.status === "changes" ? "Changes requested " + K.longDate(e.share.changesAt) : "Sent " + K.longDate(e.share.sentAt || e.date);
    var cta = e.status === "approved" ? "View" : e.status === "changes" ? "View your comments" : "Review and approve";
    return '<div class="pcard' + (active && (e.status === "sent" || e.status === "viewed") ? " hot" : "") + '">' +
      '<div class="ptop">' + K.clientStatusPill(e.status) + '<span class="pwhen">' + esc(when) + "</span></div>" +
      '<h3>' + esc(e.project || "Renovation estimate") + "</h3>" +
      '<div class="pmeta">' + esc(e.number || "") + (e.client.address ? " / " + esc(e.client.address) : "") + "</div>" +
      '<div class="pscope">' + esc(secs.slice(0, 6).map(function (s) { return s.title; }).join(", ")) + (secs.length > 6 ? " +" + (secs.length - 6) + " more" : "") + "</div>" +
      '<div class="ptotal">' + money(t.total) + "<span>incl. HST</span></div>" +
      '<div class="pactions"><a class="btn ' + (e.status === "approved" || e.status === "changes" ? "" : "primary") + '" href="/e/' + esc(e.share.token) + '">' + cta + '</a><button type="button" class="btn quiet" data-pdf="' + esc(e.id) + '">PDF</button></div></div>';
  }
})();
