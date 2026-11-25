import test from "node:test";
import assert from "node:assert/strict";
import { confirmationTokens, EMAIL_CONFIRMATION_ERROR, parseEmailConfirmationHash } from "../lib/auth-confirmation.mjs";

const tokens = { access_token: "signed.access.token", refresh_token: "refresh-token" };
const fragment = (type = "signup") => `#${new URLSearchParams({ ...tokens, type, token_type: "bearer", expires_in: "3600" })}`;

test("signup and email fragments yield only the server session token pair", () => {
  for (const type of ["signup", "email"]) assert.deepEqual(parseEmailConfirmationHash(fragment(type)), tokens);
  assert.deepEqual(confirmationTokens({ ...tokens, next: "https://attacker.example", role: "admin" }), tokens);
});

test("confirmation refuses missing, malformed, oversized and duplicated token values", () => {
  for (const values of [null, undefined, [], {}, { access_token: tokens.access_token }, { ...tokens, access_token: "" },
    { ...tokens, refresh_token: " " }, { ...tokens, access_token: "token\nvalue" },
    { ...tokens, refresh_token: "x".repeat(16385) }, { ...tokens, access_token: 42 }]) {
    assert.throws(() => confirmationTokens(values), { message: EMAIL_CONFIRMATION_ERROR });
  }
  for (const hash of [undefined, "", "#", fragment().slice(1), `${fragment()}&access_token=second`, `${fragment()}&type=email`, `#${"x".repeat(34001)}`]) {
    assert.throws(() => parseEmailConfirmationHash(hash), { message: EMAIL_CONFIRMATION_ERROR });
  }
});

test("expired links and recovery or unrelated auth flows never become signup sessions", () => {
  for (const type of ["recovery", "invite", "magiclink", "email_change", "", "SIGNUP"]) {
    assert.throws(() => parseEmailConfirmationHash(fragment(type)), { message: EMAIL_CONFIRMATION_ERROR });
  }
  for (const suffix of ["&error=access_denied", "&error_code=otp_expired", "&error_description=secret-provider-detail", "&token_type=other"]) {
    assert.throws(() => parseEmailConfirmationHash(`${fragment()}${suffix}`), { message: EMAIL_CONFIRMATION_ERROR });
  }
});

test("parser errors never expose a token or provider error description", () => {
  try {
    parseEmailConfirmationHash(`${fragment()}&error_description=sensitive-detail`);
    assert.fail("an invalid fragment must throw");
  } catch (error) {
    assert.equal(error.message, EMAIL_CONFIRMATION_ERROR);
    assert.doesNotMatch(error.message, /signed\.access\.token|refresh-token|sensitive-detail/);
  }
});
