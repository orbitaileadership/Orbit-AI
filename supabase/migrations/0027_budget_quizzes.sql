-- Local only: whole-session ceiling and private answer keys.
create table public.budget_quizzes (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid references public.projects(id) on delete cascade,
 topic text not null check(length(topic) between 1 and 1800), context text not null,
 model_id text not null, count integer not null check(count between 1 and 30),
 cap_micros bigint not null check(cap_micros>0),
 phase text not null default 'new' check(phase in ('new','first_running','first_ready','rest_running','ready','failed')),
 questions jsonb not null default '[]', answers jsonb not null default '[]', error text,
 generation_started_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.budget_quizzes enable row level security;
revoke all on public.budget_quizzes from public,anon,authenticated;
grant select,insert,update on public.budget_quizzes to service_role;
create index budget_quizzes_owner on public.budget_quizzes(user_id,updated_at desc);
create index ledger_quiz_parent on public.ledger(user_id,(metadata->>'parentRequestId'));

create function public.create_budget_quiz(p_user_id uuid,p_id uuid,p_project_id uuid,p_topic text,p_context text,p_model_id text,p_count integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u jsonb; cap bigint; q public.budget_quizzes;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,27));
 select * into q from public.budget_quizzes where id=p_id;
 if found then
   if q.user_id<>p_user_id or q.project_id is distinct from p_project_id or q.topic<>p_topic or q.model_id<>p_model_id or q.count<>p_count then raise exception 'quiz_conflict'; end if;
   return to_jsonb(q);
 end if;
 if p_project_id is not null and not exists(select 1 from public.projects where id=p_project_id and user_id=p_user_id) then raise exception 'not_found'; end if;
 u:=public.usage_windows(p_user_id);
 if not coalesce((u->>'ok')::boolean,false) then raise exception 'usage_unavailable'; end if;
 select floor((w->>'limit_micros')::numeric/100)::bigint into cap from jsonb_array_elements(u->'windows') w where w->>'key'='daily';
 if cap is null or cap<=0 then raise exception 'quiz_budget'; end if;
 insert into public.budget_quizzes(id,user_id,project_id,topic,context,model_id,count,cap_micros)
 values(p_id,p_user_id,p_project_id,p_topic,p_context,p_model_id,p_count,cap) returning * into q;
 return to_jsonb(q);
end $$;

create function public.reserve_quiz_call(p_user_id uuid,p_quiz_id uuid,p_phase text,p_bound bigint,p_price jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.budget_quizzes; used bigint; r jsonb; request text; expected text;
begin
 request:=p_quiz_id::text||':'||p_phase;
 perform pg_advisory_xact_lock(hashtextextended(request,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,1));
 perform 1 from public.budgets where user_id=p_user_id for update;
 select * into q from public.budget_quizzes where id=p_quiz_id and user_id=p_user_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
 if p_phase is null or p_phase not in ('first','rest') or p_bound is null or p_bound<=0 then raise exception 'invalid_quiz_call'; end if;
 if exists(select 1 from public.ledger where request_id=request) then return jsonb_build_object('ok',false,'reason','duplicate'); end if;
 expected:=case when p_phase='first' then 'new' else 'first_ready' end;
 if q.phase<>expected or (p_phase='rest' and q.count=1) then return jsonb_build_object('ok',false,'reason','duplicate'); end if;
 select coalesce(sum(case when state='reserved' then reserved_micros when state in ('settled','uncertain') then coalesce(actual_micros,reserved_micros) else 0 end),0)
 into used from public.ledger where user_id=p_user_id and metadata->>'parentRequestId'=p_quiz_id::text;
 if used+p_bound>q.cap_micros then return jsonb_build_object('ok',false,'reason','quiz_budget'); end if;
 r:=public.reserve_budget_v3(p_user_id,request,q.model_id,'text',p_bound,
   jsonb_build_object('operation','quiz','parentRequestId',p_quiz_id,'provider',p_price->>'provider'),p_price);
 if coalesce((r->>'ok')::boolean,false) and coalesce(r->>'reason','')<>'duplicate' then
   update public.budget_quizzes set phase=case when p_phase='first' then 'first_running' else 'rest_running' end,generation_started_at=now(),updated_at=now() where id=q.id;
 end if;
 return r;
end $$;

create function public.answer_budget_quiz(p_user_id uuid,p_quiz_id uuid,p_index integer,p_choice integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.budget_quizzes; n integer;
begin
 select * into q from public.budget_quizzes where id=p_quiz_id and user_id=p_user_id for update;
 if not found then raise exception 'not_found'; end if;
 n:=jsonb_array_length(q.answers);
 if p_index is null or p_index<0 or p_choice is null or p_choice not between 0 and 3 then raise exception 'invalid_answer'; end if;
 if p_index<n and (q.answers->>p_index)::integer=p_choice then return to_jsonb(q); end if;
 if p_index<>n or p_index>=jsonb_array_length(q.questions) then raise exception 'stale_answer'; end if;
 update public.budget_quizzes set answers=answers||to_jsonb(p_choice),updated_at=now() where id=q.id returning * into q;
 return to_jsonb(q);
end $$;

revoke all on function public.create_budget_quiz(uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.reserve_quiz_call(uuid,uuid,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.answer_budget_quiz(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_budget_quiz(uuid,uuid,uuid,text,text,text,integer) to service_role;
grant execute on function public.reserve_quiz_call(uuid,uuid,text,bigint,jsonb) to service_role;
grant execute on function public.answer_budget_quiz(uuid,uuid,integer,integer) to service_role;
