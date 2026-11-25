import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, supabaseConfig } from "../lib/server/supabase.mjs";
import { assertSameOrigin, jsonError, readJson } from "../lib/server/http.mjs";

test("Supabase config requires server credentials and accepts the legacy key names", () => {
  assert.throws(() => supabaseConfig({}), { status: 503 });
  const config = supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "private" });
  assert.deepEqual(config, { url: "https://example.supabase.co", publicKey: "public", secretKey: "private" });
  assert.throws(() => supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://user:password@example.com", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public", SUPABASE_SECRET_KEY: "private" }), { status: 503 });
});

test("mutating API routes reject cross-site requests even with session cookies", () => {
  const request = (headers) => new Request("https://skillbarter.example/api/state", { method: "POST", headers });
  assert.doesNotThrow(() => assertSameOrigin(request({ origin: "https://skillbarter.example" })));
  assert.doesNotThrow(() => assertSameOrigin(request({ "sec-fetch-site": "same-origin" })));
  assert.throws(() => assertSameOrigin(request({ origin: "https://attacker.example", cookie: "skillbarter-access=token" })), { status: 403 });
  assert.throws(() => assertSameOrigin(request({ origin: "https://skillbarter.example", "sec-fetch-site": "cross-site" })), { status: 403 });
  assert.throws(() => assertSameOrigin(request({})), { status: 403 });
});

test("JSON bodies enforce format, shape and size before business actions", async () => {
  const request = (body, type = "application/json") => new Request("https://skillbarter.example/api/state", { method: "POST", headers: { "Content-Type": type }, body });
  assert.deepEqual(await readJson(request('{"action":"request.read"}')), { action: "request.read" });
  await assert.rejects(readJson(request("null")), { status: 400 });
  await assert.rejects(readJson(request("[]")), { status: 400 });
  await assert.rejects(readJson(request("{")), { status: 400 });
  await assert.rejects(readJson(request("{}", "text/plain")), { status: 415 });
  await assert.rejects(readJson(request(JSON.stringify({ avatar: "a".repeat(2 * 1024 * 1024) }))), { status: 413 });
});

test("API responses are never cached and conceal infrastructure details", async () => {
  const internal = Object.assign(new Error("connection password=secret host=private"), { status: 503 });
  const response = jsonError(internal);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.doesNotMatch(JSON.stringify(await response.json()), /password|secret|private/);
  const validation = jsonError(new ApiError("Недостаточно минут.", 409));
  assert.equal(validation.status, 409);
  assert.deepEqual(await validation.json(), { error: "Недостаточно минут." });
});
