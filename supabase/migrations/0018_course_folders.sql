-- Preserve existing courses, chats and files. New folders reuse project ownership/RLS.
alter table public.projects add column is_folder boolean not null default false;
alter table public.projects add column parent_course_id uuid references public.projects(id) on delete set null;
alter table public.projects add column pinned_at timestamptz;
alter table public.projects add column last_opened_at timestamptz;
alter table public.projects add constraint folder_course_shape check (
  (is_folder and course_data is null and syllabus_id is null)
  or (not is_folder and parent_course_id is null and pinned_at is null and last_opened_at is null)
);
create index projects_course_folders on public.projects(user_id,parent_course_id) where is_folder;
create or replace function public.check_folder_course_owner() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.is_folder is distinct from old.is_folder or new.user_id is distinct from old.user_id) then
  raise exception 'project_identity_immutable';
 end if;
 if new.parent_course_id is not null and not exists(
  select 1 from public.projects where id=new.parent_course_id and user_id=new.user_id and not is_folder
 ) then raise exception 'folder_course_owner_mismatch'; end if;
 return new;
end $$;
create trigger folder_course_owner before insert or update on public.projects
for each row execute function public.check_folder_course_owner();
revoke all on function public.check_folder_course_owner() from public,anon,authenticated;
