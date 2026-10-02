# Aman Patrol — Greenside & Emmarentia

A mobile-first community neighbourhood watch **operations app** for Greenside
and Emmarentia, Johannesburg. An observe-and-report tool for trained volunteers
who patrol in pairs to protect their streets, their masjids, madrassah
children, and vulnerable residents.

**It is not** a security company, **not** a vigilante tool, **not** a product.
Civic, volunteer, and rooted in:
**Amanah** (trust) · **Sitr** (dignity/privacy) · **Adl** (justice) ·
**Hikmah** (wisdom) · **Rahmah** (mercy).

---

## Try it now (demo — nothing to install)

**Open the live site: <https://mia-za.github.io/aman-patrol/>** 🎉

Prefer to run it yourself? Either:

- double-click `index.html` — the whole app is embedded in that one file, or
- serve this repository folder with any static server, e.g.
  `python3 -m http.server 8000` then open `http://localhost:8000`.

Street map tiles and live weather need internet; every screen still works
offline.

### Demo accounts (password for all: `demo1234`)

| Account | Email | What you see |
|---|---|---|
| 🛡️ Coordinator | `coordinator@demo.co.za` | Approvals, all volunteers, roster management, incident statuses, reports + CSV export |
| 🚶 Volunteer (approved) | `aisha@demo.co.za` | Dashboard, roster, START/END shift, log incidents, map, notifications |
| 🚶 Volunteer (approved) | `mo@demo.co.za` | Same as Aisha |
| ⏳ Volunteer (pending) | `pending@demo.co.za` | The "under review" screen a new applicant sees |

The registration screen is the first thing a new patroller sees — register for
real, then log in as the coordinator to approve yourself.

> Demo data lives **only on that device** (browser localStorage). Two people
> on two phones don't see each other's data — that's what Supabase will add.

---

## What's real vs sample

| Real (live/verified) | Sample (demo) |
|---|---|
| All map layers — masjids, schools, parks, businesses, main roads, intersections — from **OpenStreetMap** via the Overpass API (snapshot 2026-10-02) | The 4 demo accounts, 5 patrol slots, 3 incidents, 3 custom pins |
| Live weather from **Open-Meteo** | Photos you attach stay on the device |
| Street map tiles (OpenStreetMap) | GPS falls back to the zone centre if you deny location access |

**Masjids on the map** (from OpenStreetMap, pending coordinator confirmation):
Greenside Mosque · the Emmarentia Shul building (tagged as a Muslim place of
worship in OSM) · Northcliff Jummah Musjid · Auckland Park Mosque.
Tell me which two serve the area and I'll lock them in as the patrol anchors.

---

## Screens

1. **Registration** — first screen; full details, 18+ and Code of Conduct
   confirmations, pending approval flow.
2. **Login** — email + password (+ one-tap demo accounts).
3. **Home dashboard** — greeting, live weather tile with rain/wind warnings,
   my-next-shift card, big buttons: Log an Incident, Claim a Patrol Slot, Area
   Map, Notifications, Patrol Radio (Zello placeholder).
4. **Patrol roster** — real slots, Zone A/B, patrol windows (Morning patrol,
   Madrassah drop-off, Afternoon patrol, Jumu'ah, Evening after Maghrib/Isha),
   "1 of 2" sign-ups, understaffed labels, **START SHIFT / END SHIFT** with
   GPS + time capture (the official shift log).
5. **Log an incident** — auto GPS + time, VOI/POI/SOI categories with their
   exact field sets, photo upload with victim/minor consent checkbox, and the
   response & handover record (SAPS/armed response details, no case numbers).
6. **Area map** — Leaflet + OSM, all real layers shown at once (masjids,
   schools, parks, businesses, police, main roads, intersections) plus
   coordinator custom pins (dark spots, risk corners, madrassah corridors)
   and recent incidents. Coordinator adds pins with the 📍 button on the map.
7. **Notifications** — in-app feed + browser notifications; approvals,
   15-minute shift reminders, incidents in your zone, understaffed slots,
   coordinator announcements.
8. **Coordinator dashboard** — pending approvals, all volunteers (full
   details, coordinator-only), roster assignment, incident statuses +
   responder records, reports with filters, counts, completed shift log and
   **CSV export**.

---

## Going live with Supabase

Follow **`SUPABASE_SETUP.md`** (written for non-technical users). The SQL in
**`supabase/schema.sql`** creates the five tables — `profiles`,
`patrol_slots`, `slot_claims`, `incidents`, `map_pins` — plus Row Level
Security so volunteers only ever see their own personal data, a private photo
bucket, and starter slots/pins. The demo's data layer (`js/store.js`) is
written to mirror those tables exactly, so connecting Supabase later changes
no screens.

---

## Files

```
images/logo.png       the Aman logo (also embedded inline in the app)
index.html            app shell
css/styles.css        design system (navy/teal, mobile-first)
css/leaflet.css       Leaflet map styles (local copy)
js/lib/leaflet.js     Leaflet map library (local copy, no CDN needed)
js/data.js            area data snapshot — REAL OpenStreetMap data (auto-generated)
js/store.js           demo data layer (localStorage) — mirrors the Supabase tables
js/weather.js         Open-Meteo live weather
js/map.js             area map: OSM layers + custom pins + incidents
js/incident.js        VOI / POI / SOI reporting
js/admin.js           coordinator dashboard
js/app.js             router, shell, register/login/dashboard/roster/notifications
supabase/schema.sql   paste-once SQL for the live backend
SUPABASE_SETUP.md     layman's step-by-step Supabase guide
PUT_ON_GITHUB.md      put the app on GitHub Pages — free hosting + shareable link
```

Logo: the provided Aman logo is embedded throughout (header, sign-in
screens, app icon/favicon). Original kept at `images/logo.png`.

## Free hosting on a link

Follow **`PUT_ON_GITHUB.md`** to put the app on GitHub Pages — a free
shareable link like `https://yourname.github.io/aman-patrol/` that volunteers
can open on their phones and add to their home screens.

---

## Rules built into the app

- Observe and report only — no weapons, confrontation, or vigilante features.
- Patrol in pairs — every slot shows understaffed until 2 volunteers sign up.
- Volunteers never see other volunteers' DOB, address, WhatsApp, or emergency
  contacts — coordinator only.
- No photos of victims or minors — enforced with a required consent checkbox.
- No invented place names — every map feature is real OpenStreetMap data or a
  coordinator-confirmed pin.

Map data © OpenStreetMap contributors (ODbL) · Weather: Open-Meteo ·
Built for the community, with barakah. 🤲
