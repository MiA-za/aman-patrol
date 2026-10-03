-- ============================================================
--  AMAN PATROL — ADDENDUM C: automatic cleanup of stale
--  registrations (runs daily, no app update needed)
--
--  What it does: every day it deletes registrations that were
--  never approved (or were declined) more than 30 days ago.
--  APPROVED patrollers are NEVER touched.
--
--  Paste into Supabase SQL Editor and Run ONCE. Safe to re-run.
-- ============================================================

create extension if not exists pg_cron;

-- remove the previous version of this job if it exists (safe re-run)
select cron.unschedule('aman-purge-stale-registrations')
where exists (select 1 from cron.job where jobname = 'aman-purge-stale-registrations');

select cron.schedule(
  'aman-purge-stale-registrations',
  '15 3 * * *',  -- daily at 03:15 UTC (05:15 South African time)
  $$
  delete from auth.users u
  where exists (
    select 1 from public.profiles p
    where p.id = u.id
      and p.status in ('pending', 'declined')
      and p.created_at < now() - interval '30 days'
  );
  $$
);

-- check: you should see one job named aman-purge-stale-registrations
select jobid, jobname, schedule, active from cron.job;
