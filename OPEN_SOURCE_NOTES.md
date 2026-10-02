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

*Research compiled 2026-10-02. All projects listed are free and open source;
check each repository for its exact licence before any reuse.*
