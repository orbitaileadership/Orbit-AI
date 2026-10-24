-- Courses calendar and durable quiz launch configuration. Apply only after owner approval.
begin;
create table public.course_calendar_events (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 course_id uuid references public.projects(id) on delete set null,
 title text not null check(length(btrim(title)) between 1 and 200),
 start_value text not null,
 end_value text not null,
 all_day boolean not null default false,
 time_zone text not null check(length(time_zone) between 1 and 100),
 location text not null default '' check(length(location)<=300),
 meeting_url text not null default '' check(length(meeting_url)<=2000 and (meeting_url='' or meeting_url ~ '^https://')),
 notes text not null default '' check(length(notes)<=4000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 check(case when all_day then start_value ~ '^\d{4}-\d{2}-\d{2}$' and end_value ~ '^\d{4}-\d{2}-\d{2}$' and end_value::date > start_value::date
 else start_value ~ '^\d{4}-\d{2}-\d{2}T.*Z$' and end_value ~ '^\d{4}-\d{2}-\d{2}T.*Z$' and end_value::timestamptz>start_value::timestamptz end)
);
create index course_calendar_owner_range on public.course_calendar_events(user_id,start_value,end_value);
alter table public.course_calendar_events enable row level security;
create policy own_calendar_read on public.course_calendar_events for select to authenticated using(user_id=auth.uid());
create policy own_calendar_insert on public.course_calendar_events for insert to authenticated with check(user_id=auth.uid() and (course_id is null or exists(select 1 from public.projects p where p.id=course_id and p.user_id=auth.uid() and not p.is_folder)));
create policy own_calendar_update on public.course_calendar_events for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (course_id is null or exists(select 1 from public.projects p where p.id=course_id and p.user_id=auth.uid() and not p.is_folder)));
create policy own_calendar_delete on public.course_calendar_events for delete to authenticated using(user_id=auth.uid());
revoke all on public.course_calendar_events from anon;
grant select,insert,update,delete on public.course_calendar_events to authenticated;
grant all on public.course_calendar_events to service_role;
alter table public.conversations add column study_config jsonb;
alter table public.conversations add constraint conversation_study_config_shape check(study_config is null or (jsonb_typeof(study_config)='object' and study_config ?& array['format','count','section_id','start_state'] and study_config->>'format' in ('mcq','short-answer','flashcards') and study_config->>'start_state' in ('ready','started') and jsonb_typeof(study_config->'count')='number' and (study_config->>'count')::integer between 1 and 30));
alter table public.messages add column study_cards jsonb;
alter table public.messages add constraint message_study_cards_shape check(study_cards is null or (jsonb_typeof(study_cards)='array' and jsonb_array_length(study_cards)<=100));
commit;
