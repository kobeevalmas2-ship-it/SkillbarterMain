import test from "node:test";
import assert from "node:assert/strict";
import { emailConfirmationRedirect, siteOrigin } from "../lib/server/site-url.mjs";

const request = new Request("https://spoofed.example/api/auth", { headers: { "x-forwarded-host": "attacker.example" } });

test("email links use the configured production URL instead of request or proxy headers", () => {
  const env = { NODE_ENV: "production", SITE_URL: "https://skillbarter.example/", VERCEL_URL: "preview.vercel.app" };
  assert.equal(siteOrigin(request, env), "https://skillbarter.example");
  const redirect = new URL(emailConfirmationRedirect(request, "/services?create=1", env));
  assert.equal(redirect.origin, "https://skillbarter.example");
  assert.equal(redirect.pathname, "/auth/callback");
  assert.equal(redirect.searchParams.get("next"), "/services?create=1");
  assert.equal(new URL(emailConfirmationRedirect(request, "//attacker.example", env)).searchParams.get("next"), "/");
});

test("Vercel system URLs work without a hardcoded host and production needs a trusted origin", () => {
  assert.equal(siteOrigin(request, { NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "skillbarter.vercel.app", VERCEL_URL: "preview.vercel.app" }), "https://skillbarter.vercel.app");
  assert.equal(siteOrigin(request, { NODE_ENV: "production", VERCEL_URL: "preview.vercel.app" }), "https://preview.vercel.app");
  assert.throws(() => siteOrigin(request, { NODE_ENV: "production" }), { status: 503 });
  assert.equal(new URL(emailConfirmationRedirect(request, null, { SITE_URL: "https://skillbarter.example" })).searchParams.get("next"), "/day");
});

test("site configuration rejects insecure origins, credentials and unexpected URL parts", () => {
  for (const SITE_URL of ["http://skillbarter.example", "https://user:pass@skillbarter.example", "https://skillbarter.example/path", "https://skillbarter.example/?next=bad", "https://skillbarter.example/#bad", "javascript:alert(1)", "not-a-url", "http://localhost:3000"]) {
    assert.throws(() => siteOrigin(request, { NODE_ENV: "production", SITE_URL }), { status: 503 }, SITE_URL);
  }
  assert.equal(siteOrigin(new Request("http://localhost:3007/api/auth"), { NODE_ENV: "development" }), "http://localhost:3007");
});
