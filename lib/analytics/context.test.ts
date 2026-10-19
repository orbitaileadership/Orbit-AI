import { expect, it } from 'vitest';
import { usageContext } from './context';
import { estimateTokens } from '@/lib/chat/context';
it('stores only derived sizes and server identifiers, never private text or arbitrary properties',()=>{
 const result=usageContext({userMessageId:'server-message',question:'private latest prompt',turns:[{role:'user',content:'private prior prompt'},{role:'assistant',content:'private prior answer'},{role:'user',content:'private latest prompt'}],system:'private files and instructions',toolTokens:100,visualTokens:2000,hasFiles:true,hasTools:true,retry:false,continuation:true,...{email:'private@example.test',title:'private title'}});
 expect(result).toEqual({version:1,userMessageId:'server-message',promptTokens:estimateTokens('private latest prompt'),historyTokens:estimateTokens('private prior prompt')+estimateTokens('private prior answer'),systemTokens:estimateTokens('private files and instructions'),toolTokens:100,visualTokens:2000,hasFiles:true,hasTools:true,phase:'tool'});
 expect(JSON.stringify(result)).not.toMatch(/private|content|email|title/);
});
it('treats a first question as zero retained history and distinguishes retries',()=>{
 const base={userMessageId:'id',question:'Hello',turns:[{role:'user' as const,content:'Hello'}],system:'System',toolTokens:0,visualTokens:0,hasFiles:false,hasTools:false,retry:false,continuation:false};
 expect(usageContext(base)).toMatchObject({historyTokens:0,phase:'initial'});
 expect(usageContext({...base,retry:true})).toMatchObject({phase:'retry'});
});
