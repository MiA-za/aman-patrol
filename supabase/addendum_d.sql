-- ============================================================
--  AMAN PATROL — Addendum D (run in Supabase SQL Editor)
--  D1. EMS Category: allows Medical / EMS Emergency reports.
--  D2. Shift Handover Notes: adds optional notes column to slot_claims.
--  Safe to run more than once.
-- ============================================================

-- ---------- D1. Allow Medical / EMS Emergency in incidents ----------
alter table public.incidents drop constraint if exists incidents_category_check;
alter table public.incidents add constraint incidents_category_check
  check (category in (
    'Medical / EMS Emergency (EMS)',
    'Suspicious Vehicle (VOI)',
    'Suspicious Person (POI)',
    'Incident (SOI)'
  ));

-- ---------- D2. Add optional handover notes to slot_claims ----------
alter table public.slot_claims add column if not exists notes text;
