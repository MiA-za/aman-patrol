# Aman Patrol — Pre-Supabase Gap Audit

**Date:** 3 October 2026
**Scope:** the app in this repository (commit `621d38b`) measured against `supabase/schema.sql`, plus a security and privacy review of the frontend code.
**Audience:** the frontend developer who will connect this app to Supabase.
**Method:** every write path in `js/store.js` was traced to its target table and compared, column by column and policy by policy, with `supabase/schema.sql`; the UI code (`app.js`, `admin.js`, `incident.js`, `map.js`) was spot-checked for XSS and injection; the dependency set and the two-build parity were verified with the new `tools/sync_index.py`.

---

## 1. Verdict

The app is demo-complete and internally consistent: both builds (`index.html` and `multi-file.html`) are byte-equivalent, syntax-checked, and free of emoji (verified this session with `python3 tools/sync_index.py --check`).

The database schema in `supabase/schema.sql` predates three features that were added afterwards — **volunteer-created roster slots**, the **SOS button**, and the **coordinator-set WhatsApp group link**. As a result there are **7 drift items (C1–C7 below)**: writes the app now makes that the schema would reject, or data the app needs that the schema does not store. All 7 are small, fully understood, and the fix SQL is written out in **Addendum A (section 4)**. Nothing else blocks the connection.

The security posture of the demo is good: consistent HTML escaping, validated external URLs, no third-party script dependencies at runtime, and a privacy-first RLS design already drafted in the schema.

**Bottom line: connect Supabase only after applying Addendum A. With it applied, the schema and the app line up.**

---

## 2. Readiness scorecard

| Area | Status | Detail |
|---|---|---|
| Schema vs app data model | 7 drift items, fix SQL ready | Section 3 + Addendum A |
| Row-level security (RLS) | Solid; 3 additions needed | C1, C5, section 4.8 |
| XSS / injection | No issues found (spot check) | Section 6.1 |
| Auth | Demo-only (plaintext passwords in localStorage) — never migrate them | C7, section 5.1 |
| Realtime (live SOS, roster) | Not connected; publication SQL ready | C2, section 4.7 |
| Offline / push notifications | Known gaps, documented, not blocking | Section 5.3–5.4 |
| Dev workflow (two builds) | Tool included and verified this session | Section 7.2 |
| Docs for handover | Complete | README, SUPABASE_SETUP.md, NEXT_STEPS.md, this file |

---

## 3. Critical gaps (fix at connection time)

### C1 — `patrol_slots`: volunteer-created slots violate three constraints and one policy

The volunteer flow "Create a patrol slot" (`newSlotModal` in `app.js`, `createSlot` in `store.js` around line 426) writes:

- `zone: null` — but the column is `not null` with a check limiting it to the two zones. The new roster model deliberately dropped location, so **zone must become nullable**.
- `activity_window: "Volunteer patrol"` — not in the column's allowed list.
- `created_by: <user id>` — **column does not exist**; the app uses it to show "created by Firstname" on the roster card and to enforce delete rights.
- The insert itself — the only INSERT policy is `coordinator writes slots`, so a volunteer insert is rejected by RLS even if the columns fit.
- Delete: `deleteOwnSlot` (creator may delete their slot while nobody else has joined it) has no matching policy.

The 5 starter slots in the schema are unaffected by the fix (they keep their zone values).

### C2 — `notifications`: no `sos` kind, no `link` column, no realtime

`raiseSOS` (`store.js` ~line 474) sends `kind: "sos"` with a `link` containing a Google Maps route URL. The schema's kind check is `('info','ok','warn','danger')` and there is no `link` column. Live cross-phone SOS delivery additionally needs the table added to the `supabase_realtime` publication.

### C3 — `settings` table missing

The WhatsApp group join link (`getSetting` / `setSetting("whatsapp_group_url", ...)`, coordinator-only) has no home in the schema. A tiny key/value table with coordinator-write, approved-read policies is needed.

### C4 — `sos_log` table missing

The app keeps an SOS audit trail (who, where, when, GPS accuracy, capped at 50 entries). The schema has no such table. Worth keeping for incident review; add with approved-read, own-insert policies.

