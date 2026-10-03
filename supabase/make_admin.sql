-- ============================================================
--  AMAN PATROL — MAKE ME THE COORDINATOR (owner bootstrap)
--  Fill in YOUR details in the one line marked FILL THIS IN,
--  then click Run ONCE.
--
--  What it does:
--    1. Creates your login (email + password)
--    2. Makes you the approved coordinator immediately
--
--  After it runs: open the app and simply LOG IN with this
--  email and password. No registration form, no approval wait.
--  Safe to run again if anything errors — just fix the line
--  and Run the whole script once more.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

drop table if exists _o;
create temp table _o (
  first_name text, surname text, email text, password text,
  whatsapp text, street text, suburb text, dob date,
  ec_name text, ec_number text
);

-- FILL THIS IN (all ten values, in this order):
insert into _o values (
  'Yusuf',              -- first name
  'Adams',              -- surname
  'you@example.com',    -- your email (this is your login)
  'YourPassword123',    -- your password (at least 8 characters)
  '+27 82 555 0100',    -- your WhatsApp number
  '24 Gleneagles Road', -- your street
  'Greenside',          -- suburb: Greenside or Emmarentia
  '1984-06-12',         -- your date of birth (YYYY-MM-DD)
  'Maryam Adams',       -- emergency contact name
  '+27 82 555 0101'     -- emergency contact number
);

-- 1. Create the login (if this email already has an account, skip
--    creating and just make sure the password matches the one above)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  'authenticated', 'authenticated', lower(o.email),
  crypt(o.password, gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', o.first_name, 'surname', o.surname),
  now(), now(), '', '', '', ''
from _o o
where not exists (select 1 from auth.users u where lower(u.email) = lower(o.email));

update auth.users u
set encrypted_password = crypt(o.password, gen_salt('bf')), updated_at = now()
from _o o
where lower(u.email) = lower(o.email);

-- 2. Make this person the approved coordinator.
--    (The anti-self-promotion guard is paused for this one statement,
--    then switched straight back on.)
alter table public.profiles disable trigger protect_profile_privileges;

insert into public.profiles (
  id, first_name, surname, whatsapp, email, street, suburb, dob,
  emergency_contact_name, emergency_contact_number, role, status
)
select
  u.id, o.first_name, o.surname, o.whatsapp, lower(o.email),
  o.street, o.suburb, o.dob, o.ec_name, o.ec_number,
  'coordinator', 'approved'
from _o o
join auth.users u on lower(u.email) = lower(o.email)
on conflict (id) do update set
  first_name = excluded.first_name,
  surname = excluded.surname,
  whatsapp = excluded.whatsapp,
  street = excluded.street,
  suburb = excluded.suburb,
  dob = excluded.dob,
  emergency_contact_name = excluded.emergency_contact_name,
  emergency_contact_number = excluded.emergency_contact_number,
  role = 'coordinator',
  status = 'approved';

alter table public.profiles enable trigger protect_profile_privileges;

-- 3. Result check — should show your name, coordinator, approved
select first_name, surname, email, role, status
from public.profiles
where email = (select lower(email) from _o);

drop table _o;
