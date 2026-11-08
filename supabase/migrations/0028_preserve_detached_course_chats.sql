-- Preserve the owned section when the course FK clears its conversation link.
-- Never update rows in projects from a project deletion trigger.
create or replace function public.group_course_conversation()
returns trigger language plpgsql security definer set search_path=public as $$
declare target public.projects%rowtype; section public.projects%rowtype;
begin
 if new.project_id is null then
   if TG_OP='UPDATE' and old.project_id is not null and old.section_folder_id is not null
      and new.user_id=old.user_id
      and not exists(select 1 from public.projects where id=old.project_id)
      and exists(select 1 from auth.users where id=new.user_id)
      and exists(select 1 from public.projects where id=old.section_folder_id and user_id=new.user_id and is_folder) then
     new.project_id:=old.section_folder_id;
   end if;
   new.section_folder_id:=null;
   return new;
 end if;
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
