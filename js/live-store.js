/* ============================================================
   AMAN PATROL — live data layer (Supabase)
   ------------------------------------------------------------
   Replaces the localStorage demo store (js/store.js) with the
   same API backed by the coordinator's Supabase project, so no
   screen or component has to change.

   How it works:
   - window.AmanStore is re-pointed here at load time when
     js/config.js has a project AND the Supabase client library
     is present. Add ?demo=1 to the page URL to keep the demo.
   - Reads are served SYNCHRONOUSLY from an in-memory cache that
     is loaded during boot() and refreshed by Supabase Realtime
     (notifications, roster, claims) — the app re-renders through
     the onChange hook.
   - Writes are optimistic: they update the cache and return
     immediately, then sync in the background. Failures surface
     as a toast and the cache is re-fetched from the server.
   - login() and register() return Promises (the only async
     entry points the app awaits explicitly).
   - Privacy: volunteers see first name + surname initial of
     other volunteers (the volunteer_public view). Full details
     stay coordinator-only, exactly like the RLS policies.
   ============================================================ */
(function () {
  var cfg = window.AMAN_SUPABASE;
  if (!cfg || !cfg.url || !cfg.anonKey) return;
  if (typeof window.supabase === "undefined" || !window.supabase.createClient) return;
  if (/[?&#]demo(=1)?([&#]|$)/.test(window.location.search + window.location.hash)) return;

  var Demo = window.AmanStore; // demo store: reused for pure helpers
  var sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  /* ---------------- state cache ---------------- */
  var me = null;                 // my profiles row
  var users = [];                // full profiles (coordinator: everyone; volunteer: just me)
  var volMap = {};               // id -> { first_name, surname } from volunteer_public
  var slots = [];
  var claims = [];
  var notifs = [];               // mapped rows (demo shape)
  var readIds = {};              // notification_id -> true (mine)
  var incidents = [];
  var pins = [];
  var settings = {};
  var sosLog = [];
  var listeners = [];
  var booted = false;
  var tmpId = 0;
  var refreshTimers = {};
  var signedCache = {};          // storage path -> { url, exp }

  /* ---------------- tiny helpers ---------------- */
  function notify() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }
  function esc(s) { return String(s == null ? "" : s); }

  function toastUI(msg, kind) {
    try {
      var d = document.createElement("div");
      d.textContent = msg;
      d.setAttribute("style", "position:fixed;left:50%;bottom:78px;transform:translateX(-50%);" +
        "background:#7a1f1f;color:#fff;padding:10px 16px;border-radius:10px;font-size:0.82rem;" +
        "z-index:9999;max-width:88vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35);font-family:inherit");
      if (kind === "ok") d.style.background = "#0e6e5c";
      document.body.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4200);
    } catch (e) { console.warn(msg); }
  }

  function refreshSoon(tag) {
    if (refreshTimers[tag]) clearTimeout(refreshTimers[tag]);
    refreshTimers[tag] = setTimeout(function () {
      refreshTimers[tag] = null;
      refresh(tag);
    }, 1200);
  }

  function refresh(tag) {
    if (!me || me.status !== "approved") { if (tag === "notifications") loadNotifs(); return; }
    if (tag === "notifications") loadNotifs().then(notify, notify);
    else if (tag === "roster") Promise.all([loadSlots(), loadClaims(), loadVolMap()]).then(notify, notify);
    else if (tag === "incidents") loadIncidents().then(notify, notify);
    else if (tag === "users") loadUsers().then(notify, notify);
    else if (tag === "settings") loadSettings().then(notify, notify);
    else if (tag === "pins") loadPins().then(notify, notify);
  }

  function dbError(r, fallback) {
    if (r && r.error) { console.warn("Aman live:", r.error.message); return r.error.message; }
    return fallback || "Could not reach the server. Check your connection and try again.";
  }

  /* ---------------- loaders ---------------- */
  function loadProfile() {
    return sb.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s || !s.user) { me = null; users = []; return null; }
      var uid = s.user.id;
      return sb.from("profiles").select("*").eq("id", uid).maybeSingle().then(function (r) {
        if (r.error || !r.data) { me = null; return null; }
        me = r.data;
        return me;
      });
    });
  }

  function loadUsers() {
    if (!me) { users = []; return Promise.resolve(); }
    if (me.role !== "coordinator") { users = [me]; return Promise.resolve(); }
    return sb.from("profiles").select("*").order("created_at", { ascending: true }).then(function (r) {
      if (!r.error && r.data) users = r.data;
    });
  }

  function loadVolMap() {
    if (!me || me.status !== "approved") { volMap = {}; return Promise.resolve(); }
    return sb.from("volunteer_public").select("id,first_name,surname_initial").then(function (r) {
      volMap = {};
      if (!r.error && r.data) {
        for (var i = 0; i < r.data.length; i++) {
          var v = r.data[i];
          // surname carries the initial WITHOUT the trailing dot, so
          // surname[0] + "." renders like the demo roster.
          volMap[v.id] = { id: v.id, first_name: v.first_name, surname: String(v.surname_initial || "?").replace(/\.$/, "") };
        }
      }
    });
  }

  function loadSlots() {
    if (!me || me.status !== "approved") { slots = []; return Promise.resolve(); }
    return sb.from("patrol_slots").select("*").order("date", { ascending: true }).then(function (r) {
      if (!r.error && r.data) slots = r.data;
    });
  }

  function loadClaims() {
    if (!me || me.status !== "approved") { claims = []; return Promise.resolve(); }
    return sb.from("slot_claims").select("*").then(function (r) {
      if (!r.error && r.data) claims = r.data;
    });
  }

  function loadIncidents() {
    if (!me || me.status !== "approved") { incidents = []; return Promise.resolve(); }
    return sb.from("incidents").select("*").order("created_at", { ascending: false }).limit(200).then(function (r) {
      if (!r.error && r.data) {
        incidents = r.data;
        for (var i = 0; i < incidents.length; i++) resolvePhoto(incidents[i]);
      }
    });
  }

  function loadPins() {
    if (!me || me.status !== "approved") { pins = []; return Promise.resolve(); }
    return sb.from("map_pins").select("*").then(function (r) {
      if (!r.error && r.data) pins = r.data;
    });
  }

  function loadSettings() {
    if (!me || me.status !== "approved") { settings = {}; return Promise.resolve(); }
    return sb.from("settings").select("key,value").then(function (r) {
      settings = {};
      if (!r.error && r.data) for (var i = 0; i < r.data.length; i++) settings[r.data[i].key] = r.data[i].value;
    });
  }

  function loadNotifs() {
    if (!me) { notifs = []; return Promise.resolve(); }
    return sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(200).then(function (r) {
      if (r.error || !r.data) return;
      notifs = [];
      for (var i = 0; i < r.data.length; i++) {
        var n = r.data[i];
        notifs.push({
          id: n.id,
          audience: { type: n.audience, id: n.user_id },
          kind: n.kind, title: n.title, body: n.body || "", link: n.link || null,
          created_at: n.created_at, read_by: readIds[n.id] ? [me.id] : []
        });
      }
      return sb.from("notification_reads").select("notification_id").eq("user_id", me.id).then(function (rr) {
        if (!rr.error && rr.data) {
          readIds = {};
          for (var j = 0; j < rr.data.length; j++) readIds[rr.data[j].notification_id] = true;
          for (var k = 0; k < notifs.length; k++) notifs[k].read_by = readIds[notifs[k].id] ? [me.id] : [];
        }
      });
    });
  }

  function loadSosLog() {
    if (!me || me.status !== "approved") { sosLog = []; return Promise.resolve(); }
    return sb.from("sos_log").select("*").order("created_at", { ascending: false }).limit(50).then(function (r) {
      if (!r.error && r.data) sosLog = r.data;
    });
  }

  function loadAll() {
    var jobs = [loadUsers(), loadVolMap(), loadNotifs()];
    if (me && me.status === "approved") {
      jobs = jobs.concat([loadSlots(), loadClaims(), loadIncidents(), loadPins(), loadSettings(), loadSosLog()]);
    }
    return Promise.all(jobs);
  }

  /* ---------------- photos (private bucket, signed URLs) ---------------- */
  function resolvePhoto(row) {
    var p = row.photo_url;
    if (!p || typeof p !== "string" || p.slice(0, 5) === "data:" || p.slice(0, 4) === "http") return;
    row._photo_path = p;
    var hit = signedCache[p];
    if (hit && hit.exp > Date.now()) { row.photo_url = hit.url; return; }
    sb.storage.from("incident-photos").createSignedUrl(p, 3600).then(function (r) {
      if (r && r.data && r.data.signedUrl) {
        signedCache[p] = { url: r.data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
        if (row._photo_path === p) { row.photo_url = r.data.signedUrl; notify(); }
      }
    });
  }

  function dataUrlToBlob(dataUrl) {
    try { return fetch(dataUrl).then(function (r) { return r.blob(); }); }
    catch (e) { return Promise.resolve(null); }
  }

  function uploadPhoto(dataUrl) {
    return dataUrlToBlob(dataUrl).then(function (blob) {
      if (!blob) return { ok: false };
      var path = me.id + "/" + Date.now() + ".jpg";
      return sb.storage.from("incident-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false })
        .then(function (r) {
          if (r.error) { console.warn("photo upload failed:", r.error.message); return { ok: false }; }
          return { ok: true, path: path };
        });
    });
  }

  /* ---------------- view builders (demo shapes) ---------------- */
  function volLabel(id) {
    if (me && id === me.id) return me;
    if (volMap[id]) return volMap[id];
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return { id: id, first_name: "Volunteer", surname: "?" };
  }

  function claimView(c) {
    var out = {};
    for (var k in c) out[k] = c[k];
    out.user = volLabel(c.user_id);
    out.start_gps = (c.start_gps_lat != null && c.start_gps_lng != null) ? { lat: c.start_gps_lat, lng: c.start_gps_lng } : null;
    out.end_gps = (c.end_gps_lat != null && c.end_gps_lng != null) ? { lat: c.end_gps_lat, lng: c.end_gps_lng } : null;
    return out;
  }

  function slotView(s) {
    var cs = [];
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].slot_id === s.id && claims[i].status !== "cancelled") cs.push(claimView(claims[i]));
    }
    return {
      id: s.id, zone: s.zone, activity_window: s.activity_window, date: s.date,
      time_window: s.time_window, min_required: s.min_required, created_by: s.created_by || null,
      claims: cs, count: cs.length,
      understaffed: cs.length < s.min_required,
      full: cs.length >= s.min_required
    };
  }

  /* ---------------- auth ---------------- */
  function sessionUser() { return me; }

  function login(email, password) {
    email = String(email || "").trim().toLowerCase();
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) {
        var m = res.error.message || "";
        if (/invalid login credentials/i.test(m)) return { ok: false, error: "Incorrect email or password. Please try again." };
        if (/not confirmed/i.test(m)) return { ok: false, error: "Please confirm your email first (check your inbox)." };
        return { ok: false, error: "Could not sign in: " + m };
      }
      return loadProfile().then(function () {
        if (!me) return { ok: false, error: "Signed in, but your profile is missing. Please contact the coordinator." };
        return loadAll().then(function () {
          notify();
          return { ok: true, user: me };
        });
      });
    });
  }

  function logout() {
    me = null; users = []; volMap = {}; slots = []; claims = []; notifs = [];
    readIds = {}; incidents = []; pins = []; settings = {}; sosLog = []; signedCache = {};
    sb.auth.signOut();
    notify();
  }

  function register(data) {
    var email = String(data.email || "").trim().toLowerCase();
    if (!email || !data.password) return Promise.resolve({ ok: false, error: "Email and password are required." });
    return sb.auth.signUp({
      email: email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name, surname: data.surname, whatsapp: data.whatsapp,
          street: data.street, suburb: data.suburb, dob: data.dob,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_number: data.emergency_contact_number
        }
      }
    }).then(function (res) {
      if (res.error) {
        var m = res.error.message || "";
        if (/already registered/i.test(m)) return { ok: false, error: "An account with this email already exists. Please log in instead." };
        if (/password/i.test(m) && /at least/i.test(m)) return { ok: false, error: "Please choose a password of at least 8 characters." };
        return { ok: false, error: "Could not register: " + m };
      }
      if (!res.data || !res.data.session) {
        return { ok: false, error: "Registered, but no session was returned — please log in." };
      }
      return loadProfile().then(function () {
        if (!me) return { ok: false, error: "Registered, but your profile could not be created. Please contact the coordinator." };
        return loadAll().then(function () { notify(); return { ok: true, user: me }; });
      });
    });
  }

  /* ---------------- users (coordinator) ---------------- */
  function listUsers() { return users.slice(); }
  function userById(id) {
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return volMap[id] || null;
  }
  function userLabel(id) {
    var u = userById(id);
    return u ? u.first_name + " " + u.surname : "Unknown";
  }

  function approveUser(id) {
    for (var i = 0; i < users.length; i++) if (users[i].id === id) users[i].status = "approved";
    notify();
    sb.from("profiles").update({ status: "approved" }).eq("id", id).then(function (r) {
      if (r.error) { toastUI("Could not approve: " + r.error.message); refreshSoon("users"); return; }
      var u = userById(id);
      pushNotif({
        audience: { type: "user", id: id }, kind: "ok", title: "Your registration was approved",
        body: "Welcome to Aman Patrol, " + (u ? u.first_name : "volunteer") + ". You can now claim patrol slots. Remember: observe and report only — never patrol alone."
      });
      refreshSoon("users"); refreshSoon("roster");
    });
  }

  function declineUser(id) {
    for (var i = 0; i < users.length; i++) if (users[i].id === id) users[i].status = "declined";
    notify();
    sb.from("profiles").update({ status: "declined" }).eq("id", id).then(function (r) {
      if (r.error) { toastUI("Could not decline: " + r.error.message); }
      refreshSoon("users");
    });
  }

  /* ---------------- patrol slots ---------------- */
  function listSlots() {
    return slots.slice().map(slotView).sort(function (a, b) {
      return Demo.slotStartISO(a) - Demo.slotStartISO(b);
    });
  }
  function slotById(id) {
    for (var i = 0; i < slots.length; i++) if (String(slots[i].id) === String(id)) return slotView(slots[i]);
    return null;
  }

  function createSlot(data) {
    if (!me) return { ok: false, error: "You are not signed in." };
    if (!data || !data.date) return { ok: false, error: "Choose a date." };
    if (data.date < Demo.todayISO()) return { ok: false, error: "Choose today or a future date." };
    if (!data.start_time || !data.end_time) return { ok: false, error: "Choose a start and an end time." };
    if (String(data.end_time) <= String(data.start_time)) return { ok: false, error: "The end time must be after the start time." };
    var temp = {
      id: "tmp-s-" + (++tmpId), zone: null, activity_window: "Volunteer patrol",
      date: data.date, time_window: data.start_time + "\u2013" + data.end_time,
      min_required: 2, created_by: me.id
    };
    slots.push(temp);
    notify();
    var done = sb.from("patrol_slots").insert({
      zone: null, activity_window: temp.activity_window, date: temp.date,
      time_window: temp.time_window, min_required: temp.min_required, created_by: me.id
    }).select().single().then(function (r) {
      slots = slots.filter(function (s) { return s.id !== temp.id; });
      if (r.error) {
        toastUI("Could not create the slot: " + dbError(r));
        notify();
        return;
      }
      slots.push(r.data);
      var claim = { slot_id: r.data.id, user_id: me.id, status: "claimed" };
      return sb.from("slot_claims").insert(claim).then(function () {
        pushNotif({
          audience: { type: "all" }, kind: "info", title: "New patrol slot on the roster",
          body: me.first_name + " scheduled a patrol on " + Demo.fmtDate(r.data.date) + ", " + r.data.time_window + ". One more volunteer is needed to make a pair."
        });
        refreshSoon("roster");
      });
    });
    return { ok: true, slot: slotView(temp), done: done };
  }

  function deleteOwnSlot(slotId, userId) {
    var before = slots.slice();
    slots = slots.filter(function (s) { return String(s.id) !== String(slotId); });
    claims = claims.filter(function (c) { return String(c.slot_id) !== String(slotId); });
    notify();
    sb.from("patrol_slots").delete().eq("id", slotId).then(function (r) {
      if (r.error) {
        toastUI("Could not delete — another volunteer may have joined. Refreshing.");
        slots = before;
        refreshSoon("roster");
      } else {
        refreshSoon("roster");
      }
    });
    return { ok: true };
  }

  function claimSlot(slotId, userId) {
    for (var i = 0; i < claims.length; i++) {
      if (String(claims[i].slot_id) === String(slotId) && claims[i].user_id === userId && claims[i].status !== "cancelled")
        return { ok: false, error: "You have already claimed this slot." };
    }
    var slot = null;
    for (var j = 0; j < slots.length; j++) if (String(slots[j].id) === String(slotId)) slot = slots[j];
    if (!slot) return { ok: false, error: "Slot not found." };
    var view = slotView(slot);
    if (view.count >= view.min_required) return { ok: false, error: "This slot already has a full pair." };
    claims.push({ id: "tmp-c-" + (++tmpId), slot_id: slot.id, user_id: userId, status: "claimed", start_shift_time: null, end_shift_time: null, start_gps_lat: null, start_gps_lng: null, end_gps_lat: null, end_gps_lng: null, created_at: new Date().toISOString() });
    notify();
    sb.from("slot_claims").insert({ slot_id: slot.id, user_id: userId, status: "claimed" }).then(function (r) {
      if (r.error) {
        toastUI("Could not join — the slot may have just filled up. Refreshing.");
        refreshSoon("roster");
        return;
      }
      var after = slotView(slot);
      var where = slot.zone ? " (" + slot.zone + ")" : "";
      if (after.understaffed) {
        pushNotif({ audience: { type: "all" }, kind: "warn", title: "A patrol slot is understaffed", body: Demo.fmtDate(slot.date) + " " + slot.time_window.split("\u2013")[0] + " — " + slot.activity_window + where + " needs one more volunteer." });
      } else {
        pushNotif({ audience: { type: "all" }, kind: "ok", title: "Patrol slot fully staffed", body: slot.activity_window + " on " + Demo.fmtDate(slot.date) + where + " now has a full pair. Barakallahu feekum." });
      }
      refreshSoon("roster");
    });
    return { ok: true };
  }

  function unclaim(slotId, userId) {
    var mine = null;
    for (var i = 0; i < claims.length; i++) {
      if (String(claims[i].slot_id) === String(slotId) && claims[i].user_id === userId) mine = claims[i];
    }
    if (!mine) return { ok: false, error: "You are not signed up for this slot." };
    if (mine.status === "started") return { ok: false, error: "Cannot leave a shift that has already started — contact the coordinator." };
    claims = claims.filter(function (c) { return c !== mine; });
    notify();
    if (String(mine.id).indexOf("tmp-") !== 0) {
      sb.from("slot_claims").delete().eq("id", mine.id).then(function (r) {
        if (r.error) { toastUI("Could not leave the slot: " + dbError(r)); refreshSoon("roster"); }
        else refreshSoon("roster");
      });
    }
    return { ok: true };
  }

  function myClaims(userId) {
    var out = [];
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].user_id !== userId) continue;
      var c = claimView(claims[i]);
      c.slot = slotById(c.slot_id) || null;
      if (c.slot) c.slot = rawSlot(c.slot_id);
      out.push(c);
    }
    return out.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function rawSlot(id) {
    for (var i = 0; i < slots.length; i++) if (String(slots[i].id) === String(id)) return slots[i];
    return null;
  }
  function myClaimFor(slotId, userId) {
    var list = myClaims(userId);
    for (var i = 0; i < list.length; i++) if (String(list[i].slot_id) === String(slotId)) return list[i];
    return null;
  }

  function startShift(slotId, userId, gps) {
    var c = myClaimFor(slotId, userId);
    if (!c) return { ok: false, error: "Claim this slot first." };
    if (c.status === "started") return { ok: false, error: "Shift already started." };
    if (c.status === "completed") return { ok: false, error: "This shift is already completed." };
    var now = new Date().toISOString();
    c.status = "started"; c.start_shift_time = now; c.start_gps = gps;
    notify();
    if (String(c.id).indexOf("tmp-") !== 0) {
      sb.from("slot_claims").update({
        status: "started", start_shift_time: now,
        start_gps_lat: gps ? gps.lat : null, start_gps_lng: gps ? gps.lng : null
      }).eq("id", c.id).then(function (r) { if (r.error) toastUI("Could not record shift start: " + dbError(r)); });
    }
    return { ok: true, start_shift_time: now };
  }

  function endShift(slotId, userId, gps) {
    var c = myClaimFor(slotId, userId);
    if (!c || c.status !== "started") return { ok: false, error: "Start the shift first." };
    var now = new Date().toISOString();
    c.status = "completed"; c.end_shift_time = now; c.end_gps = gps;
    notify();
    if (String(c.id).indexOf("tmp-") !== 0) {
      sb.from("slot_claims").update({
        status: "completed", end_shift_time: now,
        end_gps_lat: gps ? gps.lat : null, end_gps_lng: gps ? gps.lng : null
      }).eq("id", c.id).then(function (r) { if (r.error) toastUI("Could not record shift end: " + dbError(r)); });
    }
    return { ok: true, end_shift_time: now };
  }

  function completedShifts() {
    var out = [];
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].status !== "completed") continue;
      var c = claimView(claims[i]);
      c.slot = rawSlot(c.slot_id);
      out.push(c);
    }
    return out.sort(function (a, b) { return new Date(b.end_shift_time || 0) - new Date(a.end_shift_time || 0); });
  }

  /* coordinator roster tools */
  function addSlot(data) {
    var temp = {
      id: "tmp-s-" + (++tmpId), zone: data.zone, activity_window: data.activity_window,
      date: data.date, time_window: data.time_window, min_required: data.min_required || 2, created_by: me.id
    };
    slots.push(temp);
    notify();
    sb.from("patrol_slots").insert({
      zone: data.zone, activity_window: data.activity_window, date: data.date,
      time_window: data.time_window, min_required: data.min_required || 2, created_by: me.id
    }).select().single().then(function (r) {
      slots = slots.filter(function (s) { return s.id !== temp.id; });
      if (r.error) { toastUI("Could not add slot: " + dbError(r)); }
      else { slots.push(r.data); refreshSoon("roster"); }
      notify();
    });
    return temp;
  }
  function removeSlot(id) {
    var before = slots.slice();
    slots = slots.filter(function (s) { return String(s.id) !== String(id); });
    claims = claims.filter(function (c) { return String(c.slot_id) !== String(id); });
    notify();
    sb.from("patrol_slots").delete().eq("id", id).then(function (r) {
      if (r.error) { slots = before; toastUI("Could not remove slot: " + dbError(r)); }
      notify();
    });
  }
  function assignVolunteer(slotId, userId) { return claimSlot(slotId, userId); }
  function removeClaim(claimId) {
    var before = claims.slice();
    claims = claims.filter(function (c) { return String(c.id) !== String(claimId); });
    notify();
    sb.from("slot_claims").delete().eq("id", claimId).then(function (r) {
      if (r.error) { claims = before; toastUI("Could not remove: " + dbError(r)); }
      else refreshSoon("roster");
      notify();
    });
  }

  /* ---------------- SOS ---------------- */
  function raiseSOS(userId, gps) {
    if (!me) return { ok: false, error: "You are not signed in." };
    var onDuty = 0;
    for (var i = 0; i < claims.length; i++) {
      if (claims[i].status === "started" && claims[i].user_id !== userId) onDuty++;
    }
    var rec = { id: "tmp-sos-" + (++tmpId), user_id: userId, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy || null, created_at: new Date().toISOString() };
    sosLog.unshift(rec);
    if (sosLog.length > 50) sosLog.length = 50;
    var maps = "https://www.google.com/maps/dir/?api=1&destination=" + gps.lat + "," + gps.lng;
    pushNotif({
      audience: { type: "all" }, kind: "sos", link: maps,
      title: "SOS — " + me.first_name + " needs help",
      body: me.first_name + " " + (me.surname || "?").charAt(0) + ". sent an SOS at " + Demo.fmtTime(rec.created_at) +
        " (GPS " + Number(gps.lat).toFixed(5) + ", " + Number(gps.lng).toFixed(5) + "). " +
        (onDuty
          ? onDuty + " patroller" + (onDuty > 1 ? "s are" : " is") + " on duty — please respond and route to the position."
          : "No patrollers are on duty right now — coordinator, please arrange armed response and check on them.") +
        " Use the route button to navigate there."
    });
    notify();
    sb.from("sos_log").insert({ user_id: userId, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy || null })
      .then(function (r) { if (r.error) toastUI("Warning: the SOS could not be saved to the log — it was still sent to the team."); });
    return { ok: true, sos: rec, on_duty: onDuty };
  }

  /* ---------------- settings ---------------- */
  function getSetting(key) { return settings[key] || ""; }
  function setSetting(key, value) {
    if (!me) return;
    settings[key] = String(value || "");
    notify();
    sb.from("settings").upsert({ key: key, value: String(value || ""), updated_by: me.id })
      .then(function (r) { if (r.error) toastUI("Could not save setting: " + dbError(r)); });
  }

  /* ---------------- incidents ---------------- */
  function listIncidents() { return incidents.slice(); }
  function incidentById(id) {
    for (var i = 0; i < incidents.length; i++) if (String(incidents[i].id) === String(id)) return incidents[i];
    return null;
  }

  function addIncident(data) {
    if (!me) return { ok: false, error: "You are not signed in." };
    var zone = data.zone || Demo.zoneOfCoords(data.gps_lat, data.gps_lng);
    var temp = {
      id: "tmp-i-" + (++tmpId), user_id: data.user_id, category: data.category, status: "Logged",
      gps_lat: data.gps_lat, gps_lng: data.gps_lng, zone: zone,
      location_address: data.location_address || "", description: data.description || "",
      photo_url: data.photo_url || null,
      responder_type: data.responder_type || "None yet", responder_name: data.responder_name || "",
      vehicle_reg: data.vehicle_reg || "", call_sign: data.call_sign || "",
      contact_details: data.contact_details || "", arrival_time: data.arrival_time || null, outcome: data.outcome || "",
      fields: data.fields || {}, created_at: new Date().toISOString()
    };
    incidents.unshift(temp);
    notify();
    var done = Promise.resolve(null).then(function () {
      if (!data.photo_url || String(data.photo_url).slice(0, 5) !== "data:") return { path: null };
      return uploadPhoto(data.photo_url);
    }).then(function (up) {
      var row = {
        user_id: temp.user_id, category: temp.category, status: "Logged",
        gps_lat: temp.gps_lat, gps_lng: temp.gps_lng, zone: zone,
        location_address: temp.location_address, description: temp.description,
        photo_url: (up && up.ok) ? up.path : null,
        responder_type: temp.responder_type, responder_name: temp.responder_name,
        vehicle_reg: temp.vehicle_reg, call_sign: temp.call_sign,
        contact_details: temp.contact_details, arrival_time: temp.arrival_time, outcome: temp.outcome,
        fields: temp.fields
      };
      if (data.photo_url && (!up || !up.ok)) toastUI("The photo could not be uploaded — the report was still sent.", "ok");
      return sb.from("incidents").insert(row).select().single().then(function (r) {
        incidents = incidents.filter(function (x) { return x.id !== temp.id; });
        if (r.error) { toastUI("Could not send the report: " + dbError(r)); notify(); return { ok: false }; }
        incidents.unshift(r.data);
        resolvePhoto(r.data);
        notify();
        pushNotif({
          audience: { type: "all" }, kind: "danger", title: "New incident logged in " + zone,
          body: temp.category + " reported by " + me.first_name + (temp.location_address ? " — " + temp.location_address : ".") + " Coordinator to acknowledge."
        });
        return { ok: true };
      });
    });
    return { ok: true, incident: temp, done: done };
  }

  function updateIncident(id, patch) {
    var inc = incidentById(id);
    if (!inc) return;
    var clean = {};
    for (var k in patch) if (patch.hasOwnProperty(k) && ["status", "responder_type", "responder_name", "vehicle_reg", "call_sign", "contact_details", "arrival_time", "outcome"].indexOf(k) >= 0) clean[k] = patch[k];
    var prevStatus = inc.status;
    for (var k2 in clean) inc[k2] = clean[k2];
    notify();
    if (String(id).indexOf("tmp-") === 0) return; // still being created; skip
    sb.from("incidents").update(clean).eq("id", id).then(function (r) {
      if (r.error) { toastUI("Could not update incident: " + dbError(r)); refreshSoon("incidents"); return; }
      if (clean.status && clean.status !== prevStatus) {
        pushNotif({
          audience: { type: "user", id: inc.user_id }, kind: clean.status === "Resolved" ? "ok" : "info",
          title: "Incident status updated: " + clean.status,
          body: "Your " + inc.category + " report has been marked \"" + clean.status + "\"."
        });
      }
      refreshSoon("incidents");
    });
  }

  /* ---------------- map pins ---------------- */
  function listPins() { return pins.slice(); }
  function addPin(pin) {
    if (!me) return null;
    var p = { id: "tmp-p-" + (++tmpId), label: pin.label, type: pin.type, lat: pin.lat, lng: pin.lng, created_by: me.id, created_at: new Date().toISOString() };
    pins.push(p);
    notify();
    sb.from("map_pins").insert({ label: pin.label, type: pin.type, lat: pin.lat, lng: pin.lng, created_by: me.id })
      .select().single().then(function (r) {
        pins = pins.filter(function (x) { return x.id !== p.id; });
        if (r.error) toastUI("Could not add pin: " + dbError(r));
        else pins.push(r.data);
        notify();
      });
    return p;
  }
  function removePin(id) {
    var before = pins.slice();
    pins = pins.filter(function (p) { return String(p.id) !== String(id); });
    notify();
    sb.from("map_pins").delete().eq("id", id).then(function (r) {
      if (r.error) { pins = before; toastUI("Could not remove pin: " + dbError(r)); notify(); }
    });
  }

  /* ---------------- notifications ---------------- */
  function pushNotif(n) {
    var kind = n.kind || "info";
    if (kind === "danger" && (!me || me.role !== "coordinator")) kind = "warn"; // RLS: volunteers post info/ok/warn/sos
    var aud = n.audience || { type: "all" };
    var optimistic = {
      id: "tmp-n-" + (++tmpId), audience: aud, kind: kind,
      title: n.title, body: n.body || "", link: n.link || null,
      created_at: new Date().toISOString(), read_by: []
    };
    notifs.unshift(optimistic);
    sb.from("notifications").insert({
      audience: aud.type, user_id: aud.type === "user" ? aud.id : null,
      kind: kind, title: n.title, body: n.body || "", link: n.link || null
    }).then(function (r) {
      if (r.error) console.warn("notif not saved:", r.error.message);
      refreshSoon("notifications");
    });
  }

  function notifForMe(n, user) {
    if (!user) return false;
    var a = n.audience;
    if (a.type === "user") return a.id === user.id;
    if (a.type === "coordinator") return user.role === "coordinator";
    return true;
  }
  function notificationsFor(user) {
    return notifs.filter(function (n) { return notifForMe(n, user); })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function unreadCount(user) {
    return notificationsFor(user).filter(function (n) { return n.read_by.indexOf(user.id) === -1; }).length;
  }
  function markAllRead(user) {
    var inserts = [];
    notificationsFor(user).forEach(function (n) {
      if (n.read_by.indexOf(user.id) === -1 && String(n.id).indexOf("tmp-") !== 0) {
        n.read_by = [user.id];
        inserts.push({ notification_id: n.id, user_id: user.id });
      }
    });
    notify();
    if (inserts.length) {
      sb.from("notification_reads").insert(inserts).then(function (r) { if (r.error) console.warn("read state not saved:", r.error.message); });
    }
  }

  /* ---------------- CSV export ---------------- */
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    var s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function incidentsCSV() {
    var rows = [["ID", "Logged at", "Category", "Status", "Zone", "Latitude", "Longitude", "Location", "Description", "Responder type", "Responder name", "Vehicle reg", "Call sign", "Contact details", "Arrival time", "Outcome", "Reported by", "Detail fields"]];
    listIncidents().forEach(function (i) {
      rows.push([
        i.id, Demo.fmtDateTime(i.created_at), i.category, i.status, i.zone || "", i.gps_lat, i.gps_lng,
        i.location_address, i.description, i.responder_type, i.responder_name, i.vehicle_reg,
        i.call_sign, i.contact_details, i.arrival_time ? Demo.fmtDateTime(i.arrival_time) : "", i.outcome,
        userLabel(i.user_id), JSON.stringify(i.fields)
      ]);
    });
    return rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n");
  }

  /* ---------------- boot, realtime, export ---------------- */
  var booted = false;
  function boot() {
    if (booted) return Promise.resolve();
    booted = true;
    var timeout = new Promise(function (res) { setTimeout(res, 12000); });
    var ready = loadProfile().then(function () { return loadAll(); }).then(function () {
      subscribeRealtime();
      sb.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT") { logout(); }
      });
      notify();
    });
    return Promise.race([ready, timeout]);
  }

  function subscribeRealtime() {
    try {
      sb.channel("aman-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, function () { refreshSoon("notifications"); })
        .on("postgres_changes", { event: "*", schema: "public", table: "patrol_slots" }, function () { refreshSoon("roster"); })
        .on("postgres_changes", { event: "*", schema: "public", table: "slot_claims" }, function () { refreshSoon("roster"); })
        .subscribe(function (status) {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // realtime failed; fall back to periodic polling
            if (!subscribeRealtime._poll) {
              subscribeRealtime._poll = setInterval(function () {
                refreshSoon("notifications"); refreshSoon("roster");
              }, 30000);
            }
          }
        });
    } catch (e) { console.warn("realtime unavailable", e); }
  }

  window.AmanStore = {
    live: true,
    mode: "live",
    persistent: true,
    boot: boot,
    onChange: function (fn) { listeners.push(fn); },
    ZONES: Demo.ZONES,
    WINDOWS: Demo.WINDOWS,
    // auth
    sessionUser: sessionUser, login: login, logout: logout, register: register, ageFromDob: Demo.ageFromDob,
    // users
    users: listUsers, userById: userById, userLabel: userLabel, approveUser: approveUser, declineUser: declineUser,
    // slots & claims
    slots: listSlots, slotById: slotById, claimSlot: claimSlot, unclaim: unclaim, myClaims: myClaims,
    myClaimFor: myClaimFor, startShift: startShift, endShift: endShift, completedShifts: completedShifts,
    addSlot: addSlot, removeSlot: removeSlot, assignVolunteer: assignVolunteer, removeClaim: removeClaim,
    createSlot: createSlot, deleteOwnSlot: deleteOwnSlot, raiseSOS: raiseSOS,
    getSetting: getSetting, setSetting: setSetting,
    // incidents
    incidents: listIncidents, incidentById: incidentById, addIncident: addIncident, updateIncident: updateIncident,
    // pins
    pins: listPins, addPin: addPin, removePin: removePin,
    // notifications
    pushNotif: pushNotif, notificationsFor: notificationsFor, unreadCount: unreadCount, markAllRead: markAllRead,
    // misc
    zoneOfCoords: Demo.zoneOfCoords, incidentsCSV: incidentsCSV, resetDemo: function () {},
    // helpers
    fmtDate: Demo.fmtDate, fmtTime: Demo.fmtTime, fmtDateTime: Demo.fmtDateTime, timeAgo: Demo.timeAgo,
    slotStartISO: Demo.slotStartISO, todayISO: Demo.todayISO
  };
})();
