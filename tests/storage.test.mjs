import test from "node:test";
import assert from "node:assert/strict";
import { readSnapshot, STORAGE_KEY } from "../src/storage.js";
import { emptyData } from "../src/core.js";

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
test("original HTML storage envelopes remain readable", () => {
  const data = emptyData();
  data.customers.push({ id: "old", name: "Existing customer" });
  memory.set(STORAGE_KEY, JSON.stringify({ data: JSON.stringify(data), version: 8 }));
  assert.deepEqual(readSnapshot(), { data, version: 8 });
});
test("corrupt storage is rejected without overwriting it", () => {
  for (const broken of ["{", '{"data":{},"version":1}', '{"data":{"phones":[],"customers":[],"sales":[],"payments":[]},"version":-1}']) {
    memory.set(STORAGE_KEY, broken);
    assert.throws(readSnapshot);
    assert.equal(memory.get(STORAGE_KEY), broken);
  }
});
test("a new browser starts with empty inventory", () => {
  memory.clear();
  assert.deepEqual(readSnapshot(), { data: emptyData(), version: 0 });
});
