-- Course owns the conversation; its section owns resources. Apply before app rollout.
alter table public.conversations add column if not exists section_folder_id uuid references public.projects(id) on delete set null;
alter table public.conversations add column if not exists section_unavailable boolean not null default false;
create index if not exists conversations_section_folder_idx on public.conversations(user_id, section_folder_id);

create or replace function public.group_course_conversation()
returns trigger language plpgsql security definer set search_path=public as $$
declare target public.projects%rowtype; section public.projects%rowtype;
begin
 if new.project_id is null then new.section_folder_id:=null; return new; end if;
 select * into target from public.projects where id=new.project_id and user_id=new.user_id for share;
 if not found then raise exception 'conversation project ownership'; end if;
 if target.is_folder and target.parent_course_id is not null then
   new.section_folder_id:=target.id;
   new.project_id:=target.parent_course_id;
 end if;
 if new.section_folder_id is not null then
   select * into section from public.projects where id=new.section_folder_id and user_id=new.user_id and is_folder for share;
   if not found or section.parent_course_id is distinct from new.project_id then raise exception 'conversation section ownership'; end if;
   if not exists(select 1 from public.projects where id=new.project_id and user_id=new.user_id and not is_folder) then raise exception 'conversation course ownership'; end if;
 end if;
 return new;
end $$;
revoke all on function public.group_course_conversation() from public,anon,authenticated;
drop trigger if exists group_course_conversation on public.conversations;
create trigger group_course_conversation before insert or update of project_id,section_folder_id,user_id on public.conversations for each row execute function public.group_course_conversation();

-- Folder moves and deletions preserve an explicit boundary for existing chats.
create or replace function public.rehome_folder_conversations()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='UPDATE' and old.parent_course_id is distinct from new.parent_course_id then
   update public.conversations
      set project_id=coalesce(new.parent_course_id,new.id),
          section_folder_id=case when new.parent_course_id is null then null else new.id end
    where user_id=new.user_id and
      (section_folder_id=new.id or (old.parent_course_id is null and project_id=new.id));
 elsif TG_OP='DELETE' and old.is_folder then
   update public.conversations set section_folder_id=null,section_unavailable=true
    where user_id=old.user_id and section_folder_id=old.id;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.rehome_folder_conversations() from public,anon,authenticated;
drop trigger if exists rehome_folder_conversations_update on public.projects;
create trigger rehome_folder_conversations_update after update of parent_course_id on public.projects
for each row execute function public.rehome_folder_conversations();
drop trigger if exists rehome_folder_conversations_delete on public.projects;
create trigger rehome_folder_conversations_delete before delete on public.projects
for each row execute function public.rehome_folder_conversations();

-- Firing the same guard preserves the old section link while grouping existing chats.
update public.conversations c set project_id=c.project_id
from public.projects f where c.project_id=f.id and c.user_id=f.user_id and f.is_folder and f.parent_course_id is not null;
