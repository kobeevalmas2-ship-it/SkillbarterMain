import test from "node:test";
import assert from "node:assert/strict";
import { consumeOfferCreationIntent, safeAuthNext } from "../lib/auth-navigation.mjs";

test("login preserves allowed destinations, including profile and offer creation", () => {
  for (const value of ["/day", "/notifications", "/requests", "/requests/lesson-123", "/profile", "/services?create=1", "/favorites", "/wallet?tab=history", "/offers/lesson-123", "/offers/figma-basics?returnTo=%2Ffind%3Fq%3DFigma", "/find?cat=Design#results", "/"]) {
    assert.equal(safeAuthNext(value), value);
  }
});

test("login rejects external destinations and malformed or unknown paths", () => {
  for (const value of [null, undefined, {}, "https://example.com", "//example.com/profile", "/\\example.com", "/profile\n", "/profile/extra", "/admin", "/offers/", "/%2f%2fexample.com", "javascript:alert(1)"]) {
    assert.equal(safeAuthNext(value), "/", String(value));
  }
});

test("offer creation intent is consumed once only for a signed-in user on services", () => {
  const href = "https://skillbarter.example/services?create=1&tab=mine#offers";
  assert.equal(consumeOfferCreationIntent(href, false), null);
  const consumed = consumeOfferCreationIntent(href, true);
  assert.equal(consumed, "/services?tab=mine#offers");
  assert.equal(consumeOfferCreationIntent(`https://skillbarter.example${consumed}`, true), null);
  assert.equal(consumeOfferCreationIntent("https://skillbarter.example/profile?create=1", true), null);
  assert.equal(consumeOfferCreationIntent("https://skillbarter.example/services?create=0", true), null);
});