### C5 — roster names: `slot_claims` select policy hides co-patrollers

Current policy is "read own claims (or coordinator)". But the roster must answer "who would I patrol with?" before a volunteer joins — the app shows names on every slot card. Fix: allow approved volunteers to SELECT all claims, and expose names through a minimal view (`volunteer_public`: first name + surname initial only, approved profiles only). Surname, WhatsApp number, address, DOB and emergency contact stay coordinator-only (Sitr / POPIA).

### C6 — incident photos: demo stores base64 data URLs in localStorage

`compressPhoto` (`incident.js` ~line 212) resizes to max 1000 px and re-encodes JPEG q=0.72, then `addIncident` stores the whole data URL in `photo_url`. Fine for a demo; too heavy for a shared database row and lost on logout/clear. The schema already defines a private `incident-photos` storage bucket with owner/coordinator policies — at connection time, upload the compressed blob there and store the object path in `photo_url`; serve via signed URLs. Consent checkbox already gates submit.

### C7 — auth: demo passwords are plaintext in localStorage

By design for the demo. When connecting Supabase: use Supabase Auth (email + password), never migrate the demo passwords, and keep the pending → approved registration gate via `profiles.status`. The schema's `handle_new_user` and `protect_profile_privileges` triggers already implement profile creation and privilege protection; the coordinator bootstrap SQL is in the comment at the end of `supabase/schema.sql` and in SUPABASE_SETUP.md.

