import type { ReactNode } from 'react';
import { getModel } from '@/config/models';
import type { Metric, TokenUsageReport } from '@/lib/analytics/report';
const num=(v:Metric|undefined)=>v==null?'No data':Number(v).toLocaleString('en-CA',{maximumFractionDigits:0});
const money=(v:Metric|undefined)=>v==null?'No data':`USD ${(Number(v)/1e6).toFixed(4)}`;
const section='min-w-0 rounded-2xl border border-line bg-surface-100 p-4 sm:p-5';
function UsageTable({title,rows,columns}:{title:string;rows:Record<string,Metric>[];columns:[string,string,(v:Metric)=>ReactNode][]}) {
 return <section className={section}><h3 className="mb-4 text-lg font-semibold">{title}</h3>{!rows.length?<p className="text-ink-muted">No measured questions yet for these filters.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{columns.map(([key,label])=><th key={key} className="whitespace-nowrap p-2 text-ink-muted">{label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t border-line">{columns.map(([key,,format])=><td key={key} className="whitespace-nowrap p-2 tabular-nums">{format(r[key])}</td>)}</tr>)}</tbody></table></div>}</section>;
}
function GrowthChart({rows}:{rows:Record<string,Metric>[]}) {
 if(!rows.length)return <p className="py-8 text-ink-muted">Growth measurements start with new live questions after this update.</p>;
 const max=Math.max(1,...rows.flatMap(r=>[Number(r.mean_input_tokens),Number(r.mean_output_tokens)]));
 const x=(r:Record<string,Metric>)=>70+(Number(r.depth_order)-1)*125;
 const y=(v:Metric)=>195-Number(v)/max*150;
 return <figure><svg viewBox="0 0 640 240" role="img" aria-label="Average input and output tokens per question by question number in a chat" className="w-full">
  {[0,0.5,1].map(f=><g key={f}><line x1="60" x2="590" y1={195-150*f} y2={195-150*f} stroke="var(--line)"/><text x="50" y={199-150*f} textAnchor="end" fontSize="12" fill="var(--ink-muted)">{num(Math.round(max*f))}</text></g>)}
  <polyline fill="none" stroke="var(--brand)" strokeWidth="3" points={rows.map(r=>`${x(r)},${y(r.mean_input_tokens)}`).join(' ')}/>
  <polyline fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeDasharray="6 4" points={rows.map(r=>`${x(r)},${y(r.mean_output_tokens)}`).join(' ')}/>
  {rows.map(r=><g key={String(r.depth)}><circle cx={x(r)} cy={y(r.mean_input_tokens)} r="4" fill="var(--brand)"/><rect x={x(r)-3} y={y(r.mean_output_tokens)-3} width="6" height="6" fill="var(--ink-muted)"/></g>)}
  {['1','2–5','6–10','11–20','21+'].map((label,i)=><text key={label} x={70+i*125} y="220" textAnchor="middle" fontSize="13" fill="var(--ink-muted)">{label}</text>)}
 </svg><figcaption className="text-sm text-ink-muted">Question number in the chat · <span className="text-brand">● Input</span> · ▪ Output (dashed). Exact values and sample sizes appear below.</figcaption></figure>;
}
export function TokenUsage({report,days=30,model='',user=''}:{report?:TokenUsageReport|null;days?:number;model?:string;user?:string}) {
 const s=report?.summary;
 const userLink=(id:Metric)=>{const params=new URLSearchParams({days:String(days),user:String(id)});if(model)params.set('model',model);return <a className="underline" href={`?${params}`}>{String(id)}</a>;};
 return <section className="min-w-0 space-y-5" aria-labelledby="token-usage-title"><div><h2 id="token-usage-title" className="text-2xl font-semibold">Token usage & chat growth</h2><p className="mt-2 text-sm text-ink-muted">Live standard chats only. Input includes cached tokens; output includes reasoning. Orbit panels, syllabus extraction and other operations remain in the operational reports below.</p></div>
 <form className={`${section} flex flex-wrap items-end gap-4`} method="get">
  <label className="text-sm">Time window<select name="days" defaultValue={days} className="mt-1 block rounded-lg border border-line bg-surface-200 p-2">{![7,30,90].includes(days)&&<option value={days}>{days} days</option>}{[7,30,90].map(d=><option key={d} value={d}>Last {d} days</option>)}</select></label>
  <label className="text-sm">Model<select name="model" defaultValue={model} className="mt-1 block max-w-full rounded-lg border border-line bg-surface-200 p-2"><option value="">All models</option>{[...new Set([...(report?.modelOptions??[]),...(model?[model]:[])])].map(id=><option key={id} value={id}>{getModel(id)?.label??id}</option>)}</select></label>
  <label className="min-w-0 basis-full flex-1 text-sm sm:basis-auto">User ID (optional)<input name="user" defaultValue={user} placeholder="All users" className="mt-1 block w-full min-w-0 rounded-lg border border-line bg-surface-200 p-2"/></label>
  <button className="rounded-lg bg-brand px-4 py-2 text-on-brand">Apply filters</button><a href="/admin/analytics" className="py-2 text-sm underline">Reset</a>
 </form>
 {!report||!s?<p role="status" className={section}>Token analytics unavailable. Apply migration 0017 and check the server connection. Existing operational reports remain available.</p>:<>
 <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Input tokens',num(s.input_tokens)],['Output tokens',num(s.output_tokens)],['Cached input tokens',num(s.cached_tokens)],['Recorded API cost',money(s.cost_usd_micros)],['Model calls',num(s.calls)],['Tracked questions',num(s.questions)],['Users / chats',`${num(s.users)} / ${num(s.conversations)}`],['Cache share',s.cache_share==null?'No data':`${(Number(s.cache_share)*100).toFixed(1)}%`]].map(([label,value])=><div className={section} key={label}><dt className="text-sm text-ink-muted">{label}</dt><dd className="mt-2 text-xl font-medium tabular-nums">{value}</dd></div>)}</dl>
 <p className="text-sm text-ink-muted">{num(s.annotated_calls)} of {num(s.calls)} calls have prompt measurements. {num(s.unknown_usage_calls)} calls have unreported usage; token totals include only known usage. {num(s.partial_questions)} question chains cross the selected filters and are excluded from comparisons. Older calls remain in totals but cannot be categorized retroactively. {num(s.missing_cache_calls)} measured calls lack cache details.</p>
 <section className={section}><h3 className="text-lg font-semibold">How usage changes as chats get longer</h3><p className="mt-2 text-sm text-ink-muted">Tokens per question include all reported calls for that question, including retries and tool rounds. Questions with incomplete usage, or calls outside the selected date/model filters, are excluded from comparisons. These are associations across the selected sample, not proof that chat length caused the difference; use the model and user filters to compare more closely.</p><GrowthChart rows={report.growth}/></section>
 <UsageTable title="Usage by chat length" rows={report.growth} columns={[
  ['depth','Question number',v=>String(v)],['questions','Questions',num],['conversations','Chats',num],['calls','Model calls',num],['mean_input_tokens','Avg input',num],['mean_output_tokens','Avg output',num],['p95_input_tokens','95th percentile input',num],['mean_prompt_tokens','Avg prompt size*',num],['mean_history_tokens','Avg retained history*',num],
 ]}/>
 <UsageTable title="Prompt size & request complexity" rows={report.complexity} columns={[
  ['prompt_band','Prompt size*',v=>String(v)],['workload','Request type',v=>String(v)],['questions','Questions',num],['calls','Model calls',num],['mean_input_tokens','Avg input',num],['mean_output_tokens','Avg output',num],['p95_input_tokens','95th percentile input',num],
 ]}/>
 <p className="text-sm text-ink-muted">* Prompt size and retained history are estimated text-token counts. Files and enabled tools are observable complexity indicators, not a semantic difficulty score. No prompt text, file names, URLs or chat titles are stored in these measurements.</p>
 <UsageTable title="Token usage by user (up to 200; select an ID to filter)" rows={report.users} columns={[
  ['user_id','User ID',userLink],['conversations','Chats',num],['calls','Calls',num],['input_tokens','Input tokens',num],['output_tokens','Output tokens',num],['cached_tokens','Cached input',num],['unknown_usage_calls','Unreported usage',num],['cost_usd_micros','Recorded cost',money],
 ]}/>{Number(s.users)>200&&<p className="text-sm text-ink-muted">Showing the 200 users with the most reported input tokens. Totals include all users; paste a user ID above to inspect someone outside this list.</p>}
 </>}
 </section>;
}
