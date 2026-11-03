import { beforeEach, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
const state = vi.hoisted(() => ({ fake: null as ReturnType<typeof fakeSupabase> | null, denied: false }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), requireAppUser: async () => state.denied ? { error: Response.json({error:"not_signed_in"}, {status:401}) } : ({ user: { id: "u" }, supabase: state.fake!.client }) }));
import { GET } from "./route";
import { PATCH } from "./[id]/route";
const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const ctx = (value = id) => ({ params: Promise.resolve({ id: value }) });
const req = (body: unknown) => new Request("http://localhost/api/conversations/" + id, { method: "PATCH", body: JSON.stringify(body) });
beforeEach(() => {
  state.denied = false;
  state.fake = fakeSupabase({ conversations: [
    { id, user_id: "u", title: "Study", provider: "openai", orbit_mode: false, archived: false },
    { id: other, user_id: "other", provider: "openai", orbit_mode: false, archived: true },
    { id: "orbit", user_id: "u", provider: "openai", orbit_mode: true, archived: true },
  ], messages: [{ id: "message", conversation_id: id, content: "Synthetic" }], files: [{ id: "file", conversation_id: id }] });
});
it("archives and restores without changing messages or files", async () => {
  const list = async (archived = false) => (await (await GET(new Request(`http://localhost/api/conversations?provider=openai&archived=${archived}`))).json()).conversations;
  expect(await list()).toHaveLength(1);
  expect((await PATCH(req({ archived: true }), ctx())).status).toBe(200);
  expect(await list()).toHaveLength(0); expect(await list(true)).toHaveLength(1);
  expect(state.fake!.db.messages).toHaveLength(1); expect(state.fake!.db.files).toHaveLength(1);
  expect((await PATCH(req({ archived: false }), ctx())).status).toBe(200);
  expect(await list()).toHaveLength(1); expect(await list(true)).toHaveLength(0);
});
it("keeps ordinary and Orbit archives separate", async () => {
  const res = await GET(new Request("http://localhost/api/conversations?provider=orbit&archived=true"));
  expect((await res.json()).conversations.map((c: {id: string}) => c.id)).toEqual(["orbit"]);
});
it("denies unauthenticated requests and hides foreign or missing records", async () => {
  expect((await PATCH(req({ archived: false }), ctx(other))).status).toBe(404);
  expect(state.fake!.db.conversations[1].archived).toBe(true);
  expect((await PATCH(req({ archived: true }), ctx("33333333-3333-4333-8333-333333333333"))).status).toBe(404);
  state.denied = true;
  expect((await PATCH(req({ archived: true }), ctx())).status).toBe(401);
  expect((await GET(new Request("http://localhost/api/conversations?provider=openai"))).status).toBe(401);
});
it("rejects invalid patches, IDs and pagination", async () => {
  for (const value of [null, [], { archived: "true" }, { archived: 1 }, {}]) expect((await PATCH(req(value), ctx())).status).toBe(400);
  expect((await PATCH(req({ archived: true }), ctx("bad"))).status).toBe(404);
  for (const offset of ["-1", "NaN", "0.5", "1000001"]) expect((await GET(new Request(`http://localhost/api/conversations?provider=openai&offset=${offset}`))).status).toBe(400);
});

it("paginates archives without hiding older restorable chats", async () => {
  state.fake!.db.conversations = Array.from({length:201}, (_, index) => ({id:String(index), user_id:'u',provider:'openai',orbit_mode:false,archived:true}));
  const first = await (await GET(new Request('http://localhost/api/conversations?provider=openai&archived=true'))).json();
  const next = await (await GET(new Request('http://localhost/api/conversations?provider=openai&archived=true&offset=200'))).json();
  expect(first.conversations).toHaveLength(200);expect(next.conversations).toHaveLength(1);
  expect(first.conversations.some((c:{id:string})=>c.id===next.conversations[0].id)).toBe(false);
});

it('returns restored older chats to Recents even with 200 newer active chats', async () => {
  state.fake!.db.conversations = Array.from({length:200}, (_, index) => ({id:'new'+index,user_id:'u',provider:'openai',orbit_mode:true,archived:false,updated_at:'2025-01-01T00:00:00Z'}));
  state.fake!.db.conversations.push({id,user_id:'u',provider:'openai',orbit_mode:true,archived:true,updated_at:'2024-01-01T00:00:00Z',section_folder_id:'section'});
  const response=await PATCH(req({archived:false}),ctx());
  expect(response.status).toBe(200);
  const result=await response.json();expect(result.updatedAt > '2025-01-01T00:00:00Z').toBe(true);
  const list=await (await GET(new Request('http://localhost/api/conversations?provider=orbit'))).json();
  expect(list.conversations).toHaveLength(200);expect(list.conversations[0]).toMatchObject({id,sectionFolderId:'section',updatedAt:result.updatedAt});
});