**Verified correct in the schema (no action):** incidents columns/categories/status (jsonb `fields`, `photo_url`), map_pins, `notification_reads` (maps the app's `read_by`), profiles RLS (own row + coordinator), the `is_coordinator()` / `is_approved_volunteer()` helpers, and the private photo bucket policies.

---

## 4. Addendum A — proposed migration SQL

> `supabase/schema.sql` in this repo is intentionally left untouched. This addendum is the delta the schema needs for the current app. Review it with the coordinator, then run it **once, after `schema.sql`**, in Supabase Dashboard → SQL Editor. It is idempotent-safe to re-run.

A copy-paste-ready version of the main block (without the optional hardening) is saved as `supabase/addendum_a.sql`.

```sql
-- ============================================================
--  ADDENDUM A — bring the schema in line with the app
--  (volunteer-created roster slots, SOS, WhatsApp group link)
--  Run AFTER schema.sql. Reviewed 2026-10-03.
-- ============================================================

-- ---------- A1. patrol_slots: volunteer-created slots ----------
alter table public.patrol_slots
  alter column zone drop not null;

alter table public.patrol_slots
  drop constraint if exists patrol_slots_zone_check;
alter table public.patrol_slots
  add constraint patrol_slots_zone_check
  check (zone is null or zone in ('Zone A – Greenside','Zone B – Emmarentia'));
  -- NOTE: those strings contain an EN DASH (–), same as schema.sql and the app.

alter table public.patrol_slots
  drop constraint if exists patrol_slots_activity_window_check;
alter table public.patrol_slots
  add constraint patrol_slots_activity_window_check
  check (activity_window in
    ('Morning patrol','Madrassah drop-off','Afternoon patrol','Jumu''ah',
     'Evening after Maghrib/Isha','Volunteer patrol'));

alter table public.patrol_slots
  add column if not exists created_by uuid
  references public.profiles(id) on delete set null;

create policy "volunteers create slots"
  on public.patrol_slots for insert
  with check (created_by = auth.uid() and public.is_approved_volunteer());

-- creator may delete their own slot while nobody else has an active claim
create policy "creator deletes own empty slot"
  on public.patrol_slots for delete
  using (
    created_by = auth.uid()
    and not exists (
      select 1 from public.slot_claims c
      where c.slot_id = public.patrol_slots.id
        and c.user_id <> auth.uid()
        and c.status <> 'cancelled'
    )
  );

-- ---------- A2. notifications: sos kind + route link ----------
alter table public.notifications
  add column if not exists link text;

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('info','ok','warn','danger','sos'));

-- ---------- A3. settings (coordinator-set app settings) ----------
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

create policy "approved read settings"
  on public.settings for select using (public.is_approved_volunteer());
create policy "coordinator writes settings"
  on public.settings for all
  using (public.is_coordinator()) with check (public.is_coordinator());

insert into public.settings (key, value) values ('whatsapp_group_url', '')
  on conflict (key) do nothing;  -- coordinator fills this in via the app

-- ---------- A4. sos_log (SOS audit trail) ----------
create table if not exists public.sos_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  accuracy   double precision,
  created_at timestamptz not null default now()
);
alter table public.sos_log enable row level security;

create policy "approved read sos log"
  on public.sos_log for select using (public.is_approved_volunteer());
create policy "log own sos"
  on public.sos_log for insert
  with check (user_id = auth.uid() and public.is_approved_volunteer());

-- ---------- A5. roster: who am I patrolling with? ----------
create policy "approved read claims"
  on public.slot_claims for select using (public.is_approved_volunteer());

-- minimal public identity for approved volunteers (first name + initial only)
create or replace view public.volunteer_public
with (security_invoker = on) as
  select p.id,
         p.first_name,
         upper(left(p.surname, 1)) || '.' as surname_initial
  from public.profiles p
  where p.status = 'approved' and public.is_approved_volunteer();
grant select on public.volunteer_public to authenticated;

-- ---------- A6. realtime: live SOS + live roster ----------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.patrol_slots;
alter publication supabase_realtime add table public.slot_claims;

-- ---------- A7. system notifications from volunteers ----------
-- The app also creates roster notifications ("New patrol slot on the
-- roster", "understaffed", "fully staffed"). Quick path: allow approved
-- volunteers to insert non-spoofable kinds. Announcements stay a
-- coordinator privilege in the UI, and the "coordinator announces"
-- policy remains for the coordinator's own posts.
create policy "volunteers post roster updates"
  on public.notifications for insert
  with check (
    public.is_approved_volunteer()
    and kind in ('info','ok','warn','sos')
  );
```

**A7 hardening (recommended before public rollout, optional for the pilot):** move volunteer system notifications server-side with triggers instead of the relaxed policy above, so a compromised client cannot fabricate posts. Sketch for the SOS case, mirroring the app's exact wording (`raiseSOS` in `store.js`):

```sql
create or replace function public.notify_sos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first text; v_init text; v_on_duty int;
begin
  select first_name, upper(left(surname, 1)) into v_first, v_init
    from public.profiles where id = new.user_id;
  select count(*) into v_on_duty from public.slot_claims
    where status = 'started' and user_id <> new.user_id;
  insert into public.notifications (audience, kind, link, title, body)
  values ('all', 'sos',
    'https://www.google.com/maps/dir/?api=1&destination=' || new.lat || ',' || new.lng,
    'SOS — ' || v_first || ' needs help',
    v_first || ' ' || v_init || '. sent an SOS at ' || to_char(new.created_at, 'HH24:MI') ||
    ' (GPS ' || round(new.lat::numeric, 5) || ', ' || round(new.lng::numeric, 5) || '). ' ||
    case when v_on_duty > 0
      then v_on_duty || ' patroller(s) on duty — please respond and route to the position.'
      else 'No patrollers are on duty right now — coordinator, please arrange armed response and check on them.' end ||
    ' Use the route button to navigate there.');
  return new;
end $$;

create trigger sos_notify after insert on public.sos_log
  for each row execute function public.notify_sos();
-- (Same pattern for slot created / claim joined / pair complete.
--  If you adopt triggers, drop the "volunteers post roster updates"
--  policy from A7 so all notification inserts are coordinator-or-trigger.)
```

---

## 5. Important, not blocking (plan, do not block the connection on these)

1. **Auth adapter shape.** Keep the `window.AmanStore` API exactly as-is and re-implement its functions on supabase-js (`store.js` is already a faithful mirror of the tables — that was the point of it). Screens should not change. Map the demo `audience: {type:"all"}` objects to the schema's `audience` text column (`'all' | 'volunteers' | 'coordinator' | 'user'` + `user_id` column).
2. **Realtime subscriptions.** After A6: subscribe to `notifications` (SOS + announcements), `patrol_slots` and `slot_claims` (roster). Re-check permissions on reconnect; the app already re-renders from store queries.
3. **Push when the tab is closed.** In-app feed + browser Notification (while open) only. Web Push via a small service worker, or ntfy, is the next step — see NEXT_STEPS.md section 2.
4. **Offline.** Currently the app needs the network for map tiles, weather and (soon) the database. A service worker cache for the shell and last-known roster is a nice-to-have after the pilot.
5. **Demo mode flag.** Demo accounts, seed data and the "Reset demo data" button must be disabled or clearly separated before real volunteers use the app (a `DEMO_MODE` constant at the top of the store is enough).
6. **Free-tier auto-pause.** Supabase free projects pause after about a week of inactivity — real risk for a small watch group with quiet weeks. Mitigate with a scheduled weekly ping (e.g. a GitHub Action hitting a trivial RPC) or upgrade the tier.
7. **En-dash gotcha (will bite someone).** `time_window` values MUST use the en dash U+2013 (`07:30–08:30`): `slotStartISO` parses shift start times on that character. A developer "fixing" it to a hyphen breaks shift start. Zone strings also contain it (see A1).
8. **Timezone.** Dates are stored as `date` (patrol day) and shift timestamps are `timestamptz`. The app formats in device-local time (SAST for your users). Keep it that way; do not store local-time strings for shift start/end.
9. **Backups.** Incidents CSV export exists in the coordinator dashboard. Schedule a periodic `pg_dump` (Supabase dashboard supports this on paid tiers; on free, a weekly manual export of `incidents` + `sos_log` is prudent).

---

## 6. Security and privacy review (verified this session)

1. **XSS / HTML injection — clean.** All user-supplied strings pass through `esc()` before insertion into HTML. Three flagged spots were examined and are safe: `app.js` ~162 (modal content built from internal, already-escaped parts), `admin.js` ~102 (numeric count interpolated), `incident.js` ~169 (internal constant `CATS`). Discipline to keep: `modal()` takes pre-built HTML, so every dynamic fragment inside it must be escaped at construction.
2. **URL injection — handled.** The WhatsApp group link is validated with `startsWith("http")` on input and escaped in the `href`.
3. **Dependencies.** Leaflet 1.9.4 local copy (current 1.9.x line, no known advisories); no other JS libraries, no CDN at runtime. Runtime network calls: OSM tiles and Open-Meteo weather only. `weather.js` caches for 30 minutes and degrades gracefully on failure.
4. **RLS matrix after Addendum A** (who can read/write what):

   | Table | Volunteers (approved) | Coordinator |
   |---|---|---|
   | profiles | own row only | all rows |
   | volunteer_public (view) | first name + initial of approved volunteers | same |
   | patrol_slots | read all; insert own (`created_by`); delete own empty slot | full |
   | slot_claims | read all; insert/update/delete own | full |
   | incidents | read all; insert own | update/manage |
   | map_pins | read | add/remove |
   | notifications | read relevant; insert system kinds (A7) | read + insert all |
   | notification_reads | insert own | insert own |
   | settings | read | read + write |
   | sos_log | read all; insert own | read all |
   | storage incident-photos | upload own; read own | read all |

5. **POPIA posture.** Personal details (surname, WhatsApp, address, DOB, emergency contact) are coordinator-only by RLS; volunteers see first name + initial only; photos sit in a private bucket behind owner/coordinator policies; incident photos require an explicit consent checkbox; SOS/patrol GPS is operational data shared with the team by design. Recommended before rollout: a one-paragraph privacy notice on the registration screen and a retention decision for `sos_log` and resolved incidents.
6. **Demo credentials.** All demo accounts share password `demo1234` (coordinator@demo.co.za, aisha@demo.co.za, mo@demo.co.za, pending@demo.co.za). These exist only in localStorage seed data; they must never be migrated to Auth.

---

## 7. Frontend handover notes

### 7.1 Architecture map

| File | Responsibility |
|---|---|
| `index.html` | THE APP — single-file build GitHub Pages serves; all js/css embedded |
| `multi-file.html` | same app from the separate files (use for development) |
| `js/app.js` | hash router, shell, login/register/dashboard/roster/notifications, icon set, duas |
| `js/admin.js` | coordinator dashboard (approvals, roster, incidents, announcements, settings) |
| `js/incident.js` | VOI / POI / SOI reporting incl. photo compression |
| `js/map.js` | OSM map, custom pins, incident layer |
| `js/data.js` | area data snapshot (generated from OpenStreetMap) |
| `js/store.js` | data layer — localStorage demo now, Supabase adapter later; mirrors the tables |
| `js/weather.js` | Open-Meteo |
| `js/lib/leaflet.js` | Leaflet 1.9.4 local copy |
| `css/styles.css` | design system |
| `tools/sync_index.py` | rebuilds and verifies `index.html` (see 7.2) |

Globals: `AmanStore` (store.js), `AmanApp` (app.js), `AmanMap`, `AmanIncident`, `AmanAdmin`. State flows store → render functions; the roster/calendar state lives in `app.js`.

### 7.2 The golden rule of this repo

`index.html` embeds every script and style inline, and those embedded blocks must stay identical to `js/*` and `css/styles.css`. **Never hand-edit the inline blocks.** Workflow:

1. Edit `js/*.js` and/or `css/styles.css`.
2. Run `python3 tools/sync_index.py` (rebuilds `index.html` and verifies: parity, `node --check` syntax, no emoji, line-ending conventions).
3. `python3 tools/sync_index.py --check` for verify-only (use it in CI or before every commit).
4. Test `multi-file.html` and `index.html` give identical behaviour.

### 7.3 Quirks worth knowing

- Mixed line endings are intentional and preserved by the tool: CRLF in `app.js, admin.js, incident.js, map.js, styles.css, index.html, README, NEXT_STEPS, OPEN_SOURCE_NOTES, AUDIT`; LF in `store.js, data.js, weather.js, leaflet.js, multi-file.html`. Do not "normalise" the repo.
- En dash in `time_window` (see 5.7) and in zone strings.
- localStorage keys: `aman_patrol_db_v2` (demo database), `aman_patrol_session_v2` (session), `aman-last-email` (login prefill).
- Icons: new icons must be added to the `ICONS` registry in `app.js` — the UI references them by name.
- Duas: the texts and citations in `app.js` are authentic, verified Sunnah (e.g. Ibn Majah 3803). Do not alter wording or attribution.
- Seed data rolls forward (`day_offset`) so the demo always shows upcoming slots; real data will not do this — it is demo-only behaviour.

### 7.4 Suggested connection order

1. Coordinator creates the project (region closest to SA), runs `schema.sql`, then Addendum A.
2. Frontend: add supabase-js, implement the `AmanStore` adapter function by function (auth first, then roster, then notifications, then incidents/photos, then SOS + realtime).
3. Keep the localStorage store behind a flag as the demo/fallback during development.
4. Flip `DEMO_MODE` off, enable GitHub Pages (still pending — see NEXT_STEPS.md), pilot with 2–3 volunteers, then roll out.

---

## 8. Go-live checklist

- [ ] Supabase project created, `schema.sql` run, Addendum A reviewed with coordinator and run
- [ ] First account registered, promoted to coordinator (SQL in SUPABASE_SETUP.md)
- [ ] Frontend adapter complete; demo seed data and demo accounts disabled
- [ ] Coordinator sets the real WhatsApp group link in Settings
- [ ] SOS tested cross-phone (Realtime subscription live)
- [ ] Incident photo upload to the private bucket verified (upload, view via signed URL, consent box)
- [ ] Privacy notice on registration screen; retention decision for sos_log/incidents
- [ ] Backups scheduled; free-tier auto-pause mitigation in place
- [ ] GitHub Pages enabled and the live URL shared with volunteers (see NEXT_STEPS.md)
