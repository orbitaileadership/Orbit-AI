import { expect, it } from 'vitest';
import { getModel, defaultModelFor, type ProviderId } from '@/config/models';
import { costMicros, reservationMicros } from '@/lib/chat/context';
import { CONTEXT } from '@/config/context';

// Synthetic, reproducible comparison. No provider request is made. The historical
// defaults and 8k output cap were read from the October 26 baseline.
const baseline: Record<ProviderId,string> = {
  openai:'openai-default',anthropic:'anthropic-default',google:'google-default',xai:'xai-default',
};
it('reduces estimated ordinary-answer cost and reservation across all four app defaults',()=>{
  for (const provider of Object.keys(baseline) as ProviderId[]) {
    const old=getModel(baseline[provider])!, current=getModel(defaultModelFor(provider))!;
    const before=costMicros(old,{input:2000,output:1000});
    const after=costMicros(current,{input:2000,output:1000});
    const beforeHold=reservationMicros(old,2000,8000);
    const afterHold=reservationMicros(current,2000,CONTEXT.ordinaryOutputTokens);
    expect(after).toBeLessThan(before);
    expect(afterHold).toBeLessThan(beforeHold);
  }
});
