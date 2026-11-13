import test, { after } from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "../src/core.js";

let handler;
const originalFetch = globalThis.fetch;
globalThis.Deno = { env: { get: (key) => ({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_PUBLISHABLE_KEYS: '{"default":"test-public-key"}' })[key] }, serve: (fn) => { handler = fn; } };
await import("../supabase/functions/atitai-api/index.ts");
after(() => { globalThis.fetch = originalFetch; delete globalThis.Deno; });
const request = (body) => new Request("https://test.supabase.co/functions/v1/atitai-api", {
  method: body ? "POST" : "GET", headers: { Authorization: "Bearer test-user-token", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
});
function api(rows, writeRows) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, "Bearer test-user-token");
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "test-owner" });
    if (!options.method) return Response.json(rows);
    return Response.json(writeRows ?? [JSON.parse(options.body)]);
  };
  return calls;
}
test("edge API rejects unauthenticated requests and supports browser preflight", async () => {
  assert.equal((await handler(new Request("https://test.invalid"))).status, 401);
  const preflight = await handler(new Request("https://test.invalid", { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
});
test("cloud reads are scoped to the verified user", async () => {
  const calls = api([]);
  const result = await handler(request());
  assert.deepEqual(await result.json(), { data: emptyData(), version: 0 });
  assert.match(calls[1].url, /owner=eq.test-owner/);
});
test("cloud writes enforce the expected snapshot version", async () => {
  const calls = api([{ data: emptyData(), version: 3 }]);
  const result = await handler(request({ action: "customer", item: { name: "A", phone: "123" }, version: 2 }));
  assert.equal(result.status, 409);
  assert.equal(calls.length, 2);
});
test("new cloud records are owned by the verified user", async () => {
  const calls = api([]);
  const result = await handler(request({ action: "customer", item: { name: "A", phone: "123" }, version: 0 }));
  assert.equal(result.status, 200);
  const write = calls[2];
  assert.equal(write.options.method, "POST");
  assert.equal(JSON.parse(write.options.body).owner, "test-owner");
  assert.equal((await result.json()).version, 1);
});
test("concurrent updates produce a conflict without overwriting the winning update", async () => {
  const calls = api([{ data: emptyData(), version: 2 }], []);
  const result = await handler(request({ action: "customer", item: { name: "A", phone: "123" }, version: 2 }));
  assert.equal(result.status, 409);
  assert.equal(calls[2].options.method, "PATCH");
  assert.match(calls[2].url, /version=eq.2/);
});
test("cloud server validates business rules before writing", async () => {
  const calls = api([]);
  const result = await handler(request({ action: "phone", item: { model: "iPhone 13", imei: "short", cost: 1, price: 2, battery: 90 }, version: 0 }));
  assert.equal(result.status, 400);
  assert.equal(calls.length, 2);
});
