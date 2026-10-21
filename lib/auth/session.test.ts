import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:mocks.user}})}));
import { getUserAccess } from './session';
describe('post-login workspace eligibility',()=>{
 beforeEach(()=>{vi.stubEnv('WAITLIST_MODE','on');vi.stubEnv('EARLY_ACCESS_EMAILS','tester@uwo.ca,friend@gmail.com');vi.stubEnv('OPEN_SIGNUP','');});
 afterEach(()=>vi.unstubAllEnvs());
 it.each([
  ['tester@uwo.ca','2026-01-01','app'],
  ['student@uwo.ca','2026-01-01','waitlist'],
  ['tester@uwo.ca',null,null],
  ['tester@uwo.ca.evil.com','2026-01-01',null],
 ])('routes %s with confirmation %s to %s',async(email,confirmed,access)=>{mocks.user.mockResolvedValue({data:{user:{id:'test',email,email_confirmed_at:confirmed}},error:null});const result=await getUserAccess();expect(result?.access??null).toBe(access);});
 it('keeps non-school accounts out while open sign-up is off',async()=>{mocks.user.mockResolvedValue({data:{user:{id:'test',email:'friend@gmail.com',email_confirmed_at:'2026-01-01'}},error:null});expect(await getUserAccess()).toBeNull();});
 it.each([
  ['friend@gmail.com','2026-01-01','app'],
  ['stranger@hotmail.com','2026-01-01','waitlist'],
  ['friend@gmail.com',null,null],
 ])('with OPEN_SIGNUP=on routes %s (confirmed %s) to %s, still behind the waitlist',async(email,confirmed,access)=>{vi.stubEnv('OPEN_SIGNUP','on');mocks.user.mockResolvedValue({data:{user:{id:'test',email,email_confirmed_at:confirmed}},error:null});const result=await getUserAccess();expect(result?.access??null).toBe(access);});
 it('rejects an expired session',async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{message:'expired'}});expect(await getUserAccess()).toBeNull();});
});
