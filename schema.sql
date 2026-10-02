-- ============================================================
--  AMAN PATROL — Supabase schema (Greenside & Emmarentia)
--  Paste this ONCE into: Supabase Dashboard → SQL Editor → New query → Run
--  It creates the 5 tables from the project spec (+ their security
--  rules), a photo storage bucket, and a few starter rows.
--  Safe to run on a brand-new empty project.
-- ============================================================

-- ---------- 1) PROFILES (one row per volunteer) ----------
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  first_name               text not null,
  surname                  text not null,
  whatsapp                 text not null,
  email                    text not null,
  street                   text not null,
  suburb                   text not null,
  dob                      date not null,
  emergency_contact_name   text not null,
  emergency_contact_number text not null,
  role                     text not null default 'volunteer' check (role in ('volunteer','coordinator')),
  status                   text not null default 'pending'  check (status in ('pending','approved','declined')),
  created_at               timestamptz not null default now()
);

-- ---------- 2) PATROL SLOTS ----------
create table if not exists public.patrol_slots (
  id              bigint generated always as identity primary key,
  zone            text not null check (zone in ('Zone A – Greenside','Zone B – Emmarentia')),
  activity_window text not null check (activity_window in
                    ('Morning patrol','Madrassah drop-off','Afternoon patrol','Jumu''ah','Evening after Maghrib/Isha')),
  date            date not null,
  time_window     text not null,
  min_required    int  not null default 2
);

-- ---------- 3) SLOT CLAIMS (who is on which shift; the shift log) ----------
create table if not exists public.slot_claims (
  id               bigint generated always as identity primary key,
  slot_id          bigint not null references public.patrol_slots(id) on delete cascade,
  user_id          uuid   not null references public.profiles(id) on delete cascade,
  status           text   not null default 'claimed' check (status in ('claimed','started','completed','cancelled')),
  start_shift_time timestamptz,
  end_shift_time   timestamptz,
  start_gps_lat    double precision,
  start_gps_lng    double precision,
  end_gps_lat      double precision,
  end_gps_lng      double precision,
  created_at       timestamptz not null default now(),
  unique (slot_id, user_id)
);

-- ---------- 4) INCIDENTS (VOI / POI / SOI reports + response & handover) ----------
create table if not exists public.incidents (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  category         text not null check (category in ('Suspicious Vehicle (VOI)','Suspicious Person (POI)','Incident (SOI)')),
  status           text not null default 'Logged' check (status in ('Logged','Acknowledged','SAPS/Security Notified','Resolved')),
  zone             text,
  gps_lat          double precision,
  gps_lng          double precision,
  location_address text,
  description      text,
  photo_url        text,
  responder_type   text,
  responder_name   text,
  vehicle_reg      text,
  call_sign        text,
  contact_details  text,
  arrival_time     timestamptz,
  outcome          text,
  fields           jsonb default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- ---------- 5) MAP PINS (coordinator-confirmed custom pins) ----------
create table if not exists public.map_pins (
  id         bigint generated always as identity primary key,
  label      text not null,
  type       text not null check (type in ('dark_spot','risk_corner','madrassah_corridor','recent_incident','other')),
  lat        double precision not null,
  lng        double precision not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 6) NOTIFICATIONS (in-app feed; small addition beyond the spec's 5 tables) ----------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  audience   text not null default 'all' check (audience in ('all','volunteers','coordinator','user')),
  user_id    uuid references public.profiles(id) on delete cascade,  -- only used when audience = 'user'
  kind       text not null default 'info' check (kind in ('info','ok','warn','danger')),
  title      text not null,
  body       text,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_reads (
  notification_id bigint not null references public.notifications(id) on delete cascade,
  user_id         uuid   not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ============================================================
--  HELPER FUNCTIONS (used by the security rules below)
-- ============================================================
create or replace function public.is_coordinator()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles
     where id = auth.uid() and role = 'coordinator' and status = 'approved'
   ) $$;

create or replace function public.is_approved_volunteer()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.profiles
     where id = auth.uid() and status = 'approved'
   ) $$;

-- Auto-create a profile when someone registers through the app.
-- The app sends the extra details (name, suburb, etc.) with the signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into public.profiles (id, first_name, surname, whatsapp, email, street, suburb, dob,
                               emergency_contact_name, emergency_contact_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'surname', ''),
    coalesce(new.raw_user_meta_data->>'whatsapp', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'street', ''),
    coalesce(new.raw_user_meta_data->>'suburb', ''),
    coalesce((new.raw_user_meta_data->>'dob')::date, '1900-01-01'),
    coalesce(new.raw_user_meta_data->>'emergency_contact_name', ''),
    coalesce(new.raw_user_meta_data->>'emergency_contact_number', '')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Stop volunteers from promoting themselves or approving themselves.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not public.is_coordinator() then
    raise exception 'Only the coordinator can change role or status.';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute procedure public.protect_profile_privileges();

