/* ============================================================
   AMAN PATROL — Log an Incident.
   Auto-captures GPS + time, then category-specific fields:
   VOI (suspicious vehicle), POI (suspicious person), SOI (incident).
   Includes photo upload with privacy consent, and the
   response & handover record.
   ============================================================ */
(function () {
  "use strict";

  var CATS = [
    {
      id: "VOI", seg: "Vehicle", full: "Suspicious Vehicle (VOI)",
      fields: [
        { k: "registration_number", l: "Registration Number", t: "text", ph: "e.g. JD 54 GP (or “no plates”)" },
        { k: "make_model", l: "Make & Model", t: "text", ph: "e.g. White Toyota Hilux" },
        { k: "colour", l: "Colour", t: "text", ph: "e.g. White" },
        { k: "distinguishing_marks", l: "Distinguishing Marks", t: "text", ph: "Dents, stickers, canopy, missing hubcap…" },
        { k: "direction", l: "Direction of Travel", t: "select", o: ["Unknown", "Stationary", "North", "South", "East", "West"] },
        { k: "speed_pace", l: "Speed / Pace", t: "select", o: ["Unknown", "Stationary", "Slow – crawling", "Normal", "Fast / hasty"] },
        { k: "occupants", l: "Occupants", t: "text", ph: "How many people, brief description" }
      ]
    },
    {
      id: "POI", seg: "Person", full: "Suspicious Person (POI)",
      fields: [
        { k: "number_of_persons", l: "Number of Persons", t: "text", ph: "e.g. 2" },
        { k: "gender", l: "Gender", t: "select", o: ["Unknown", "Male", "Female", "Mixed group"] },
        { k: "approximate_age", l: "Approximate Age", t: "text", ph: "e.g. early 20s" },
        { k: "build", l: "Build", t: "select", o: ["Unknown", "Slim", "Medium", "Stocky", "Heavy", "Tall", "Short"] },
        { k: "clothing_top", l: "Clothing – Top", t: "text", ph: "e.g. dark grey hoodie" },
        { k: "clothing_bottom", l: "Clothing – Bottom", t: "text", ph: "e.g. blue jeans" },
        { k: "distinguishing_features", l: "Distinguishing Features", t: "text", ph: "Backpack, limp, tattoos…" },
        { k: "direction", l: "Direction of Travel", t: "select", o: ["Unknown", "Stationary", "North", "South", "East", "West"] }
      ]
    },
    {
      id: "SOI", seg: "Incident", full: "Incident (SOI)",
      fields: [
        { k: "incident_type", l: "Incident Type", t: "select", o: ["Suspicious activity", "Housebreaking attempt", "Theft from vehicle", "Smash-and-grab", "Robbery", "Vandalism", "Cable theft", "Trespassing", "Other"] },
        { k: "modus_operandi", l: "Modus Operandi", t: "textarea", ph: "What happened / how was it attempted?" },
        { k: "location_address", l: "Location / Address", t: "text", ph: "Auto-filled from GPS — correct if needed", auto: true },
        { k: "property_owner_notified", l: "Property Owner Notified?", t: "select", o: ["Unknown", "No", "Yes"] },
        { k: "saps_ar_called", l: "SAPS or Armed Response Called?", t: "select", o: ["No", "SAPS", "Armed response", "Both"] }
      ]
    }
  ];

  var RESPONDER_TYPES = ["None yet", "SAPS", "EMS/Ambulance", "Armed Response", "Private Security", "Fire"];

  var state = { cat: "VOI", gps: null, address: "", photo: null };

  function cat() {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === state.cat) return CATS[i];
    return CATS[0];
  }

  function captureGPS() {
    var box = document.getElementById("gps-box");
    if (!navigator.geolocation) { setGps(null); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), source: "device GPS" });
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      function () { setGps(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  function setGps(gps) {
    state.gps = gps || { lat: (window.AREA.center.lat), lng: (window.AREA.center.lng), accuracy: null, source: "approximate area centre (GPS unavailable)" };
    var box = document.getElementById("gps-box");
    if (!box) return;
    var g = state.gps;
    box.innerHTML =
      '<div style="flex:1">' +
      '<div class="gps-main">📍 ' + g.lat.toFixed(5) + ", " + g.lng.toFixed(5) + "</div>" +
      '<div class="gps-sub">' + (g.accuracy ? "±" + g.accuracy + "m · " : "") + g.source +
      " · " + window.AmanStore.fmtDateTime(new Date().toISOString()) + "</div></div>" +
      '<button type="button" class="link-btn" style="color:#7de3e3" id="gps-retry">Retry</button>';
    document.getElementById("gps-retry").onclick = function () {
      box.innerHTML = '<div style="flex:1"><div class="gps-main">📍 Locating…</div><div class="gps-sub">Requesting your position</div></div>';
      captureGPS();
    };
  }

  function reverseGeocode(lat, lng) {
    fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json&zoom=17")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var a = j && j.display_name ? j.display_name.split(", ").slice(0, 3).join(", ") : "";
        if (a) {
          state.address = a + " (approx. from map)";
          var el = document.getElementById("f-location_address");
          if (el) el.value = state.address;
        }
      })
      .catch(function () { /* stay with coordinates */ });
  }

  function fieldHtml(f) {
    var id = "f-" + f.k;
    var control;
    if (f.t === "select") {
      control = '<select id="' + id + '"><option value="">Select…</option>' +
        f.o.map(function (o) { return "<option>" + window.AmanUI.esc(o) + "</option>"; }).join("") + "</select>";
    } else if (f.t === "textarea") {
      control = '<textarea id="' + id + '" placeholder="' + window.AmanUI.esc(f.ph || "") + '"></textarea>';
    } else {
      control = '<input type="text" id="' + id + '" placeholder="' + window.AmanUI.esc(f.ph || "") + '">';
    }
    return '<div class="field"><label for="' + id + '">' + f.l + "</label>" + control + "</div>";
  }

  function render(screen) {
    state = { cat: "VOI", gps: null, address: "", photo: null };
    screen.className = "screen";
    screen.innerHTML =
      '<h1 class="page-title">Log an incident</h1>' +
      '<p class="page-sub">Observe and report — do not confront. Your GPS position and the current time are captured automatically.</p>' +
      '<div class="gps-box" id="gps-box"><div style="flex:1"><div class="gps-main">📍 Locating…</div><div class="gps-sub">Requesting your position</div></div></div>' +

      '<div class="segmented" id="cat-seg">' +
      CATS.map(function (c) { return '<button data-cat="' + c.id + '" class="' + (c.id === state.cat ? "active" : "") + '">' + c.seg + "</button>"; }).join("") +
      "</div>" +
      '<p class="page-sub" style="margin:-6px 0 12px" id="cat-full"></p>' +
      '<div id="cat-fields"></div>' +

      '<div class="divider"></div>' +
      '<div class="field"><label>Description <span class="req">*</span></label>' +
      '<textarea id="f-description" placeholder="What did you see? Be factual and specific — times, actions, exact location details."></textarea></div>' +

      '<div class="field"><label>Photo (camera / gallery)</label>' +
      '<input type="file" id="f-photo" accept="image/*" style="display:none">' +
      '<button type="button" class="btn btn-ghost block" id="photo-btn">📷 Attach photo</button>' +
      '<img id="photo-preview" class="photo-preview hidden" alt="Photo preview">' +
      '<button type="button" class="link-btn hidden" id="photo-remove">Remove photo</button>' +
      '<div class="hint">Photos of vehicles, property or the street scene only — never of people without need, and never of victims or minors.</div></div>' +

      '<label class="check" id="photo-consent-wrap"><input type="checkbox" id="f-consent">' +
      "<span>I confirm this photo does not show a victim or a minor.</span></label>" +

      '<details style="margin:6px 0 14px">' +
      '<summary style="font-weight:800;font-size:0.86rem;color:var(--navy);padding:10px 0;cursor:pointer">Response &amp; handover (if responders attended)</summary>' +
      '<div style="padding-top:6px">' +
      '<div class="grid-2">' +
      '<div class="field"><label>Responder type</label><select id="f-responder_type">' + RESPONDER_TYPES.map(function (t) { return "<option>" + t + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Officer / Responder name</label><input type="text" id="f-responder_name"></div>' +
      '<div class="field"><label>Vehicle registration</label><input type="text" id="f-vehicle_reg" placeholder="e.g. ARR-102 GP"></div>' +
      '<div class="field"><label>Call sign</label><input type="text" id="f-call_sign" placeholder="e.g. EAGLE 4"></div>' +
      "</div>" +
      '<div class="field"><label>Contact details</label><input type="text" id="f-contact_details" placeholder="Phone / radio channel"></div>' +
      '<div class="field"><label>Arrival time</label><input type="datetime-local" id="f-arrival_time"></div>' +
      '<div class="field"><label>Outcome / Action taken</label><textarea id="f-outcome" style="min-height:70px" placeholder="What did the responder do?"></textarea></div>' +
      "</div></details>" +

      '<button class="btn btn-teal block" id="incident-submit" style="min-height:54px">Submit report</button>' +
      '<p class="center" style="font-size:0.7rem;color:var(--muted);margin-top:10px">Your report goes to the coordinator immediately. In an emergency, call 10111 (SAPS) first — then log it here.</p>';

    renderCatFields();
    setGps(null);
    captureGPS();
    bind();
  }

  function renderCatFields() {
    var c = cat();
    document.getElementById("cat-full").innerHTML = "<b>" + c.full + "</b>";
    document.getElementById("cat-fields").innerHTML = c.fields.map(fieldHtml).join("");
    if (state.address) {
      var el = document.getElementById("f-location_address");
      if (el) el.value = state.address;
    }
  }

  function bind() {
    var seg = document.getElementById("cat-seg");
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-cat]");
      if (!b) return;
      state.cat = b.getAttribute("data-cat");
      seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      renderCatFields();
    });

    var fileInput = document.getElementById("f-photo");
    document.getElementById("photo-btn").onclick = function () { fileInput.click(); };
    fileInput.onchange = function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      compressPhoto(f, function (dataUrl) {
        state.photo = dataUrl;
        var img = document.getElementById("photo-preview");
        img.src = dataUrl; img.classList.remove("hidden");
        document.getElementById("photo-remove").classList.remove("hidden");
        document.getElementById("photo-consent-wrap").style.background = "var(--warn-soft)";
      });
    };
    document.getElementById("photo-remove").onclick = function () {
      state.photo = null; fileInput.value = "";
      document.getElementById("photo-preview").classList.add("hidden");
      document.getElementById("photo-remove").classList.add("hidden");
      document.getElementById("f-consent").checked = false;
      document.getElementById("photo-consent-wrap").style.background = "var(--teal-soft)";
    };

    document.getElementById("incident-submit").onclick = submit;
  }

  function compressPhoto(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1000;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    var ui = window.AmanUI;
    var S = window.AmanStore;
    var user = S.sessionUser();
    if (!user) return;

    var c = cat();
    var fields = {};
    var missing = [];
    c.fields.forEach(function (f) {
      var el = document.getElementById("f-" + f.k);
      if (!el) return;
      var v = el.value.trim();
      if (v) fields[f.k] = v;
      if (f.k === "incident_type" && !v) missing.push("Incident Type");
    });
    var desc = document.getElementById("f-description").value.trim();
    if (!desc) { ui.toast("Please add a short description of what you saw.", "error"); return; }
    if (missing.length) { ui.toast("Please complete: " + missing.join(", "), "error"); return; }
    if (state.photo && !document.getElementById("f-consent").checked) {
      ui.toast("Please tick the photo confirmation — no victims or minors.", "error");
      return;
    }

    var arrival = document.getElementById("f-arrival_time").value;
    var res = S.addIncident({
      user_id: user.id,
      category: c.full,
      gps_lat: state.gps.lat, gps_lng: state.gps.lng,
      location_address: fields.location_address || state.address || (state.gps.lat.toFixed(5) + ", " + state.gps.lng.toFixed(5)),
      description: desc,
      photo_url: state.photo,
      responder_type: document.getElementById("f-responder_type").value || "None yet",
      responder_name: document.getElementById("f-responder_name").value.trim(),
      vehicle_reg: document.getElementById("f-vehicle_reg").value.trim(),
      call_sign: document.getElementById("f-call_sign").value.trim(),
      contact_details: document.getElementById("f-contact_details").value.trim(),
      arrival_time: arrival ? new Date(arrival).toISOString() : null,
      outcome: document.getElementById("f-outcome").value.trim(),
      fields: fields
    });

    if (!res.ok) { ui.toast(res.error || "Could not save the report.", "error"); return; }

    var inc = res.incident;
    var screen = document.getElementById("screen");
    screen.innerHTML =
      '<div class="card center" style="padding:26px 16px">' +
      '<div style="font-size:3rem">✅</div>' +
      '<h3 style="font-size:1.15rem">Report submitted</h3>' +
      '<p class="muted" style="font-size:0.84rem;line-height:1.55">Jazakallahu khayran. Your ' + ui.esc(inc.category) +
      " report was logged at " + S.fmtDateTime(inc.created_at) + " and the coordinator has been notified.</p>" +
      '<div class="row" style="justify-content:center;margin:10px 0"><span class="chip ' + (inc.zone.indexOf("A") !== -1 ? "zone-a" : "zone-b") + '">' + ui.esc(inc.zone) + "</span></div>" +
      '<dl class="kv" style="text-align:left;margin:14px 0">' +
      "<dt>Location</dt><dd>" + ui.esc(inc.location_address) + "</dd>" +
      "<dt>GPS</dt><dd>" + inc.gps_lat.toFixed(5) + ", " + inc.gps_lng.toFixed(5) + "</dd>" +
      "<dt>Status</dt><dd>" + ui.esc(inc.status) + "</dd>" +
      "</dl>" +
      '<div class="row">' +
      '<button class="btn btn-ghost grow" id="go-map">📍 View on map</button>' +
      '<a class="btn btn-primary grow" href="#/dashboard">Done</a>' +
      "</div></div>";
    document.getElementById("go-map").onclick = function () {
      window.AmanMap.focus(inc.gps_lat, inc.gps_lng, true);
      location.hash = "#/map";
    };
    ui.refreshBell();
    window.scrollTo(0, 0);
  }

  window.AmanIncident = { render: render };
})();
