# Open-source research — similar projects and what we can learn

**Why this document exists:** the coordinator asked for research into free,
open-source GitHub projects that do something similar to Aman Patrol (or do
certain things better), so we can learn from the best of them.

**Ground rule:** nothing on this page gets integrated into Aman Patrol without
the coordinator's explicit approval. These are notes only. Aman Patrol stays
deliberately small, private and simple — that is a feature, not a limitation.

---

## 1. The big, established platforms

### Ushahidi — github.com/ushahidi/platform
- **What it is:** the best-known open-source platform for crowdsourced
  incident reporting and mapping, created in Kenya in 2008 after the
  post-election crisis, now used worldwide for elections, disasters and
  human-rights monitoring. Free/open source (LGPL/AGPL).
- **Strengths:** custom survey/report forms with any fields you need;
  multi-channel intake (web form, SMS, email, app); report triage and
  verification workflows; roles and permissions; private deployments; mature
  and battle-tested.
- **What we can learn:** their report lifecycle (submitted → reviewed →
  verified → responded) maps closely to our incident statuses; their custom
  field system is the "grown-up" version of our VOI/POI/SOI field sets.
- **Why we don't just use it:** it is a heavy server platform (PHP/Laravel).
  Our app is intentionally a lightweight static site with no server to run,
  and our reports are private to the patrol (never a public map), which fits
  *Sitr* (privacy).

### FixMyStreet (mySociety) — github.com/mysociety/fixmystreet
- **What it is:** mySociety's map-based civic problem-reporting platform,
  open source and running since 2007; used by councils and communities in
  many countries. Actively developed.
- **Strengths:** a very polished report flow — photo + pin on map + category
  → sent to the right authority → status updates (reported / in progress /
  fixed) → public timeline. It also championed Open311, the open standard for
  civic issue reporting.
- **What we can learn:** their report status workflow mirrors our
  Logged / Acknowledged / SAPS-Security Notified / Resolved; their category
  and "what happens next" copy is a good model for setting expectations.

## 2. Specialised building blocks (for future features)

### Traccar — github.com/traccar/traccar  (Apache 2.0)
- The established open-source GPS tracking platform: self-hosted or managed,
  200+ device protocols, REST API, mature apps. This remains the leading
  candidate **if** we ever add live patrol tracking (a "future idea" that is
  NOT agreed yet).
- Privacy design if it ever happens: opt-in per shift, visible to the
  coordinator only, auto-expiring at shift end.

### Hauk — github.com/bilde2910/Hauk
- Fully open-source, self-hosted **real-time location sharing** with
  auto-expiring share links and no accounts (Android + iOS clients, PHP
  backend). Lighter than Traccar for a "share my patrol position for the
  next two hours" pattern.

### Mumble — github.com/mumble-voip/mumble  (BSD licence)
- The classic open-source, low-latency voice chat with channels — the
  open-source answer to Zello-style push-to-talk. Would need a small server
  (a few dollars a month) if we ever replace the Zello placeholder.
  Channels map neatly onto patrol radio channels.
- **PTT round 2 (2026-10-03):** two newer options checked out.
  *golanbenoni/ptt* ("PTT Talk", AGPLv3) is a self-hosted, end-to-end
  encrypted push-to-talk system with Android + iOS clients — promising on
  paper but still pre-release, so watch it rather than adopt it.
  *spdobest/QR-PTT-PushToTalk* (GPLv3) is a Mumble-based Android client
  built for guarding patrols and lone workers, but it is old and
  Android-only. **Verdict stands: Mumble is the open-source PTT choice if
  voice radio is ever approved — with the honest caveat that its iOS client
  lags behind Android, and the WhatsApp group remains the zero-effort
  default for a mixed Android/iPhone team.**

## 3. Smaller community-watch apps on GitHub (reference only)

The GitHub topic `neighborhood-watch` collects smaller and often academic
projects. Useful to see approaches, not production tools:

- **nands93/neighborhood_watch** — reports, map and real-time alerts; Go +
  PostgreSQL/PostGIS + React + Leaflet in Docker. The closest technical
  cousin to our stack.
- **radu1633/NeighborhoodWatch** — bachelor's thesis app: incident reports,
  neighbourhood chat, push alerts, automatic neighbourhood assignment by GPS
  or ID card.
- **robertsmikej/Sentry** — privacy-focused licence-plate scanner and
  tracker PWA (offline OCR + AI). Interesting for VOI work, but licence-plate
  recognition must be checked against POPIA and our own no-profiling rule
  before it is ever considered. Treat with great caution.
- **NaitikVora/watchapp**, **Joseph-Odhiambo/Neighborhood-watch** —
  student-scale neighbourhood watch apps (Flutter / Django).

