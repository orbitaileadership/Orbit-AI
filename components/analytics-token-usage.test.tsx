import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TokenUsage} from './analytics-token-usage';
import {tokenUsageFixture} from '@/test/analytics-fixture';
it('shows growth, observed complexity, sample counts, filters and per-user drilldown',()=>{
 const html=renderToStaticMarkup(<TokenUsage report={tokenUsageFixture}/>);
 for(const text of ['How usage changes','Prompt size &amp; request complexity','Files + tools','not a semantic difficulty score','150 of 160','5 calls have unreported usage','name="model"','name="user"','role="img"','retained history','user=11111111-1111-4111-8111-111111111111'])expect(html).toContain(text);
});
it('distinguishes no measured data from an unavailable migration and does not invent zero totals',()=>{
 const empty=renderToStaticMarkup(<TokenUsage report={{...tokenUsageFixture,summary:{calls:0},growth:[],complexity:[],users:[]}}/>);
 expect(empty).toContain('No data');expect(empty).toContain('Growth measurements start');expect(empty).not.toContain('NaN');
 const unavailable=renderToStaticMarkup(<TokenUsage report={null}/>);expect(unavailable).toContain('migration 0017');
});
