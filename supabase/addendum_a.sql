-- ============================================================
--  AMAN PATROL — Addendum A (run AFTER schema.sql)
--  Brings the schema in line with the app: volunteer-created
--  roster slots, SOS button, WhatsApp group link.
--  Source of truth: AUDIT.md section 4. Optional extra
--  hardening (SOS trigger) is described there and is NOT
--  needed for the pilot.
-- ============================================================


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