-- ============================================================
--  ROW LEVEL SECURITY — the privacy rules of Aman Patrol
--  * A volunteer can only ever see their own personal details.
--  * Only the coordinator sees everyone's details.
--  * Only approved volunteers can see operations data.
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.patrol_slots    enable row level security;
alter table public.slot_claims     enable row level security;
alter table public.incidents       enable row level security;
alter table public.map_pins        enable row level security;
alter table public.notifications   enable row level security;
alter table public.notification_reads enable row level security;

-- PROFILES
create policy "read own profile"        on public.profiles for select using (auth.uid() = id);
create policy "coordinator reads all"   on public.profiles for select using (public.is_coordinator());
create policy "update own profile"      on public.profiles for update using (auth.uid() = id);
create policy "coordinator updates all" on public.profiles for update using (public.is_coordinator());
-- (no insert policy — profiles are created automatically at signup)

-- PATROL SLOTS
create policy "approved read slots"      on public.patrol_slots for select using (public.is_approved_volunteer());
create policy "coordinator writes slots" on public.patrol_slots for insert with check (public.is_coordinator());
create policy "coordinator edits slots"  on public.patrol_slots for update using (public.is_coordinator());
create policy "coordinator dels slots"   on public.patrol_slots for delete using (public.is_coordinator());

-- SLOT CLAIMS
create policy "read own claims"        on public.slot_claims for select using (auth.uid() = user_id or public.is_coordinator());
create policy "claim a slot"           on public.slot_claims for insert with check (user_id = auth.uid() and public.is_approved_volunteer());
create policy "coordinator assigns"    on public.slot_claims for insert with check (public.is_coordinator());
create policy "start end own shift"    on public.slot_claims for update using (auth.uid() = user_id or public.is_coordinator());
create policy "remove own claim"       on public.slot_claims for delete using (auth.uid() = user_id and status = 'claimed');
create policy "coordinator removes"    on public.slot_claims for delete using (public.is_coordinator());

-- INCIDENTS
create policy "volunteers read incidents" on public.incidents for select using (public.is_approved_volunteer());
create policy "report own incident"       on public.incidents for insert with check (user_id = auth.uid() and public.is_approved_volunteer());
create policy "coordinator manages"       on public.incidents for update using (public.is_coordinator());

-- MAP PINS
create policy "approved read pins"   on public.map_pins for select using (public.is_approved_volunteer());
create policy "coordinator adds"     on public.map_pins for insert with check (public.is_coordinator());
create policy "coordinator removes"  on public.map_pins for delete using (public.is_coordinator());

-- NOTIFICATIONS
create policy "read relevant notifs" on public.notifications for select using (
  audience = 'all'
  or (audience = 'coordinator' and public.is_coordinator())
  or (audience = 'volunteers' and public.is_approved_volunteer())
  or (audience = 'user' and user_id = auth.uid())
);
create policy "coordinator announces" on public.notifications for insert with check (public.is_coordinator());
create policy "mark own read"         on public.notification_reads for insert with check (user_id = auth.uid());

-- ============================================================
--  PHOTO STORAGE (private bucket — Sitr)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', false)
on conflict (id) do nothing;

create policy "volunteers upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-photos');

create policy "read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-photos' and owner = auth.uid());

create policy "coordinator reads all photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-photos' and public.is_coordinator());

-- ============================================================
--  STARTER DATA (5 patrol slots + coordinator pins).
--  Volunteers and incidents are created through the app itself.
-- ============================================================
insert into public.patrol_slots (zone, activity_window, date, time_window, min_required) values
  ('Zone A – Greenside',  'Madrassah drop-off',           current_date + 1, '07:30–08:30', 2),
  ('Zone B – Emmarentia', 'Afternoon patrol',             current_date + 1, '12:00–14:00', 2),
  ('Zone A – Greenside',  'Morning patrol',               current_date + 2, '06:00–08:00', 2),
  ('Zone B – Emmarentia', 'Jumu''ah',                     current_date + 4, '11:30–13:30', 2),
  ('Zone A – Greenside',  'Evening after Maghrib/Isha',   current_date + 3, '19:45–22:00', 2);

insert into public.map_pins (label, type, lat, lng) values
  ('Unlit stretch — Tana Road Park edge', 'dark_spot', -26.1479, 28.0005),
  ('Smash-and-grab hotspot — robots on Greenhill Road', 'risk_corner', -26.1512, 28.0095),
  ('Madrassah walking corridor — Greenside Masjid to Greenside Primary', 'madrassah_corridor', -26.1507, 28.0105);

-- ============================================================
--  DONE. Next steps are in SUPABASE_SETUP.md:
--  register in the app, then promote yourself to coordinator:
--
--  update public.profiles
--  set role = 'coordinator', status = 'approved'
--  where email = 'your@email.com';
-- ============================================================