## 4. What this means for Aman Patrol

1. **Stay as we are for now.** Our design (static site, approval-only
   members, private reports, no public crime map) is deliberately more
   private than any of the big platforms — that serves Sitr and our two
   suburbs well.
2. **When Supabase is connected,** our schema already mirrors the patterns
   these platforms proved (profiles, claims, incidents with custom fields,
   status workflow). No rework needed.
3. **Live GPS and voice radio remain future options only** — Traccar/Hauk for
   location, Mumble for voice — and only with the coordinator's approval and
   privacy-by-design from day one.

## 5. Round 2 — more tools the coordinator asked about (2026-10-03)

Asked: what *other* free open-source GitHub repos could we add to this app?
Same ground rule — nothing below is approved for integration; these are
notes with a clear "fits us / does not fit us" verdict.

### ntfy — github.com/binwiederhier/ntfy (Apache 2.0 / GPLv2)
- Push notifications with the simplest API there is: one HTTP POST to a
  topic, and every phone subscribed to that topic buzzes. Free hosted
  service at ntfy.sh, or self-host a single small Go server. Android and
  iOS apps.
- **The most realistic next add for Aman Patrol:** once Supabase is live,
  coordinator announcements and shift reminders could push to a private
  topic volunteers subscribe to. No app store, no per-user accounts.
- Privacy: use an unguessable private topic or a self-hosted instance, and
  never push victim or address details through the public ntfy.sh.

### Gotify — github.com/gotify/server (MIT)
- Same idea as ntfy (self-hosted push notifications, web + Android client),
  older and slightly heavier, using user/app tokens instead of topics. A
  fine fallback if we ever want everything on one box.

### PocketBase — github.com/pocketbase/pocketbase (MIT)
- An entire backend — SQLite database, auth, file storage, admin UI — in one
  Go binary you can run on a five-dollar VPS. If Supabase ever feels too
  "cloud", PocketBase does the same job with zero external services. Our
  Supabase schema would need porting, so we stay put unless that changes.

### OwnTracks — github.com/owntracks (Eclipse Public Licence)
- Privacy-first location sharing: the phone publishes its position over
  MQTT (or HTTP) to a server *you* choose, for people *you* choose. A
  lighter pattern than Traccar for "share my patrol position for this shift
  only". Needs a small MQTT broker such as Mosquitto (also open source).

### Dawarich — github.com/Freika/dawarich (AGPL-3.0)
- Self-hosted location-history dashboard (a Google Timeline replacement)
  that can ingest OwnTracks feeds. Recorded here for completeness — it is
  personal analytics, not a patrol tool, and storing volunteers' movement
  history is exactly what our privacy rules avoid. Not a fit.

### Zulip — github.com/zulip/zulip (Apache 2.0)
- Open-source team chat organised by streams and topics (threads), so
  "Zone A · Monday patrol" can be one searchable conversation. A
  community-owned alternative to the WhatsApp group. Runs as a full server.

### Rocket.Chat — github.com/RocketChat/Rocket.Chat (MIT)
- Self-hosted team chat, closer to Slack in look and feel. Same trade-offs
  as Zulip; pick one, not both.

### Element / Matrix — github.com/element-hq (Apache 2.0)
- Decentralised, end-to-end-encrypted messaging on the open Matrix
  protocol. The strongest privacy option for committee chat, at the cost of
  more concepts to learn (homeservers). Element is the main client.

### Jitsi Meet — github.com/jitsi/jitsi-meet (Apache 2.0)
- Open-source video calls that work in the browser with no accounts —
  useful for monthly committee meetings or coordinator check-ins. Free
  public instance at meet.jit.si, or self-host.

### Frigate — github.com/blakeblackshear/frigate (MIT)
- Open-source NVR with local AI object detection for security cameras.
  Residents often ask about CCTV; Frigate is what a household would run
  *themselves*. Aman Patrol would only ever store "a camera covers this
  street" (opt-in, coordinator-only) — never footage, never feeds.

### What we would actually pick, in order
1. **ntfy** — coordinator announcements and shift-reminder pushes once
   Supabase is live. Smallest step, biggest daily value.
2. **Mumble** (round 1) — if the Zello placeholder ever becomes real voice
   radio.
3. **Zulip or Element** — if the committee outgrows WhatsApp and wants
   community-owned chat history.
4. Everything else stays on the shelf until a real need appears — the app
   stays small, private and simple by design.

*Round 1 compiled 2026-10-02; round 2 (section 5) added 2026-10-03. All
projects listed are free and open source; check each repository for its
exact licence before any reuse.*
