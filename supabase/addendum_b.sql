-- ============================================================
--  AMAN PATROL — Addendum B (run AFTER schema.sql + addendum_a.sql)
--  B1. Incident photos: approved volunteers can view them
--      (they are shared operational data).
--  B2. Team chat: the messages table + live delivery.
--  Safe to run more than once.
-- ============================================================

-- ---------- B1. incident photos ----------
drop policy if exists "approved read incident photos" on storage.objects;
create policy "approved read incident photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-photos' and public.is_approved_volunteer());

-- ---------- B2. team chat ----------
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

create policy "approved read messages"
  on public.messages for select using (public.is_approved_volunteer());
create policy "approved send messages"
  on public.messages for insert
  with check (user_id = auth.uid() and public.is_approved_volunteer());

-- live delivery (ignore the error-free no-op if already added)
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
