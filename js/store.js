/* ============================================================
   AMAN PATROL — demo data store (runs entirely on this device).
   ------------------------------------------------------------
   Every function below is written to mirror the Supabase tables
   (profiles, patrol_slots, slot_claims, incidents, map_pins).
   When the Supabase project is connected, these functions will
   be re-implemented against Supabase — the rest of the app will
   not need to change.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- safe storage (falls back to memory in sandboxed previews) ---------- */
  var mem = {};
  var persistent = true;
  var storage;
  try {
    var t = "__aman_test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    storage = window.localStorage;
  } catch (e) {
    persistent = false;
    storage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }

  var DB_KEY = "aman_patrol_db_v2";
  var SESSION_KEY = "aman_patrol_session_v2";

  var ZONE_A = "Zone A – Greenside";
  var ZONE_B = "Zone B – Emmarentia";
  var WINDOWS = ["Morning patrol", "Madrassah drop-off", "Afternoon patrol", "Jumu'ah", "Evening after Maghrib/Isha"];

  /* ---------- date helpers ---------- */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function dateISO(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parseISO(iso) {
    var p = String(iso).slice(0, 10).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  }
  function fmtTime(isoStamp) {
    var d = new Date(isoStamp);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtDateTime(isoStamp) {
    if (!isoStamp) return "";
    var d = new Date(isoStamp);
    return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " · " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function timeAgo(isoStamp) {
    var s = (Date.now() - new Date(isoStamp).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function slotStartISO(slot) {
    var t = String(slot.time_window).split("–")[0].trim();
    var parts = t.split(":");
    var d = parseISO(slot.date);
    d.setHours(+parts[0] || 0, +parts[1] || 0, 0, 0);
    return d.getTime();
  }

  /* ---------- zones ---------- */
  function zoneCenters() {
    var z = (window.AREA && window.AREA.zones) || {};
    return {
      "Zone A – Greenside": z[ZONE_A] || { lat: -26.1547, lng: 28.0128 },
      "Zone B – Emmarentia": z[ZONE_B] || { lat: -26.1472, lng: 27.9958 }
    };
  }
  function zoneOfCoords(lat, lng) {
    var zc = zoneCenters();
    var dA = Math.hypot(lat - zc[ZONE_A].lat, lng - zc[ZONE_A].lng);
    var dB = Math.hypot(lat - zc[ZONE_B].lat, lng - zc[ZONE_B].lng);
    return dA <= dB ? ZONE_A : ZONE_B;
  }

  /* ---------- seed data ---------- */
  function nextFridayOffset() {
    var d = new Date().getDay(); // 0 Sun .. 6 Sat
    var off = (5 - d + 7) % 7;
    return off === 0 ? 7 : off; // always an upcoming Friday
  }

  function seed() {
    var now = Date.now();
    var H = 3600000;
    return {
      counter: 100,
      settings: { whatsapp_group_url: "" },
      sos_log: [],
      users: [
        {
          id: "u-coord", first_name: "Yusuf", surname: "Adams",
          whatsapp: "+27 82 555 0100", email: "coordinator@demo.co.za",
          street: "24 Gleneagles Road", suburb: "Greenside", dob: "1984-06-12",
          emergency_contact_name: "Maryam Adams", emergency_contact_number: "+27 82 555 0101",
          role: "coordinator", status: "approved", password: "demo1234", created_at: new Date(now - 40 * 24 * H).toISOString()
        },
        {
          id: "u-aisha", first_name: "Aisha", surname: "Jacobs",
          whatsapp: "+27 83 555 0110", email: "aisha@demo.co.za",
          street: "9 Rustenburg Road", suburb: "Emmarentia", dob: "1990-02-20",
          emergency_contact_name: "Sadik Jacobs", emergency_contact_number: "+27 83 555 0111",
          role: "volunteer", status: "approved", password: "demo1234", created_at: new Date(now - 21 * 24 * H).toISOString()
        },
        {
          id: "u-mo", first_name: "Muhammad", surname: "Ebrahim",
          whatsapp: "+27 84 555 0120", email: "mo@demo.co.za",
          street: "31 Barry Hertzog Avenue", suburb: "Greenside", dob: "1988-11-05",
          emergency_contact_name: "Zuleikha Ebrahim", emergency_contact_number: "+27 84 555 0121",
          role: "volunteer", status: "approved", password: "demo1234", created_at: new Date(now - 14 * 24 * H).toISOString()
        },
        {
          id: "u-ismail", first_name: "Ismail", surname: "Desai",
          whatsapp: "+27 76 555 0130", email: "pending@demo.co.za",
          street: "5 Judith Road", suburb: "Emmarentia", dob: "1996-09-14",
          emergency_contact_name: "Ahmed Desai", emergency_contact_number: "+27 76 555 0131",
          role: "volunteer", status: "pending", password: "demo1234", created_at: new Date(now - 20 * H).toISOString()
        }
      ],
      slots: [],
      claims: [],
      incidents: [
        {
          id: "i1", user_id: "u-aisha", category: "Suspicious Vehicle (VOI)", status: "SAPS/Security Notified",
          gps_lat: -26.1466, gps_lng: 28.0089, zone: ZONE_A, location_address: "Gleneagles Road, near the Greenside restaurant strip",
          description: "White double-cab bakkie, no rear number plate, circling the block slowly three times during the Madrassah drop-off window. Two occupants appeared to be watching children walking to the masjid.",
          photo_url: null,
          responder_type: "Armed Response", responder_name: "Officer Bongani", vehicle_reg: "ARR-102 GP", call_sign: "EAGLE 4",
          contact_details: "011 555 0100", arrival_time: new Date(now - 26 * H + 40 * 60000).toISOString(), outcome: "Vehicle stopped on Beyers Naudé Drive, SAPS verified driver. Vehicle moved on. Extra patrol requested for tomorrow's pick-up window.",
          fields: { registration_number: "No rear plate", make_model: "White Toyota Hilux double cab", colour: "White", distinguishing_marks: "Canopy, cracked left tail light", direction: "West", speed_pace: "Slow – crawling", occupants: "2 males" },
          created_at: new Date(now - 26 * H).toISOString()
        },
        {
          id: "i2", user_id: "u-mo", category: "Suspicious Person (POI)", status: "Acknowledged",
          gps_lat: -26.1544, gps_lng: 27.9967, zone: ZONE_B, location_address: "Corner Barry Hertzog Avenue and Rustenburg Road, Emmarentia",
          description: "Two males loitering at the bus stop for 20+ minutes, not boarding any buses, watching pedestrians and taking photos of houses on their phones.",
          photo_url: null,
          responder_type: "None yet", responder_name: "", vehicle_reg: "", call_sign: "", contact_details: "", arrival_time: null, outcome: "",
          fields: { number_of_persons: "2", gender: "Male", approximate_age: "Early 20s", build: "Slim", clothing_top: "Dark grey hoodies", clothing_bottom: "Blue jeans", distinguishing_features: "One carrying a small black backpack", direction: "Stationary" },
          created_at: new Date(now - 20 * H).toISOString()
        },
        {
          id: "i3", user_id: "u-aisha", category: "Incident (SOI)", status: "Resolved",
          gps_lat: -26.1643, gps_lng: 28.0111, zone: ZONE_B, location_address: "Emmarentia Avenue, near Emmarentia Primary School",
          description: "Attempted break-in overnight — pry marks on the side gate of a home. No entry gained. Property owner notified and advised to report to SAPS.",
          photo_url: null,
          responder_type: "SAPS", responder_name: "Const. Mokoena", vehicle_reg: "", call_sign: "", contact_details: "10111", arrival_time: new Date(now - 3 * 24 * H + 90 * 60000).toISOString(), outcome: "SAPS scene visit completed. Case opened by the owner. Neighbours asked to check camera footage.",
          fields: { incident_type: "Housebreaking attempt", modus_operandi: "Gate pried with a lever tool, likely during load-shedding hours", property_owner_notified: "Yes", saps_ar_called: "SAPS" },
          created_at: new Date(now - 3 * 24 * H).toISOString()
        }
      ],
      pins: [
        { id: "p1", label: "Unlit stretch — Tana Road Park edge", type: "dark_spot", lat: -26.1479, lng: 28.0005, created_by: "u-coord" },
        { id: "p2", label: "Smash-and-grab hotspot — robots on Greenhill Road", type: "risk_corner", lat: -26.1512, lng: 28.0095, created_by: "u-coord" },
        { id: "p3", label: "Madrassah walking corridor — Greenside Masjid to Greenside Primary", type: "madrassah_corridor", lat: -26.1507, lng: 28.0105, created_by: "u-coord" }
      ],
      notifications: [
        { id: "n1", audience: { type: "user", id: "u-aisha" }, kind: "ok", title: "Your registration was approved", body: "السلام عليكم — Welcome to Aman Patrol, Aisha! Your registration is approved. You can now claim patrol slots. Remember: observe and report only — never patrol alone.", created_at: new Date(now - 21 * 24 * H).toISOString(), read_by: ["u-aisha"] },
        { id: "n2", audience: { type: "user", id: "u-coord" }, kind: "info", title: "New registration awaiting review", body: "Ismail Desai (Emmarentia) has applied to join Aman Patrol.", created_at: new Date(now - 20 * H).toISOString(), read_by: [] },
        { id: "n3", audience: { type: "all" }, kind: "info", title: "Patrol roster open", body: "Volunteers can create and claim shifts from the Roster tab. Minimum 2 patrollers required.", created_at: new Date(now - 5 * H).toISOString(), read_by: [] },
        { id: "n4", audience: { type: "user", id: "u-mo" }, kind: "danger", title: "New incident logged in your zone", body: "Suspicious Vehicle (VOI) reported on Gleneagles Road, Greenside.", created_at: new Date(now - 26 * H).toISOString(), read_by: [] },
        { id: "n5", audience: { type: "all" }, kind: "info", title: "Coordinator announcement", body: "Jumu'ah patrol this week: please be at the masjid by 11:15. As-salamu alaykum — thank you for serving the community.", created_at: new Date(now - 2 * H).toISOString(), read_by: [] }
      ],
      messages: [
        { id: "m1", user_id: "u-coord", body: "As-salamu alaykum team. This chat is for patrol coordination. Observe and report only — never confront or chase.", created_at: new Date(now - 2 * H).toISOString() },
        { id: "m2", user_id: "u-aisha", body: "Noted, shukran. I am on the Madrassah drop-off tomorrow — I will check in here when I start my shift.", created_at: new Date(now - 90 * 60000).toISOString() },
        { id: "m3", user_id: "u-mo", body: "Check-in from my side. WhatsApp group works well for voice notes while walking.", created_at: new Date(now - 35 * 60000).toISOString() }
      ]
    };
  }

  /* ---------- db plumbing ---------- */
  var db;
  function load() {
    if (db) return db;
    var raw = storage.getItem(DB_KEY);
    if (raw) {
      try { db = JSON.parse(raw); }
      catch (e) { db = null; }
    }
    if (!db || !db.users) { db = seed(); save(); }
    rollSlotDates();
    return db;
  }
  function save() {
    try { storage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { /* quota exceeded (e.g. large photo) — keep working in memory */ }
  }
  function rollSlotDates() {
    // keep the demo evergreen: if every slot date has passed, roll dates forward
    var seeds = db.slots.filter(function (s) { return s.day_offset > 0; });
    var allPast = seeds.length > 0 && seeds.every(function (s) { return s.date < todayISO(); });
    if (!allPast) return;
    seeds.forEach(function (s) { s.date = dateISO(s.day_offset); });
    save();
  }
  function uid(prefix) { db.counter = (db.counter || 100) + 1; return prefix + db.counter; }

  /* ---------- auth ---------- */
  function sessionUser() {
    var sid = storage.getItem(SESSION_KEY);
    if (!sid) return null;
    var d = load();
    for (var i = 0; i < d.users.length; i++) if (d.users[i].id === sid) return d.users[i];
    return null;
  }
  function login(email, password) {
    var d = load();
    email = String(email || "").trim().toLowerCase();
    for (var i = 0; i < d.users.length; i++) {
      var u = d.users[i];
      if (u.email.toLowerCase() === email) {
        if (u.password !== password) return { ok: false, error: "Incorrect password. Please try again." };
        storage.setItem(SESSION_KEY, u.id);
        return { ok: true, user: u };
      }
    }
    return { ok: false, error: "No account found with that email. Please register first." };
  }
  function logout() { storage.removeItem(SESSION_KEY); }
  function register(data) {
    var d = load();
    var email = String(data.email || "").trim().toLowerCase();
    if (!email || !data.password) return { ok: false, error: "Email and password are required." };
    for (var i = 0; i < d.users.length; i++) {
      if (d.users[i].email.toLowerCase() === email) return { ok: false, error: "An account with this email already exists. Please log in instead." };
    }
    var user = {
      id: uid("u-"), first_name: data.first_name, surname: data.surname,
      whatsapp: data.whatsapp, email: email, street: data.street, suburb: data.suburb,
      dob: data.dob, emergency_contact_name: data.emergency_contact_name,
      emergency_contact_number: data.emergency_contact_number,
      role: "volunteer", status: "pending", password: data.password, created_at: new Date().toISOString()
    };
    d.users.push(user);
    pushNotif({ audience: { type: "coordinator" }, kind: "info", title: "New registration awaiting review", body: user.first_name + " " + user.surname + " (" + user.suburb + ") has applied to join Aman Patrol." });
    save();
    return { ok: true, user: user };
  }
  function ageFromDob(dob) {
    var p = String(dob).split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age;
  }

  /* ---------- users (coordinator) ---------- */
  function users() { return load().users.slice(); }
  function userById(id) {
    var d = load();
    for (var i = 0; i < d.users.length; i++) if (d.users[i].id === id) return d.users[i];
    return null;
  }
  function userLabel(id) {
    var u = userById(id);
    return u ? u.first_name + " " + u.surname : "Unknown";
  }
  function approveUser(id) {
    var u = userById(id);
    if (!u) return;
    u.status = "approved";
    pushNotif({ audience: { type: "user", id: id }, kind: "ok", title: "Your registration was approved", body: "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ — Welcome to Aman Patrol, " + u.first_name + "! Your registration is approved. You can now claim patrol slots. Remember: observe and report only — never patrol alone." });
    save();
    var su = sessionUser();
    if (su) sendMessage(su.id, "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ — Welcome to Aman Patrol, " + u.first_name + "! You are approved — log in with the email you registered. Observe and report only, never patrol alone. Emergencies: call 10111.");
  }
  function declineUser(id) {
    var u = userById(id);
    if (!u) return;
    u.status = "declined";
    save();
  }

  /* ---------- patrol slots ---------- */
  function claimView(c) {
    var out = {};
    for (var k in c) out[k] = c[k];
    out.user = userById(c.user_id);
    return out;
  }
  function slots() {
    var d = load();
    return d.slots.map(function (s) { return slotView(s, null); }).sort(function (a, b) {
      return slotStartISO(a) - slotStartISO(b);
    });
  }
  function slotById(id) {
    var d = load();
    for (var i = 0; i < d.slots.length; i++) if (d.slots[i].id === id) return slotView(d.slots[i], null);
    return null;
  }
  function slotView(s) {
    var claims = db.claims.filter(function (c) { return c.slot_id === s.id && c.status !== "cancelled"; }).map(claimView);
    return {
      id: s.id, zone: s.zone, activity_window: s.activity_window, date: s.date,
      time_window: s.time_window, min_required: s.min_required, created_by: s.created_by || null,
      claims: claims, count: claims.length,
      understaffed: claims.length < s.min_required,
      full: claims.length >= s.min_required
    };
  }
  function claimSlot(slotId, userId) {
    var d = load();
    var slot = null, i;
    for (i = 0; i < d.slots.length; i++) if (d.slots[i].id === slotId) slot = d.slots[i];
    if (!slot) return { ok: false, error: "Slot not found." };
    for (i = 0; i < d.claims.length; i++) {
      if (d.claims[i].slot_id === slotId && d.claims[i].user_id === userId && d.claims[i].status !== "cancelled")
        return { ok: false, error: "You have already claimed this slot." };
    }
    d.claims.push({ id: uid("c"), slot_id: slotId, user_id: userId, status: "claimed", start_shift_time: null, end_shift_time: null, start_gps: null, end_gps: null, reminded: false });
    var view = slotView(slot);
    var where = slot.zone ? " (" + slot.zone + ")" : "";
    if (view.understaffed) {
      pushNotif({ audience: { type: "all" }, kind: "warn", title: "A patrol slot is understaffed", body: fmtDate(slot.date) + " " + slot.time_window.split("–")[0] + " — " + slot.activity_window + where + " needs one more volunteer." });
    } else {
      pushNotif({ audience: { type: "all" }, kind: "ok", title: "Patrol slot fully staffed", body: slot.activity_window + " on " + fmtDate(slot.date) + where + " now has a full pair. Barakallahu feekum." });
    }
    save();
    return { ok: true };
  }
  function unclaim(slotId, userId) {
    var d = load();
    for (var i = 0; i < d.claims.length; i++) {
      if (d.claims[i].slot_id === slotId && d.claims[i].user_id === userId) {
        if (d.claims[i].status === "started") return { ok: false, error: "Cannot leave a shift that has already started — contact the coordinator." };
        d.claims.splice(i, 1);
        save();
        return { ok: true };
      }
    }
    return { ok: false, error: "You are not signed up for this slot." };
  }
  function myClaims(userId) {
    var d = load();
    return d.claims.filter(function (c) { return c.user_id === userId; }).map(function (c) {
      var out = claimView(c);
      var s = null;
      for (var i = 0; i < d.slots.length; i++) if (d.slots[i].id === c.slot_id) s = d.slots[i];
      out.slot = s;
      return out;
    });
  }
  function myClaimFor(slotId, userId) {
    var list = myClaims(userId);
    for (var i = 0; i < list.length; i++) if (list[i].slot_id === slotId) return list[i];
    return null;
  }
  function startShift(slotId, userId, gps) {
    var c = myClaimFor(slotId, userId);
    if (!c) return { ok: false, error: "Claim this slot first." };
    if (c.status === "started") return { ok: false, error: "Shift already started." };
    if (c.status === "completed") return { ok: false, error: "This shift is already completed." };
    var d = load();
    for (var i = 0; i < d.claims.length; i++) {
      if (d.claims[i].id === c.id) {
        d.claims[i].status = "started";
        d.claims[i].start_shift_time = new Date().toISOString();
        d.claims[i].start_gps = gps;
      }
    }
    save();
    return { ok: true, start_shift_time: new Date().toISOString() };
  }
  function endShift(slotId, userId, gps, notes) {
    var c = myClaimFor(slotId, userId);
    if (!c || c.status !== "started") return { ok: false, error: "Start the shift first." };
    var d = load();
    for (var i = 0; i < d.claims.length; i++) {
      if (d.claims[i].id === c.id) {
        d.claims[i].status = "completed";
        d.claims[i].end_shift_time = new Date().toISOString();
        d.claims[i].end_gps = gps;
        d.claims[i].notes = notes ? String(notes).trim().slice(0, 500) : null;
      }
    }
    save();
    return { ok: true, end_shift_time: new Date().toISOString() };
  }

  function updateProfile(userId, patch) {
    var u = userById(userId);
    if (!u) return { ok: false, error: "User not found." };
    var allowed = ["whatsapp", "emergency_contact_name", "emergency_contact_number", "street", "suburb"];
    var d = load();
    for (var i = 0; i < d.users.length; i++) {
      if (d.users[i].id === userId) {
        allowed.forEach(function (k) {
          if (patch[k] !== undefined) d.users[i][k] = patch[k];
        });
        break;
      }
    }
    save();
    return { ok: true };
  }

  var liveLocations = {};
  function updateLiveLocation(userId, gps) {
    if (!gps) { delete liveLocations[userId]; return; }
    liveLocations[userId] = {
      user_id: userId,
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy || null,
      heading: gps.heading || null,
      updated_at: Date.now()
    };
  }
  function listLiveLocations() {
    var cutoff = Date.now() - 300000;
    var out = [];
    for (var k in liveLocations) {
      if (liveLocations[k].updated_at > cutoff) out.push(liveLocations[k]);
    }
    return out;
  }
  function latestHandoverNote() {
    var d = load();
    var list = d.claims.filter(function (c) { return c.status === "completed" && c.notes && String(c.notes).trim(); });
    list.sort(function (a, b) {
      return new Date(b.end_shift_time || 0) - new Date(a.end_shift_time || 0);
    });
    if (!list.length) return null;
    var c = list[0];
    var u = userById(c.user_id);
    var s = null;
    for (var i = 0; i < d.slots.length; i++) if (d.slots[i].id === c.slot_id) s = d.slots[i];
    return {
      id: c.id,
      notes: c.notes,
      user_name: u ? (u.first_name + " " + (u.surname ? u.surname[0] + "." : "")) : "Volunteer",
      end_time: c.end_shift_time,
      zone: s ? s.zone : "",
      date: s ? s.date : ""
    };
  }

  function completedShifts() {
    var d = load();
    return d.claims.filter(function (c) { return c.status === "completed"; }).map(function (c) {
      var out = claimView(c);
      var s = null;
      for (var i = 0; i < d.slots.length; i++) if (d.slots[i].id === c.slot_id) s = d.slots[i];
      out.slot = s;
      return out;
    }).sort(function (a, b) { return new Date(b.start_shift_time) - new Date(a.start_shift_time); });
  }
  function addSlot(data) {
    var d = load();
    d.slots.push({ id: uid("s"), zone: data.zone, activity_window: data.activity_window, date: data.date, day_offset: 0, time_window: data.time_window, min_required: data.min_required || 2 });
    save();
  }
  function removeSlot(id) {
    var d = load();
    d.slots = d.slots.filter(function (s) { return s.id !== id; });
    d.claims = d.claims.filter(function (c) { return c.slot_id !== id; });
    save();
  }
  function assignVolunteer(slotId, userId) { return claimSlot(slotId, userId); }

  /* ---------- volunteer-created slots (calendar roster) ---------- */
  function createSlot(data) {
    if (!data || !data.date) return { ok: false, error: "Choose a date." };
    if (data.date < todayISO()) return { ok: false, error: "Choose today or a future date." };
    if (!data.start_time || !data.end_time) return { ok: false, error: "Choose a start and an end time." };
    if (String(data.end_time) <= String(data.start_time)) return { ok: false, error: "The end time must be after the start time." };
    var d = load();
    var slot = {
      id: uid("s"), zone: null, activity_window: "Volunteer patrol",
      date: data.date, day_offset: 0,
      time_window: data.start_time + "–" + data.end_time,
      min_required: 2, created_by: data.created_by || null
    };
    d.slots.push(slot);
    var who = data.created_by ? userById(data.created_by) : null;
    if (data.claim_for_creator && who) {
      d.claims.push({ id: uid("c"), slot_id: slot.id, user_id: who.id, status: "claimed", start_shift_time: null, end_shift_time: null, start_gps: null, end_gps: null, reminded: false });
    }
    var need = (data.claim_for_creator && who)
      ? "One more volunteer is needed to make a pair."
      : "Two volunteers are needed — claim it from the roster.";
    pushNotif({
      audience: { type: "all" }, kind: "info", title: "New patrol slot on the roster",
      body: (who
        ? who.first_name + " scheduled a patrol on " + fmtDate(slot.date) + ", " + slot.time_window + ". "
        : "A new patrol slot is open on " + fmtDate(slot.date) + ", " + slot.time_window + ". ") + need
    });
    save();
    return { ok: true, slot: slotView(slot) };
  }
  function deleteOwnSlot(slotId, userId) {
    var d = load();
    var slot = null, i;
    for (i = 0; i < d.slots.length; i++) if (d.slots[i].id === slotId) slot = d.slots[i];
    if (!slot) return { ok: false, error: "Slot not found." };
    if (slot.created_by !== userId) return { ok: false, error: "Only the volunteer who created this slot can delete it." };
    var others = d.claims.filter(function (c) { return c.slot_id === slotId && c.user_id !== userId && c.status !== "cancelled"; });
    if (others.length) return { ok: false, error: "Another volunteer has already joined this slot — leave it instead, or ask the coordinator to remove it." };
    d.slots = d.slots.filter(function (s) { return s.id !== slotId; });
    d.claims = d.claims.filter(function (c) { return c.slot_id !== slotId; });
    save();
    return { ok: true };
  }

  /* ---------- SOS ---------- */
  function raiseSOS(userId, gps) {
    var d = load();
    var u = userById(userId);
    if (!u) return { ok: false, error: "You are not signed in." };
    var onDuty = d.claims.filter(function (c) { return c.status === "started" && c.user_id !== userId; }).length;
    var rec = {
      id: uid("sos"), user_id: userId, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy || null,
      created_at: new Date().toISOString()
    };
    if (!d.sos_log) d.sos_log = [];
    d.sos_log.unshift(rec);
    if (d.sos_log.length > 50) d.sos_log.length = 50;
    var maps = "https://www.google.com/maps/dir/?api=1&destination=" + gps.lat + "," + gps.lng;
    pushNotif({
      audience: { type: "all" }, kind: "sos", link: maps,
      title: "SOS — " + u.first_name + " needs help",
      body: u.first_name + " " + u.surname.charAt(0) + ". sent an SOS at " + fmtTime(rec.created_at) +
        " (GPS " + Number(gps.lat).toFixed(5) + ", " + Number(gps.lng).toFixed(5) + "). " +
        (onDuty
          ? onDuty + " patroller" + (onDuty > 1 ? "s are" : " is") + " on duty — please respond and route to the position."
          : "No patrollers are on duty right now — coordinator, please arrange armed response and check on them.") +
        " Use the route button to navigate there."
    });
    save();
    return { ok: true, sos: rec, on_duty: onDuty };
  }

  /* ---------- settings (set by the coordinator) ---------- */
  function getSetting(key) {
    var d = load();
    return (d.settings && d.settings[key]) || "";
  }
  function setSetting(key, value) {
    var d = load();
    if (!d.settings) d.settings = {};
    d.settings[key] = String(value || "");
    save();
  }
  function removeClaim(claimId) {
    var d = load();
    d.claims = d.claims.filter(function (c) { return c.id !== claimId; });
    save();
  }

  /* ---------- incidents ---------- */
  function incidents() {
    return load().incidents.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function incidentById(id) {
    var d = load();
    for (var i = 0; i < d.incidents.length; i++) if (d.incidents[i].id === id) return d.incidents[i];
    return null;
  }
  function addIncident(data) {
    var d = load();
    var zone = data.zone || zoneOfCoords(data.gps_lat, data.gps_lng);
    var inc = {
      id: uid("i"), user_id: data.user_id, category: data.category, status: "Logged",
      gps_lat: data.gps_lat, gps_lng: data.gps_lng, zone: zone,
      location_address: data.location_address || "", description: data.description || "",
      photo_url: data.photo_url || null,
      responder_type: data.responder_type || "None yet", responder_name: data.responder_name || "",
      vehicle_reg: data.vehicle_reg || "", call_sign: data.call_sign || "",
      contact_details: data.contact_details || "", arrival_time: data.arrival_time || null, outcome: data.outcome || "",
      fields: data.fields || {}, created_at: new Date().toISOString()
    };
    d.incidents.push(inc);
    var reporter = userById(data.user_id);
    pushNotif({
      audience: { type: "all" }, kind: "danger", title: "New incident logged in " + zone,
      body: inc.category + " reported" + (reporter ? " by " + reporter.first_name : "") + (inc.location_address ? " — " + inc.location_address : ".") + " Coordinator to acknowledge."
    });
    save();
    return { ok: true, incident: inc };
  }
  function updateIncident(id, patch) {
    var inc = incidentById(id);
    if (!inc) return;
    for (var k in patch) if (patch.hasOwnProperty(k)) inc[k] = patch[k];
    if (patch.status && patch.status !== inc._lastStatus) {
      pushNotif({ audience: { type: "user", id: inc.user_id }, kind: patch.status === "Resolved" ? "ok" : "info", title: "Incident status updated: " + patch.status, body: "Your " + inc.category + " report has been marked \"" + patch.status + "\"." });
      inc._lastStatus = patch.status;
    }
    save();
  }

  /* ---------- map pins (coordinator) ---------- */
  function pins() { return load().pins.slice(); }
  function addPin(pin) {
    var d = load();
    var p = { id: uid("p"), label: pin.label, type: pin.type, lat: pin.lat, lng: pin.lng, created_by: pin.created_by || null };
    d.pins.push(p);
    save();
    return p;
  }
  function removePin(id) {
    var d = load();
    d.pins = d.pins.filter(function (p) { return p.id !== id; });
    save();
  }

  /* ---------- notifications ---------- */
  function pushNotif(n) {
    var d = load();
    d.notifications.unshift({
      id: uid("n"), audience: n.audience, kind: n.kind || "info",
      title: n.title, body: n.body || "", link: n.link || null, created_at: new Date().toISOString(), read_by: []
    });
    if (d.notifications.length > 200) d.notifications.length = 200;
    save();
  }
  function notifForMe(n, user) {
    if (!user) return false;
    var a = n.audience;
    if (a.type === "user") return a.id === user.id;
    if (a.type === "coordinator") return user.role === "coordinator";
    return true; // all
  }
  function notificationsFor(user) {
    var d = load();
    return d.notifications.filter(function (n) { return notifForMe(n, user); })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function unreadCount(user) {
    return notificationsFor(user).filter(function (n) { return n.read_by.indexOf(user.id) === -1; }).length;
  }
  function markAllRead(user) {
    var d = load();
    d.notifications.forEach(function (n) {
      if (notifForMe(n, user) && n.read_by.indexOf(user.id) === -1) n.read_by.push(user.id);
    });
    save();
  }

  /* ---------- team chat ---------- */
  var CHAT_SEEN_KEY = "aman-chat-seen";
  function chatSeenAt() {
    var v = storage.getItem(CHAT_SEEN_KEY);
    var t = v ? new Date(v).getTime() : 0;
    return isNaN(t) ? 0 : t;
  }
  function markChatSeen() {
    storage.setItem(CHAT_SEEN_KEY, new Date().toISOString());
  }
  function messages() {
    var d = load();
    if (!d.messages) d.messages = [];
    return d.messages.slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  }
  function unreadChatCount(user) {
    if (!user) return 0;
    var seen = chatSeenAt();
    return messages().filter(function (m) {
      return m.user_id !== user.id && new Date(m.created_at).getTime() > seen;
    }).length;
  }
  function sendMessage(userId, body, audioUrl) {
    body = String(body || "").trim().slice(0, 500);
    if (!body && !audioUrl) return { ok: false, error: "Type a message or record audio first." };
    var d = load();
    if (!d.messages) d.messages = [];
    d.messages.push({
      id: uid("m"),
      user_id: userId,
      body: body || "Voice message",
      audio_url: audioUrl || null,
      created_at: new Date().toISOString()
    });
    if (d.messages.length > 500) d.messages.splice(0, d.messages.length - 500);
    save();
    return { ok: true };
  }

  /* ---------- CSV export ---------- */
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    var s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function incidentsCSV() {
    var rows = [["ID", "Logged at", "Category", "Status", "Zone", "Latitude", "Longitude", "Location", "Description", "Responder type", "Responder name", "Vehicle reg", "Call sign", "Contact details", "Arrival time", "Outcome", "Reported by", "Detail fields"]];
    incidents().forEach(function (i) {
      rows.push([
        i.id, fmtDateTime(i.created_at), i.category, i.status, i.zone || "", i.gps_lat, i.gps_lng,
        i.location_address, i.description, i.responder_type, i.responder_name, i.vehicle_reg,
        i.call_sign, i.contact_details, i.arrival_time ? fmtDateTime(i.arrival_time) : "", i.outcome,
        userLabel(i.user_id), JSON.stringify(i.fields)
      ]);
    });
    return rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n");
  }

  /* ---------- demo reset ---------- */
  function resetDemo() {
    storage.removeItem(DB_KEY);
    storage.removeItem(SESSION_KEY);
    db = null;
    load();
  }

  /* ---------- export ---------- */
  window.AmanStore = {
    persistent: persistent,
    ZONES: [ZONE_A, ZONE_B],
    WINDOWS: WINDOWS,
    // auth
    sessionUser: sessionUser, login: login, logout: logout, register: register, ageFromDob: ageFromDob,
    // users
    users: users, userById: userById, userLabel: userLabel, approveUser: approveUser, declineUser: declineUser,
    // slots & claims
    slots: slots, slotById: slotById, claimSlot: claimSlot, unclaim: unclaim, myClaims: myClaims,
    myClaimFor: myClaimFor, startShift: startShift, endShift: endShift, completedShifts: completedShifts, latestHandoverNote: latestHandoverNote, updateProfile: updateProfile, updateLiveLocation: updateLiveLocation, listLiveLocations: listLiveLocations,
    addSlot: addSlot, removeSlot: removeSlot, assignVolunteer: assignVolunteer, removeClaim: removeClaim,
    createSlot: createSlot, deleteOwnSlot: deleteOwnSlot, raiseSOS: raiseSOS,
    getSetting: getSetting, setSetting: setSetting,
    // incidents
    incidents: incidents, incidentById: incidentById, addIncident: addIncident, updateIncident: updateIncident,
    // pins
    pins: pins, addPin: addPin, removePin: removePin,
    // notifications
    pushNotif: pushNotif, notificationsFor: notificationsFor, unreadCount: unreadCount, markAllRead: markAllRead,
    messages: messages, sendMessage: sendMessage, unreadChatCount: unreadChatCount, markChatSeen: markChatSeen,
    // misc
    zoneOfCoords: zoneOfCoords, incidentsCSV: incidentsCSV, resetDemo: resetDemo,
    // helpers
    fmtDate: fmtDate, fmtTime: fmtTime, fmtDateTime: fmtDateTime, timeAgo: timeAgo, slotStartISO: slotStartISO, todayISO: todayISO
  };
})();
