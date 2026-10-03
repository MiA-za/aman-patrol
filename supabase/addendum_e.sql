-- Aman Patrol Addendum E: private, durable PTT voice messages.
-- Run after addendum_b.sql. Safe to run more than once.

alter table public.messages
  add column if not exists audio_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-messages',
  'voice-messages',
  false,
  5242880,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "approved read voice messages" on storage.objects;
drop policy if exists "approved upload own voice messages" on storage.objects;
drop policy if exists "approved delete own voice messages" on storage.objects;

create policy "approved read voice messages"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-messages' and public.is_approved_volunteer());

create policy "approved upload own voice messages"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-messages'
    and public.is_approved_volunteer()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "approved delete own voice messages"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-messages'
    and public.is_approved_volunteer()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
