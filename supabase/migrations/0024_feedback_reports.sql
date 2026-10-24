-- Private, user-submitted product feedback. Reports are visible only through authenticated,
-- server-authorized routes; user text is never copied into conversations or analytics events.
create table if not exists public.feedback_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 submission_id uuid not null,
 category text not null check (category in ('bug','usability','idea','other')),
 title text not null check (char_length(title) between 3 and 120),
 description text not null check (char_length(description) between 10 and 3000),
 reproduction_steps text not null default '' check (char_length(reproduction_steps) <= 2000),
 page_path text check (page_path is null or (char_length(page_path) <= 300 and left(page_path,1)='/')),
 status text not null default 'new' check (status in ('new','triaged','in_progress','fixed','closed','duplicate')),
 notification_status text not null default 'pending' check (notification_status in ('pending','sent','failed','disabled')),
 notification_sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id, submission_id)
);
create index if not exists feedback_reports_queue_idx on public.feedback_reports(status, created_at desc);
create index if not exists feedback_reports_user_idx on public.feedback_reports(user_id, created_at desc);
alter table public.feedback_reports enable row level security;
revoke all on public.feedback_reports from public, anon, authenticated;
grant select, insert, update on public.feedback_reports to service_role;

-- A transaction-scoped user lock makes the per-user hourly submission limit race-safe.
-- The caller is the authenticated application server; students cannot invoke this RPC directly.
create or replace function public.submit_feedback_report(
 p_user_id uuid, p_submission_id uuid, p_category text, p_title text,
 p_description text, p_reproduction_steps text default '', p_page_path text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_count integer;
begin
 if p_user_id is null or p_submission_id is null then raise exception 'invalid feedback identity'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,24));
 select id into v_id from public.feedback_reports where user_id=p_user_id and submission_id=p_submission_id;
 if found then return jsonb_build_object('ok',true,'id',v_id,'duplicate',true); end if;
 select count(*) into v_count from public.feedback_reports
  where user_id=p_user_id and created_at >= statement_timestamp()-interval '1 hour';
 if v_count >= 5 then return jsonb_build_object('ok',false,'reason','rate_limited'); end if;
 insert into public.feedback_reports(user_id,submission_id,category,title,description,reproduction_steps,page_path)
  values(p_user_id,p_submission_id,p_category,p_title,p_description,coalesce(p_reproduction_steps,''),p_page_path)
  returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id,'duplicate',false);
end $$;
revoke all on function public.submit_feedback_report(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_feedback_report(uuid,uuid,text,text,text,text,text) to service_role;
