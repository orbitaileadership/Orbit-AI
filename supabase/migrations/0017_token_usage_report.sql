-- Additive, read-only reporting. Existing ledger metadata stores new measurements; no content is copied.
-- Version 1 complexity proxies: prompt size <=256 / <=1024 / >1024 estimated tokens, files/tools present.
create or replace function public.orbit_token_usage_report(p_days integer default 30, p_model_id text default null, p_user_id uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
with window_calls as (
 select l.* from public.ledger l
 where l.created_at>=now()-make_interval(days=>least(greatest(p_days,1),90)) and l.operation='chat'
), calls as (
 select l.*, l.metadata->'usageContext' as ctx,
   (l.state='settled' and l.input_tokens is not null and l.output_tokens is not null) as measured
 from window_calls l where (p_model_id is null or l.model_id=p_model_id) and (p_user_id is null or l.user_id=p_user_id)
), user_turns as (
 select m.id,m.conversation_id,m.user_id,row_number() over(partition by m.conversation_id order by m.seq) as turn_index
 from public.messages m where m.role='user' and m.kind='text'
 and m.conversation_id in (select conversation_id from calls)
), annotated as (
 select c.*,t.turn_index,
   case when c.ctx->>'promptTokens' ~ '^[0-9]{1,9}$' then (c.ctx->>'promptTokens')::integer end as prompt_tokens,
   case when c.ctx->>'historyTokens' ~ '^[0-9]{1,9}$' then (c.ctx->>'historyTokens')::integer end as history_tokens
 from calls c join user_turns t on t.id::text=c.ctx->>'userMessageId'
   and t.user_id=c.user_id and t.conversation_id=c.conversation_id
 where c.ctx->>'version'='1'
), question_totals as (
 -- Check the complete chain, including calls outside the selected window/model.
 select l.user_id,l.conversation_id,l.metadata#>>'{usageContext,userMessageId}' as message_id,count(*) as total_calls
 from public.ledger l join (select distinct user_id,conversation_id,ctx->>'userMessageId' as message_id from annotated) a
 on a.user_id=l.user_id and a.conversation_id=l.conversation_id and a.message_id=l.metadata#>>'{usageContext,userMessageId}'
 where l.operation='chat' group by l.user_id,l.conversation_id,l.metadata#>>'{usageContext,userMessageId}'
), question_usage as (
 select a.user_id,a.conversation_id,a.ctx->>'userMessageId' as message_id,a.turn_index,
   count(*) as calls,count(*)=max(q.total_calls) as complete_chain,
   bool_and(a.measured) and count(*)=max(q.total_calls) as measured,
   case when bool_and(a.measured) and count(*)=max(q.total_calls) then sum(a.input_tokens) end as input_tokens,
   case when bool_and(a.measured) and count(*)=max(q.total_calls) then sum(a.output_tokens) end as output_tokens,
   max(a.prompt_tokens) as prompt_tokens,max(a.history_tokens) as history_tokens,
   bool_or(a.ctx->>'hasFiles'='true') as has_files,bool_or(a.ctx->>'hasTools'='true') as has_tools
 from annotated a join question_totals q on a.user_id=q.user_id and a.conversation_id=q.conversation_id and a.ctx->>'userMessageId'=q.message_id
 group by a.user_id,a.conversation_id,a.ctx->>'userMessageId',a.turn_index
), questions as (
 select q.*,
   case when turn_index=1 then 1 when turn_index<=5 then 2 when turn_index<=10 then 3 when turn_index<=20 then 4 else 5 end as depth_order,
   case when turn_index=1 then '1' when turn_index<=5 then '2–5' when turn_index<=10 then '6–10' when turn_index<=20 then '11–20' else '21+' end as depth,
   case when prompt_tokens<=256 then 'Short (≤256)' when prompt_tokens<=1024 then 'Medium (257–1,024)' when prompt_tokens>1024 then 'Long (>1,024)' else 'Unknown' end as prompt_band,
   case when prompt_tokens<=256 then 1 when prompt_tokens<=1024 then 2 when prompt_tokens>1024 then 3 else 4 end as prompt_order,
   case when has_files and has_tools then 'Files + tools' when has_files then 'Files' when has_tools then 'Tools' else 'Text only' end as workload
 from question_usage q
), summary as (
 select count(*) as calls,count(*) filter(where measured) as measured_calls,
   count(*) filter(where not measured) as unknown_usage_calls,
   count(distinct user_id) as users,count(distinct conversation_id) as conversations,
   sum(input_tokens) filter(where measured) as input_tokens,sum(output_tokens) filter(where measured) as output_tokens,
   sum(cached_tokens) filter(where measured) as cached_tokens,
   sum(cached_tokens) filter(where measured)::numeric/nullif(sum(input_tokens) filter(where measured and cached_tokens is not null),0) as cache_share,
   count(*) filter(where measured and cached_tokens is null) as missing_cache_calls,
   sum(actual_usd_micros) filter(where state='settled') as cost_usd_micros,
   (select count(*) from questions) as questions,
   (select count(*) from questions where measured) as measured_questions,
   (select count(*) from questions where not complete_chain) as partial_questions,
   (select count(*) from annotated where prompt_tokens is not null) as annotated_calls,
   (select avg(prompt_tokens) from questions where measured) as mean_prompt_tokens,
   (select avg(history_tokens) from questions where measured) as mean_history_tokens
 from calls
), growth as (
 select depth_order,depth,count(*) as questions,count(distinct conversation_id) as conversations,
   sum(calls) as calls,avg(input_tokens) as mean_input_tokens,avg(output_tokens) as mean_output_tokens,
   percentile_cont(0.95) within group(order by input_tokens) as p95_input_tokens,
   avg(prompt_tokens) as mean_prompt_tokens,avg(history_tokens) as mean_history_tokens
 from questions where measured and prompt_tokens is not null
 group by depth_order,depth order by depth_order
), complexity as (
 select prompt_order,prompt_band,workload,count(*) as questions,sum(calls) as calls,
   avg(input_tokens) as mean_input_tokens,avg(output_tokens) as mean_output_tokens,
   percentile_cont(0.95) within group(order by input_tokens) as p95_input_tokens
 from questions where measured and prompt_tokens is not null
 group by prompt_order,prompt_band,workload order by prompt_order,workload
), users as (
 select user_id,count(*) as calls,count(distinct conversation_id) as conversations,
   count(*) filter(where not measured) as unknown_usage_calls,
   sum(input_tokens) filter(where measured) as input_tokens,sum(output_tokens) filter(where measured) as output_tokens,
   sum(cached_tokens) filter(where measured) as cached_tokens,
   sum(actual_usd_micros) filter(where state='settled') as cost_usd_micros
 from calls group by user_id order by coalesce(sum(input_tokens) filter(where measured),0) desc,user_id limit 200
)
select jsonb_build_object('days',least(greatest(p_days,1),90),'modelId',p_model_id,'userId',p_user_id,
 'modelOptions',coalesce((select jsonb_agg(model_id order by model_id) from (select distinct model_id from window_calls) m),'[]'),
 'summary',(select to_jsonb(s) from summary s),
 'growth',coalesce((select jsonb_agg(to_jsonb(g) order by depth_order) from growth g),'[]'),
 'complexity',coalesce((select jsonb_agg(to_jsonb(c) order by prompt_order,workload) from complexity c),'[]'),
 'users',coalesce((select jsonb_agg(to_jsonb(u) order by coalesce(input_tokens,0) desc,user_id) from users u),'[]'));
$$;
revoke all on function public.orbit_token_usage_report(integer,text,uuid) from public,anon,authenticated;
grant execute on function public.orbit_token_usage_report(integer,text,uuid) to service_role;
