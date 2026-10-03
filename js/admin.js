/* ============================================================
   AMAN PATROL — Coordinator Dashboard (admin only).
   Approvals · Volunteers · Roster · Incidents · Reports
   ============================================================ */
(function () {
  "use strict";

  var TABS = [
    { id: "approvals", label: "Approvals" },
    { id: "volunteers", label: "Volunteers" },
    { id: "roster", label: "Roster" },
    { id: "incidents", label: "Incidents" },
    { id: "reports", label: "Reports" }
  ];
  var STATUSES = ["Logged", "Acknowledged", "SAPS/Security Notified", "Resolved"];
  var REPORT_FILTER = { from: "", to: "", category: "", status: "" };
  var lastApproved = null; // set after Approve: drives the "send good news" banner

  function waLink(phone, first) {
    var n = String(phone || "").replace(/[^0-9+]/g, "");
    if (n.indexOf("+") === 0) n = n.slice(1);
    else if (n.charAt(0) === "0") n = "27" + n.slice(1);
    var msg = "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ " + (first || "") + "! Your Aman Patrol registration is approved. " +
      "Open the app and log in with the email you registered. " +
      "Remember: observe and report only, never patrol alone, emergencies 10111. " +
      "App: https://mia-za.github.io/aman-patrol/";
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(msg);
  }

  function esc(s) { return window.AmanUI.esc(s); }

  function render(screen, tab) {
    var S = window.AmanStore;
    var user = S.sessionUser();
    if (!user || user.role !== "coordinator") {
      screen.innerHTML = '<div class="empty"><div class="big">' + window.AmanUI.I("lock",36) + '</div>Coordinator access only.</div>';
      return;
    }
    screen.className = "screen";
    var pending = S.users().filter(function (u) { return u.status === "pending"; });
    var inner =
      '<h1 class="page-title">Coordinator dashboard</h1>' +
      '<p class="page-sub">Amanah — the community trusts you with this information.</p>' +
      '<div class="segmented" style="overflow-x:auto" id="admin-tabs">' +
      TABS.map(function (t) {
        var badge = t.id === "approvals" && pending.length ? ' <span class="chip warn" style="padding:1px 7px;font-size:0.6rem">' + pending.length + "</span>" : "";
        return '<button data-tab="' + t.id + '" class="' + (t.id === tab ? "active" : "") + '" style="min-width:82px">' + t.label + badge + "</button>";
      }).join("") + "</div>" +
      '<div id="admin-body"></div>';
    screen.innerHTML = inner;
    document.getElementById("admin-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]");
      if (b) location.hash = "#/admin/" + b.getAttribute("data-tab");
    });
    var body = document.getElementById("admin-body");
    ({ approvals: renderApprovals, volunteers: renderVolunteers, roster: renderRoster, incidents: renderIncidents, reports: renderReports }[tab] || renderApprovals)(body);
  }

  /* ---------------- approvals ---------------- */
  function userCard(u, actions) {
    return '<div class="card">' +
      '<div class="vrow"><div class="avatar">' + esc(u.first_name[0] + u.surname[0]) + "</div>" +
      '<div class="grow"><div class="name">' + esc(u.first_name + " " + u.surname) + "</div>" +
      '<div class="sub">' + esc(u.suburb) + " · applied " + esc(window.AmanStore.timeAgo(u.created_at)) + "</div></div>" +
      '<span class="chip ' + (u.status === "approved" ? "ok" : u.status === "pending" ? "warn" : "danger") + '">' + u.status + "</span></div>" +
      '<div class="divider"></div>' +
      '<dl class="kv">' +
      "<dt>Cell Number</dt><dd>" + esc(u.whatsapp) + "</dd>" +
      "<dt>Email</dt><dd>" + esc(u.email) + "</dd>" +
      "<dt>Address</dt><dd>" + esc(u.street + ", " + u.suburb) + "</dd>" +
      "<dt>Date of birth</dt><dd>" + esc(u.dob) + " (" + Math.floor(window.AmanStore.ageFromDob(u.dob)) + ")</dd>" +
      "<dt>Emergency</dt><dd>" + esc(u.emergency_contact_name + " · " + u.emergency_contact_number) + "</dd>" +
      "</dl>" + actions + "</div>";
  }

  function renderApprovals(el) {
    var S = window.AmanStore;
    var pending = S.users().filter(function (u) { return u.status === "pending"; });
    var banner = lastApproved ?
      '<div class="approve-banner">' +
      '<div class="ab-text">' + esc(lastApproved.first_name) + ' is approved — a welcome notification and chat message are waiting in the app. Send the good news:</div>' +
      '<a class="btn btn-ok block mt-12" href="' + waLink(lastApproved.whatsapp, lastApproved.first_name) + '" target="_blank" rel="noopener">' + window.AmanUI.I("chat",15) + ' WhatsApp ' + esc(lastApproved.first_name) + '</a>' +
      '<button class="btn btn-ghost block mt-8" data-wa-dismiss>Close</button>' +
      '</div>' : "";
    if (!pending.length) {
      el.innerHTML = banner + '<div class="empty"><div class="big">' + window.AmanUI.I("check_circle",36) + '</div>No registrations waiting.<br>All applications have been reviewed.</div>';
      bindApproveBanner(el);
      return;
    }
    el.innerHTML = banner + pending.map(function (u) {
      return userCard(u,
        '<div class="row mt-12">' +
        '<button class="btn btn-ok grow" data-approve="' + u.id + '">' + window.AmanUI.I("check",15) + ' Approve</button>' +
        '<button class="btn btn-ghost danger grow" data-decline="' + u.id + '">' + window.AmanUI.I("x",15) + ' Decline</button></div>');
    }).join("");
    bindApproveBanner(el);
    el.querySelectorAll("[data-approve]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-approve");
        var u = S.users().filter(function (x) { return x.id === id; })[0];
        S.approveUser(id);
        if (u) lastApproved = u;
        window.AmanUI.toast("Volunteer approved — welcome sent in the app and team chat.", "ok");
        window.AmanUI.refreshBell();
        render(el);
      };
    });
    el.querySelectorAll("[data-decline]").forEach(function (b) {
      b.onclick = function () {
        if (confirm("Decline this application?")) {
          S.declineUser(b.getAttribute("data-decline"));
          window.AmanUI.toast("Application declined.");
          render(el);
        }
      };
    });
  }

  function bindApproveBanner(el) {
    var b = el.querySelector("[data-wa-dismiss]");
    if (b) b.onclick = function () { lastApproved = null; render(el); };
  }

  /* ---------------- volunteers ---------------- */
  function renderVolunteers(el) {
    var S = window.AmanStore;
    var users = S.users().slice().sort(function (a, b) { return a.status === b.status ? a.first_name.localeCompare(b.first_name) : (a.status === "approved" ? -1 : 1); });
    var counts = { approved: 0, pending: 0, declined: 0 };
    users.forEach(function (u) { counts[u.status] = (counts[u.status] || 0) + 1; });
    el.innerHTML =
      '<div class="stat-grid">' +
      '<div class="stat"><div class="s-num">' + counts.approved + '</div><div class="s-label">Active</div></div>' +
      '<div class="stat"><div class="s-num">' + counts.pending + '</div><div class="s-label">Pending</div></div>' +
      '<div class="stat"><div class="s-num">' + counts.declined + '</div><div class="s-label">Declined</div></div></div>' +
      users.map(function (u) {
        var roleChip = u.role === "coordinator" ? ' <span class="chip teal">Coordinator</span>' : "";
        return userCard(u, '<div style="margin-top:8px">' + roleChip + "</div>");
      }).join("");
  }

  /* ---------------- roster management ---------------- */
  function renderRoster(el) {
    var S = window.AmanStore;
    var slots = S.slots();
    var me = S.sessionUser();
    var approved = S.users().filter(function (u) { return u.status === "approved" && u.role === "volunteer"; });
    el.innerHTML =
      '<button class="btn btn-teal block mb-0" id="add-slot-btn" style="margin-bottom:12px">+ Create patrol slot</button>' +
      slots.map(function (s) {
        var rows = s.claims.map(function (c) {
          return '<div class="row tight" style="padding:6px 0">' +
            '<div class="grow"><span style="font-weight:800;font-size:0.82rem">' + esc(c.user.first_name + " " + c.user.surname) + "</span> " +
            '<span class="chip ' + (c.status === "completed" ? "ok" : c.status === "started" ? "info" : "grey") + '" style="margin-left:6px">' + c.status + "</span></div>" +
            (c.status !== "started" ? '<button class="btn btn-ghost danger btn-sm" data-remove-claim="' + c.id + '">Remove</button>' : '<span style="font-size:0.7rem;color:var(--muted)">on shift</span>') +
            "</div>";
        }).join("") || '<div class="muted" style="font-size:0.78rem;padding:4px 0">No volunteers yet.</div>';
        var taken = s.claims.map(function (c) { return c.user_id; });
        var free = approved.filter(function (u) { return taken.indexOf(u.id) === -1; });
        var assign = free.length
          ? '<div class="row mt-8"><select data-assign="' + s.id + '" style="flex:1;min-height:42px;border:1.5px solid var(--line);border-radius:10px;padding:8px;font-size:0.82rem">' +
            '<option value="">Assign volunteer…</option>' + free.map(function (u) { return '<option value="' + u.id + '">' + esc(u.first_name + " " + u.surname) + "</option>"; }).join("") + "</select></div>"
          : "";
        return '<div class="card slot' + (s.zone ? " " + (s.zone.indexOf("A") !== -1 ? "zone-a" : "zone-b") : "") + '">' +
          '<div class="row spread"><div>' +
          (s.zone
            ? '<span class="chip ' + (s.zone.indexOf("A") !== -1 ? "zone-a" : "zone-b") + '">' + esc(s.zone) + "</span>"
            : '<span class="chip grey">Volunteer-created</span>') +
          '<h3 style="margin:7px 0 2px">' + esc(s.activity_window) + "</h3>" +
          '<div class="muted" style="font-size:0.78rem">' + esc(S.fmtDate(s.date)) + " · " + esc(s.time_window) + " · min " + s.min_required + "</div></div>" +
          '<div class="center"><div class="count-pill">' + s.count + " / " + s.min_required + '</div><span class="chip ' + (s.understaffed ? "warn" : "ok") + '" style="margin-top:6px">' + (s.understaffed ? "Understaffed" : "Fully staffed") + "</span></div></div>" +
          '<div class="divider"></div>' + rows + assign +
          '<div class="row mt-8"><button class="link-btn" data-del-slot="' + s.id + '" style="color:var(--danger)">Delete slot</button></div>' +
          "</div>";
      }).join("");

    document.getElementById("add-slot-btn").onclick = addSlotModal;
    el.querySelectorAll("[data-remove-claim]").forEach(function (b) {
      b.onclick = function () { S.removeClaim(b.getAttribute("data-remove-claim")); renderRoster(el); };
    });
    el.querySelectorAll("[data-assign]").forEach(function (sel) {
      sel.onchange = function () {
        var uid = sel.value;
        if (!uid) return;
        S.assignVolunteer(sel.getAttribute("data-assign"), uid);
        window.AmanUI.toast("Volunteer assigned.");
        renderRoster(el);
      };
    });
    el.querySelectorAll("[data-del-slot]").forEach(function (b) {
      b.onclick = function () {
        if (confirm("Delete this patrol slot and its sign-ups?")) {
          S.removeSlot(b.getAttribute("data-del-slot"));
          renderRoster(el);
        }
      };
    });
  }

  function addSlotModal() {
    var S = window.AmanStore;
    window.AmanUI.modal(
      "<h3>Create patrol slot</h3><p class=\"m-sub\">Patrols run in pairs — the slot opens on the roster for two volunteers to claim.</p>" +
      '<div class="field"><label>Date</label><input type="date" id="ns-date" value="' + S.todayISO() + '" min="' + S.todayISO() + '"></div>' +
      '<div class="grid-2">' +
      '<div class="field"><label>Start time</label><input type="time" id="ns-start" value="18:00"></div>' +
      '<div class="field"><label>End time</label><input type="time" id="ns-end" value="20:00"></div></div>' +
      '<div class="m-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-teal" id="ns-save">Create</button></div>',
      function (root) {
        root.querySelector("#ns-save").onclick = function () {
          var d = root.querySelector("#ns-date").value;
          if (!d) { window.AmanUI.toast("Please choose a date.", "error"); return; }
          var res = S.createSlot({
            date: d,
            start_time: root.querySelector("#ns-start").value,
            end_time: root.querySelector("#ns-end").value,
            created_by: S.sessionUser().id,
            claim_for_creator: false
          });
          if (!res.ok) { window.AmanUI.toast(res.error, "error"); return; }
          window.AmanUI.closeModal();
          window.AmanUI.toast("Patrol slot created.");
          renderRoster(document.getElementById("admin-body"));
        };
      }
    );
  }

  /* ---------------- incidents management ---------------- */
  function renderIncidents(el) {
    var S = window.AmanStore;
    var filter = renderIncidents.filter || "all";
    var list = S.incidents().filter(function (i) { return filter === "all" || i.status === filter; });
    el.innerHTML =
      '<div class="row wrap" style="margin-bottom:12px" id="inc-filter">' +
      ["all"].concat(STATUSES).map(function (f) {
        return '<button class="layer-btn' + (f === filter ? " on" : "") + '" data-f="' + f + '">' + (f === "all" ? "All" : f) + "</button>";
      }).join("") + "</div>" +
      (list.length ? list.map(function (i) {
        var reporter = S.userById(i.user_id);
        return '<div class="card tight inc-row" data-inc="' + i.id + '" style="cursor:pointer">' +
          '<div class="row spread"><div class="grow">' +
          '<div style="font-weight:800;font-size:0.86rem">' + incIcon(i.category) + " " + esc(i.category) + "</div>" +
          '<div class="muted" style="font-size:0.74rem;margin-top:3px">' + esc(S.fmtDateTime(i.created_at)) + " · " + esc(reporter ? reporter.first_name + " " + reporter.surname[0] + "." : "?") + "</div></div>" +
          '<span class="chip ' + statusClass(i.status) + '">' + esc(i.status) + "</span></div>" +
          '<div class="muted" style="font-size:0.76rem;margin-top:6px">' + esc((i.location_address || "") + " · " + (i.zone || "")) + "</div>" +
          "</div>";
      }).join("") : '<div class="empty"><div class="big">' + window.AmanUI.I("list",36) + '</div>No incidents match this filter.</div>');

    el.querySelector("#inc-filter").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]");
      if (!b) return;
      renderIncidents.filter = b.getAttribute("data-f");
      renderIncidents(el);
    });
    el.querySelectorAll(".inc-row").forEach(function (r) {
      r.onclick = function () { incidentModal(r.getAttribute("data-inc"), el); };
    });
  }
  renderIncidents.filter = "all";

  function incIcon(cat) {
    if (cat.indexOf("Vehicle") !== -1) return window.AmanUI.I("car", 15);
    if (cat.indexOf("Person") !== -1) return window.AmanUI.I("user", 15);
    return window.AmanUI.I("alert", 15);
  }
  function statusClass(s) {
    if (s === "Resolved") return "ok";
    if (s === "SAPS/Security Notified") return "info";
    if (s === "Acknowledged") return "teal";
    return "warn";
  }

  /* ---------------- incident modal (view / edit) ---------------- */
  function incidentModal(id, listEl) {
    var S = window.AmanStore;
    var ui = window.AmanUI;
    var i = S.incidentById(id);
    if (!i) return;
    var me = S.sessionUser();
    var coord = me && me.role === "coordinator";
    var reporter = S.userById(i.user_id);
    var fieldsHtml = Object.keys(i.fields || {}).map(function (k) {
      return "<div><span class=\"dl-k\">" + esc(k.replace(/_/g, " ")) + "</span><span class=\"dl-v\">" + esc(i.fields[k]) + "</span></div>";
    }).join("");

    var statusHtml = coord
      ? '<div class="field"><label>Status</label><select id="im-status">' + STATUSES.map(function (s) { return "<option" + (s === i.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>"
      : '<dl class="kv"><dt>Status</dt><dd><span class="chip ' + statusClass(i.status) + '">' + esc(i.status) + "</span></dd></dl>";

    var responderForm = coord
      ? '<div class="grid-2">' +
        '<div class="field"><label>Responder type</label><select id="im-rtype">' + ["None yet", "SAPS", "EMS/Ambulance", "Armed Response", "Private Security", "Fire"].map(function (t) { return "<option" + (t === i.responder_type ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>Officer / name</label><input id="im-rname" value="' + esc(i.responder_name) + '"></div>' +
        '<div class="field"><label>Vehicle reg</label><input id="im-rreg" value="' + esc(i.vehicle_reg) + '"></div>' +
        '<div class="field"><label>Call sign</label><input id="im-rcs" value="' + esc(i.call_sign) + '"></div></div>' +
        '<div class="field"><label>Contact details</label><input id="im-rcontact" value="' + esc(i.contact_details) + '"></div>' +
        '<div class="field"><label>Outcome / action taken</label><textarea id="im-routcome" style="min-height:64px">' + esc(i.outcome) + "</textarea></div>"
      : '<dl class="kv">' +
        "<dt>Responder</dt><dd>" + esc(i.responder_type + (i.responder_name ? " — " + i.responder_name : "")) + "</dd>" +
        (i.contact_details ? "<dt>Contact</dt><dd>" + esc(i.contact_details) + "</dd>" : "") +
        (i.outcome ? "<dt>Outcome</dt><dd>" + esc(i.outcome) + "</dd>" : "") + "</dl>";

    var body =
      "<h3>" + incIcon(i.category) + " " + esc(i.category) + "</h3>" +
      '<p class="m-sub">Logged ' + esc(S.fmtDateTime(i.created_at)) + " by " + esc(reporter ? reporter.first_name + " " + reporter.surname : "?") + " · " + esc(i.zone || "") + "</p>" +
      '<dl class="kv"><dt>Location</dt><dd>' + esc(i.location_address) + "</dd>" +
      "<dt>GPS</dt><dd>" + esc(i.gps_lat + ", " + i.gps_lng) + "</dd></dl>" +
      '<div class="row mt-8" style="gap:8px;margin-bottom:12px">' +
      '<button type="button" class="btn btn-teal btn-sm grow" id="im-route-btn">' + ui.I("map", 14) + ' Route on Map</button>' +
      '<a class="btn btn-ghost btn-sm grow" href="https://www.google.com/maps/dir/?api=1&destination=' + i.gps_lat + ',' + i.gps_lng + '" target="_blank" rel="noopener">Google Maps</a></div>' +
      (i.photo_url ? '<img src="' + i.photo_url + '" class="photo-preview" alt="Incident photo" style="max-height:180px">' : "") +
      (i.description ? '<div class="field"><label>Description</label><div style="font-size:0.84rem;line-height:1.5">' + esc(i.description) + "</div></div>" : "") +
      (fieldsHtml ? '<div class="detail-list" style="margin-bottom:12px">' + fieldsHtml + "</div>" : "") +
      statusHtml +
      '<div class="divider"></div><h3 style="font-size:0.92rem">Response &amp; handover</h3>' +
      responderForm +
      '<div class="m-actions"><button class="btn btn-ghost" data-close>Close</button>' +
      (coord ? '<button class="btn btn-teal" id="im-save">Save changes</button>' : "") + "</div>";

    ui.modal(body, function (root) {
      var rBtn = root.querySelector("#im-route-btn");
      if (rBtn) {
        rBtn.onclick = function () {
          ui.closeModal();
          location.hash = "#/map";
          setTimeout(function () {
            if (window.AmanMap && window.AmanMap.routeTo) {
              window.AmanMap.routeTo(i.gps_lat, i.gps_lng, i.category);
            }
          }, 350);
        };
      }
      if (!coord) return;
      root.querySelector("#im-save").onclick = function () {
        S.updateIncident(id, {
          status: root.querySelector("#im-status").value,
          responder_type: root.querySelector("#im-rtype").value,
          responder_name: root.querySelector("#im-rname").value.trim(),
          vehicle_reg: root.querySelector("#im-rreg").value.trim(),
          call_sign: root.querySelector("#im-rcs").value.trim(),
          contact_details: root.querySelector("#im-rcontact").value.trim(),
          outcome: root.querySelector("#im-routcome").value.trim()
        });
        ui.closeModal();
        ui.toast("Incident updated. Reporter notified of status change.", "ok");
        ui.refreshBell();
        if (listEl) renderIncidents(listEl);
      };
    });
  }

  /* ---------------- reports ---------------- */
  function renderReports(el) {
    var S = window.AmanStore;
    var f = REPORT_FILTER;

    function daysAgoISO(n) {
      var d = new Date(); d.setDate(d.getDate() - n);
      return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    }
    if (!f.from) f.from = daysAgoISO(30);
    if (!f.to) f.to = S.todayISO();

    var list = S.incidents().filter(function (i) {
      var d = i.created_at.slice(0, 10);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      if (f.category && i.category !== f.category) return false;
      if (f.status && i.status !== f.status) return false;
      return true;
    });

    var counts = { "Suspicious Vehicle (VOI)": 0, "Suspicious Person (POI)": 0, "Incident (SOI)": 0 };
    list.forEach(function (i) { counts[i.category] = (counts[i.category] || 0) + 1; });
    var byStatus = {};
    list.forEach(function (i) { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });

    var shifts = S.completedShifts();

    el.innerHTML =
      '<div class="card tight">' +
      '<h3 style="font-size:0.9rem">Filters</h3>' +
      '<div class="grid-2">' +
      '<div class="field"><label>From</label><input type="date" id="rf-from" value="' + f.from + '"></div>' +
      '<div class="field"><label>To</label><input type="date" id="rf-to" value="' + f.to + '"></div></div>' +
      '<div class="grid-2">' +
      '<div class="field"><label>Category</label><select id="rf-cat"><option value="">All categories</option>' + Object.keys(counts).map(function (c) { return '<option' + (f.category === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Status</label><select id="rf-status"><option value="">All statuses</option>' + STATUSES.map(function (s) { return '<option' + (f.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div></div>" +
      '<button class="btn btn-primary block" id="rf-apply">Apply filters</button></div>' +

      '<div class="stat-grid">' +
      '<div class="stat"><div class="s-num">' + list.length + '</div><div class="s-label">Total</div></div>' +
      '<div class="stat"><div class="s-num">' + counts["Suspicious Vehicle (VOI)"] + '</div><div class="s-label">Vehicles</div></div>' +
      '<div class="stat"><div class="s-num">' + counts["Suspicious Person (POI)"] + '</div><div class="s-label">Persons</div></div>' +
      '<div class="stat"><div class="s-num">' + counts["Incident (SOI)"] + '</div><div class="s-label">Incidents</div></div></div>' +

      (Object.keys(byStatus).length ? '<div class="card tight"><div class="detail-list">' + STATUSES.filter(function (s) { return byStatus[s]; }).map(function (s) {
        return '<div><span class="dl-k">' + s + '</span><span class="dl-v">' + byStatus[s] + "</span></div>";
      }).join("") + "</div></div>" : "") +

      '<button class="btn btn-teal block" id="csv-btn" style="margin-bottom:12px">' + window.AmanUI.I("download",16) + ' Export incidents as CSV</button>' +

      '<h3 style="font-size:0.95rem;margin:4px 0 8px">Incidents (' + list.length + ")</h3>" +
      '<div class="card tight tbl-wrap"><table class="tbl"><tr><th>When</th><th>Category</th><th>Zone</th><th>Status</th></tr>' +
      (list.map(function (i) {
        return "<tr><td>" + esc(S.fmtDateTime(i.created_at)) + "</td><td>" + esc(i.category.replace(" (", "<br>(")) + "</td><td>" + esc((i.zone || "").replace("Zone ", "")) + "</td><td>" + esc(i.status) + "</td></tr>";
      }).join("") || '<tr><td colspan="4" class="center">No incidents in range</td></tr>') +
      "</table></div>" +

      '<h3 style="font-size:0.95rem;margin:16px 0 8px">Completed shifts (' + shifts.length + ")</h3>" +
      '<div class="card tight tbl-wrap"><table class="tbl"><tr><th>Volunteer</th><th>Shift</th><th>Start</th><th>End</th><th>Duration</th></tr>' +
      (shifts.map(function (c) {
        var dur = "";
        if (c.start_shift_time && c.end_shift_time) {
          var mins = Math.round((new Date(c.end_shift_time) - new Date(c.start_shift_time)) / 60000);
          dur = (mins >= 60 ? Math.floor(mins / 60) + "h " : "") + (mins % 60) + "m";
        }
        return "<tr><td>" + esc(c.user.first_name + " " + c.user.surname) + "</td><td>" +
          esc(c.slot ? c.slot.zone.replace("Zone ", "") + " · " + c.slot.activity_window + " · " + S.fmtDate(c.slot.date) : "?") +
          "</td><td>" + esc(S.fmtDateTime(c.start_shift_time)) + "</td><td>" + esc(S.fmtDateTime(c.end_shift_time)) + "</td><td>" + dur + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="center">No completed shifts yet — start and end a shift from the Roster screen.</td></tr>') +
      "</table></div>";

    document.getElementById("rf-apply").onclick = function () {
      f.from = document.getElementById("rf-from").value;
      f.to = document.getElementById("rf-to").value;
      f.category = document.getElementById("rf-cat").value;
      f.status = document.getElementById("rf-status").value;
      renderReports(el);
    };
    document.getElementById("csv-btn").onclick = function () {
      var csv = S.incidentsCSV();
      var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aman-patrol-incidents-" + S.todayISO() + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      window.AmanUI.toast("CSV downloaded.", "ok");
    };
  }

  window.AmanAdmin = { render: render, incidentModal: incidentModal };
})();
