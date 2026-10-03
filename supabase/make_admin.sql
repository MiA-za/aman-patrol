-- ============================================================
--  AMAN PATROL — MAKE ME THE OWNER
--  Fill in FOUR things below, click Run once. Done.
--  After that: open the app and log in with this email + password.
--  (Safe to re-run.)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- remove the example account if an earlier run created it
delete from auth.users where email = 'you@example.com';

drop table if exists _o;
create temp table _o (name text, email text, password text, phone text);

-- FILL THIS IN — four values only:
insert into _o values (
  'Yusuf Adams',        -- 1. your full name
  'you@example.com',    -- 2. your email (this is your login)
  'YourPassword123',    -- 3. your password (at least 8 characters)
  '+27 82 555 0100'     -- 4. your phone number
);

-- create the login (or, if this email already has an account, keep it
-- and set the password to the one above)
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
  jsonb_build_object(
    'first_name', split_part(o.name, ' ', 1),
    'surname', case when position(' ' in o.name) > 0
                then substr(o.name, position(' ' in o.name) + 1) else '-' end
  ),
  now(), now(), '', '', '', ''
from _o o
where not exists (select 1 from auth.users u where lower(u.email) = lower(o.email));

update auth.users u
set encrypted_password = crypt(o.password, gen_salt('bf')), updated_at = now()
from _o o
where lower(u.email) = lower(o.email);

-- make you the owner: full control, already approved
alter table public.profiles disable trigger protect_profile_privileges;

insert into public.profiles (
  id, first_name, surname, whatsapp, email, street, suburb, dob,
  emergency_contact_name, emergency_contact_number, role, status
)
select
  u.id,
  split_part(o.name, ' ', 1),
  case when position(' ' in o.name) > 0
       then substr(o.name, position(' ' in o.name) + 1) else '-' end,
  o.phone, lower(o.email),
  '-', 'Greenside', '1900-01-01'::date, '-', '-',
  'coordinator', 'approved'
from _o o
join auth.users u on lower(u.email) = lower(o.email)
on conflict (id) do update set
  first_name = excluded.first_name,
  surname = excluded.surname,
  whatsapp = excluded.whatsapp,
  role = 'coordinator',
  status = 'approved';

alter table public.profiles enable trigger protect_profile_privileges;

-- result: this must show YOUR name, coordinator, approved
select first_name, surname, email, role, status
from public.profiles
where email = (select lower(email) from _o);

drop table _o;
