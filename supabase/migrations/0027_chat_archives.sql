-- Non-destructive archive flag; existing conversation ownership/RLS still applies.
alter table public.conversations add column if not exists archived boolean not null default false;
create index if not exists conversations_archive_list_idx
  on public.conversations (user_id, provider, orbit_mode, archived, updated_at desc);
