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

**Open the live site: <https://mia-za.github.io/aman-patrol/>**

Prefer to run it yourself? Either:

- double-click `index.html` — the whole app is embedded in that one file, or
- serve this repository folder with any static server, e.g.
  `python3 -m http.server 8000` then open `http://localhost:8000`.

Street map tiles and live weather need internet; every screen still works
offline.

### Demo accounts (password for all: `demo1234`)

| Account | Email | What you see |
|---|---|---|
| Coordinator | `coordinator@demo.co.za` | Approvals, all volunteers, roster management, incident statuses, reports + CSV export |
| Volunteer (approved) | `aisha@demo.co.za` | Dashboard, roster, START/END shift, log incidents, map, notifications |
| Volunteer (approved) | `mo@demo.co.za` | Same as Aisha |
| Volunteer (pending) | `pending@demo.co.za` | The "under review" screen a new applicant sees |

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
3. **Home dashboard** — greeting, the **dua for safety card** (see
   *Duas in the app* below), live weather tile with rain/wind warnings,
   my-next-shift card, big buttons: Log an Incident, **SOS (hold 3 seconds)**,
   Create or Join a Patrol, Area Map, Notifications, Patrol Radio
   (Zello placeholder).
4. **Patrol calendar (roster)** — volunteers create their own patrol slots:
   pick any date on the calendar, choose start and end times, and the slot
   opens as "1 of 2" until a second volunteer joins — patrols always run in
   pairs. **START SHIFT / END SHIFT** capture GPS + time for the official
   shift log; START shows the authentic dua for leaving the home and END
   shows the dua of gratitude. The creator can delete a slot while nobody
   else has joined it.
5. **Log an incident** — auto GPS + time, VOI/POI/SOI categories with their
   exact field sets, photo upload with victim/minor consent checkbox, and the
   response & handover record (SAPS/armed response details, no case numbers).
6. **Area map** — Leaflet + OSM, all real layers shown at once (masjids,
   schools, parks, businesses, police, main roads, intersections) plus
   coordinator custom pins (dark spots, risk corners, madrassah corridors)
   and recent incidents. Coordinator adds pins with the pin button on the map.
7. **Notifications** — in-app feed + browser notifications; approvals,
   15-minute shift reminders, new and understaffed patrol slots, incidents,
   **SOS alerts with a one-tap Google Maps route to the patroller in
   trouble** (works on Android and iPhone), and coordinator announcements
   (announcements can only be sent by the coordinator).
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
index.html            THE APP — complete single-file build (everything embedded;
                      this is the page GitHub Pages serves)
multi-file.html       the same app split into the files below (for development)
css/styles.css        design system (navy/teal, mobile-first)
css/leaflet.css       Leaflet map styles (local copy)
css/images/           small icon files that ship with the Leaflet map library
js/lib/leaflet.js     Leaflet map library (local copy, no CDN needed)
js/app.js             router, shell, register/login/dashboard/roster/notifications,
                      icon set and duas
js/admin.js           coordinator dashboard
js/incident.js        VOI / POI / SOI reporting
js/map.js             area map: OSM layers + custom pins + incidents
js/data.js            area data snapshot — REAL OpenStreetMap data (auto-generated)
js/store.js           demo data layer (localStorage) — mirrors the Supabase tables
js/weather.js         Open-Meteo live weather
images/logo.png       the Aman logo (also embedded inline in the app)
images/favicon.png    app icon file (also embedded inline)
images/designarena_image_cbaeo2tp.png   original full-size logo artwork
supabase/schema.sql   paste-once SQL for the live backend
SUPABASE_SETUP.md     layman's step-by-step Supabase guide
AUDIT.md              pre-Supabase gap audit: findings + Addendum A migration SQL
PUT_ON_GITHUB.md      how this site was put on GitHub Pages (already done)
OPEN_SOURCE_NOTES.md  research: similar open-source projects and what we can learn
tools/sync_index.py   rebuilds index.html from js/* and css/*, then verifies
```

Logo: the provided Aman logo is embedded throughout (header, sign-in
screens, app icon/favicon). Original kept at `images/logo.png`.

## Free hosting on a link

Done — the app is hosted free on GitHub Pages at
<https://mia-za.github.io/aman-patrol/> (served from the `main` branch, root
folder). Volunteers can open it on their phones and add it to their home
screens. **`PUT_ON_GITHUB.md`** documents how it was set up and how to update
the site by hand.

---

## Duas in the app

Aman Patrol opens with authentic words of protection — never invented ones.
Each dua is shown in Arabic, transliteration and English, **with its source**:

- **On the home dashboard (after login)** — the protection dua:
  *Bismillāhilladhī lā yaḍurru maʿasmihī shayʾun fil-arḍi wa lā fis-samāʾ,
  wa huwas-Samīʿul-ʿAlīm* — Sunan Abī Dāwūd 5088 · Jāmiʿ at-Tirmidhī 3388.
  The Prophet ﷻ taught that whoever recites it three times in the morning
  and the evening, nothing will harm them.
- **When starting a patrol shift** — the dua for leaving the home:
  *Bismillāhi tawakkaltu ʿalallāh, wa lā ḥawla wa lā quwwata illā billāh* —
  Sunan Abī Dāwūd 5095 · Jāmiʿ at-Tirmidhī 3426.
- **When finishing a patrol shift (END SHIFT)** — the dua of gratitude:
  *Alhamdulillāhil-ladhī bi-niʿmatihi tatimmuṣ-ṣāliḥāt* — Sunan Ibn Mājah
  3803, graded ḥasan by Shaykh al-Albānī. The Prophet ﷺ would say it
  whenever he saw or completed something good.

---

## Design notes

- All interface icons are clean, professional inline SVG line icons
  (Feather/Lucide style) — no emoji anywhere in the app.
- Deep navy (#13294b) primary, teal (#0e9f9f) accent, white cards, large tap
  targets, phone-first.
- Day and night themes: the sun/moon button in the header (and on the login
  and register screens) switches instantly, remembers the choice on the
  device, and follows the phone's system setting by default. Night mode
  dims the map tiles for patrols after Maghrib.

---

## Rules built into the app

- Observe and report only — no weapons, confrontation, or vigilante features.
- Patrol in pairs — every slot shows understaffed until 2 volunteers sign up.
- Volunteers never see other volunteers' DOB, address, WhatsApp, or emergency
  contacts — coordinator only.
- No photos of victims or minors — enforced with a required consent checkbox.
- No invented place names — every map feature is real OpenStreetMap data or a
  coordinator-confirmed pin.
- No invented duas — every dua shown is authentic, with its hadith source
  displayed.

Map data © OpenStreetMap contributors (ODbL) · Weather: Open-Meteo ·
Built for the community, with barakah.
