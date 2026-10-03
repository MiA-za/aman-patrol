# Next steps — investigations, decisions and gaps

**Written 2026-10-03, after the coordinator's review.** This page records
what was asked, what was built immediately, and what needs a decision or a
setup step before it can go live. Nothing here changes the ground rules:
observe and report only, no weapons, no confrontation, volunteer details
stay coordinator-only.

---

## 1. Roster — volunteers create their own slots (DONE in this update)

**Asked for:** every volunteer creates their own slot — just a date and a
time, no location — and every slot always has 2 patrollers.

**What was built:** the roster is now a **calendar**. Pick any date, tap
*Create patrol*, choose start and end times — you become patroller 1 of 2 and
the slot appears on the calendar (a green dot means the pair is complete, an
amber dot means it still needs a partner) and on everyone's roster for that
day. Any volunteer can tap *Join this patrol* to become patroller 2. The
creator can delete the slot until someone else joins. START SHIFT / END
SHIFT, the duas, GPS capture and the shift log all work exactly as before.
The coordinator can still create slots (for example a Jumu'ah patrol) from
the coordinator dashboard — those appear on the same calendar.

**Why no location in the slot:** patrols cover the whole two-suburb area;
where to meet is agreed on the WhatsApp group. The old Zone A/B seed slots
are kept only as demo data.

---

## 2. Announcements and the WhatsApp group (DONE in this update)

- **Announcements are coordinator-only** — the *Send announcement* button
  only ever appears for the coordinator (this was already true; verified
  again).
- **WhatsApp group link:** the coordinator pastes the group's invite link
  once (Notifications screen, *WhatsApp group link* button — in WhatsApp:
  Group info, then *Invite via link*). Every volunteer then gets a
  *Community WhatsApp group* button on their More screen, and the link is
  offered during an SOS. Nothing is sent to WhatsApp automatically — it just
  opens the group.

---

## 3. Logging in without typing a password (investigation)

**Asked for:** once approved, volunteers should log back in with
fingerprint or face, not a password.

**How it works today (already true):**
- The app **keeps you logged in** on your phone — after your first login you
  stay signed in until you log out. Day-to-day, nobody types a password.
- The login screen now remembers the last email used.
- On both Android and iPhone, the built-in password manager can save the
  password on first login and unlock it with fingerprint/face — that is
  standard browser behaviour, nothing to install.

**What Supabase unlocks (the real answer):** once the app is connected to
Supabase we can switch on **passkeys** — your fingerprint or Face ID *is*
the login, tied to your device, nothing to remember and nothing that can be
phished. Supabase supports passkeys (WebAuthn) and magic links (a one-tap
sign-in link by email) out of the box. Until Supabase is connected there is
no safe place to store credentials (a static website cannot verify a
fingerprint by itself), so: first Supabase, then passkeys. This is listed in
the Supabase plan below as step 4.

---

## 4. Supabase — what the coordinator does, what I build

**Why:** today every phone has its own private demo database (browser
storage). Supabase makes the data shared and real: you register once, the
coordinator approves you once, and everyone sees the same roster, incidents
and SOS alerts — live, on any phone, Android or iPhone.

**Free tier:** yes — the free plan is more than enough for a neighbourhood
watch (500 MB database, 50,000 monthly active users, 2 GB file storage).

**Coordinator's steps (about 15 minutes, no coding):**
1. Create a free account at supabase.com and create a project (choose the
   region closest to South Africa, e.g. Frankfurt or London).
2. Open *SQL Editor*, paste the contents of `supabase/schema.sql` from this
   repo, and run it. This creates the tables (profiles, patrol slots, slot
   claims, incidents, map pins, notifications) with row-level security so
   volunteers can only see what they should.
3. Copy the project URL and the anonymous key from *Settings, API* and keep
   them safe.
4. Tell me the project is created — I then build the connection into the app
   (a settings screen for the URL and key, then syncing, live SOS and
   passkey sign-in in stages, each tested before the next).

**What changes when Supabase is live, in order:**
1. Real accounts and approvals (same screens, shared data).
2. **Live SOS** — Supabase Realtime pushes the alert to every on-duty
   patroller's phone the second it happens (see the SOS section below).
3. Passkeys / fingerprint sign-in.
4. Push notifications to the home screen (via a small free service such as
   ntfy, already researched in OPEN_SOURCE_NOTES.md).

**Privacy:** the schema already keeps volunteer personal details
coordinator-only at the database level, and the data lives in your own
Supabase project — not with us, not with a third-party app.

---

## 5. Push-to-talk (PTT) radio — free and open source

> Update 3 October 2026: in-app TEAM CHAT (text) is now built — a Chat
> tab in the app, live between phones via Supabase Realtime
> (supabase/addendum_b.sql adds the messages table). Voice on shift
> stays on the WhatsApp group. Mumble remains the open-source radio
> upgrade if the team still wants it after the pilot, but it needs its
> own always-on server that Supabase cannot host (see
> OPEN_SOURCE_NOTES.md).

**Asked for:** a free PTT app on GitHub instead of the Zello placeholder.

**What exists (full notes in OPEN_SOURCE_NOTES.md):**
- **Mumble** (BSD licence) is the established open-source Zello alternative:
  channels, push-to-talk, self-hosted server (a few rand a month on a small
  VPS). Honest caveat: the **iPhone client is dated and fiddly** compared to
  Android — for a mixed team that matters.
- **PTT Talk** (github.com/golanbenoni/ptt, AGPLv3) — new, encrypted,
  Android + iOS, but still pre-release. Watch, don't adopt.
- **QR-PTT** (GPLv3) — Mumble-based Android client built for guarding
  patrols; old, Android-only.

**Recommendation:** keep the WhatsApp group as the voice/chat channel for
now (zero setup, works on every phone) and treat Mumble as the upgrade if
the team genuinely wants live radio — with a proper pilot on both Android
and iPhone before committing. This stays a future option with the
coordinator's approval, per the standing rules.

---

## 6. SOS button (DONE in this update — demo-grade, live with Supabase)

**Asked for:** if something happens, a patroller can press SOS and the
others on duty can route straight to them. Everyone is a volunteer; some
phones are Android, some iPhone.

**What was built:**
- A red **SOS button on the dashboard: press and hold for 3 seconds** (a
  progress bar fills; releasing early cancels — no accidental alerts).
- On trigger it captures GPS and alerts the coordinator and every patroller
  **currently on duty**, stating how many are on duty.
- The alert includes a **Route me there** button — a Google Maps directions
  link that opens turn-by-turn navigation on **both Android and iPhone**
  (Google Maps app if installed, otherwise the browser).
- The sender sees a reassurance screen: their position, the time, a
  **Call SAPS 10111** button, the WhatsApp group, and the reminder to get to
  safety — never confront or chase.

**Honest limitation of the demo:** until Supabase is connected, each phone
has its own data, so the alert reaches other phones only once Supabase
Realtime is switched on (step 2 of the Supabase plan). The screens, routing
and flows are all built and ready.

**Safety rules kept:** the SOS calls for help — it never asks anyone to
intervene. Responders route to the position; armed response and SAPS do the
rest.

---

## 7. Gap analysis — what else we found

| Gap | Status | Plan |
| --- | --- | --- |
| Mixed Android + iPhone | OK — the app is a website; it works the same on both, nothing to install. "Add to Home Screen" gives an app icon on both. | Optional later: a small install prompt (PWA manifest). |
| Alerting phones when the app is closed | Gap today — browser notifications only work while the site is open (and on iPhone only when added to the Home Screen, iOS 16.4+). | Solved as part of Supabase step 4 (push via ntfy or Supabase + a web push service). |
| Offline / poor signal | Gap — the app needs a connection to load. | Later: a service worker to cache the app itself; incidents already queue in browser storage. |
| SOS when GPS is off | Handled — falls back to the area centre and says so. | Also add "last known position" once Supabase is live. |
| Data protection (POPIA) | Designed in — volunteer details coordinator-only, consent checkbox for photos of people, no public crime map, POPIA-friendly hosting (your own Supabase project). | Add a short privacy notice for volunteers at registration (draft ready when requested). |
| Hosting cost | Zero — GitHub Pages free tier, custom domain optional (about R100-R200/year if wanted later). | None needed now. |
| Who approves the coordinator? | The first account created in Supabase is the coordinator; a second coordinator can be added as backup. | Decide: who holds the backup coordinator login. |
| App icon / name on the phone | Works via Add to Home Screen; icon already provided. | Optional: proper PWA manifest for a cleaner install screen. |
| Demo data | Clearly labelled; Reset demo data on the More screen. | Remove demo accounts before going live (one small change, kept for last). |

---

## Suggested order of attack

1. **Now:** review this update in the preview (calendar, SOS, WhatsApp link).
2. **You:** enable GitHub Pages (Settings, Pages, main, root) and create the
   Supabase project (steps above) — say when each is done.
3. **Me:** merge this work, verify the live site, then build the Supabase
   connection in stages (accounts, live SOS, passkeys, push). Read AUDIT.md
   first: it lists everything the connection needs, including Addendum A,
   the extra SQL to run after schema.sql.
4. **Together:** pilot Mumble only if the team still wants voice radio after
   using the WhatsApp group with the new link.

---

## 8. Parked Enhancements & Open Source Tools Review

### A. Pre-Shift 15-Second Safety Checklist (Parked for next release)
When starting a shift, display a quick 4-point verification modal:
1. Hi-vis reflective vest on.
2. Torch / flashlight charged and working.
3. Partner is physically present (never patrol alone).
4. WhatsApp check-in sent to the patrol group.

### B. Open Source Tools in Use (Lightweight & High-Value)
- Leaflet.js: Open-source interactive map engine (no Google Maps API fees, runs entirely client-side).
- OpenStreetMap & CartoDB: Community street map data and high-contrast dark night tiles.
- Esri World Imagery: Free, high-resolution satellite aerial imagery overlay for neighbourhood context.
- Open-Meteo API: Zero-key, open-source meteorological and rain forecast service.
- Web Print API & CSS Print Layout: Instant client-side PDF export for coordinator security reports without heavy server dependencies.
