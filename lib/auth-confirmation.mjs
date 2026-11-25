export const EMAIL_CONFIRMATION_ERROR = "Ссылка подтверждения недействительна или устарела. Откройте последнее письмо или войдите, если адрес уже подтверждён.";

const validToken = (value) => typeof value === "string" && value.length > 0 && value.length <= 16384 && !/[\s\u0000-\u001f\u007f]/.test(value);

// Token pairs are accepted only in the POST body, never in a redirect query.
export function confirmationTokens(values) {
  if (!values || typeof values !== "object" || Array.isArray(values) ||
      !validToken(values.access_token) || !validToken(values.refresh_token)) {
    throw new Error(EMAIL_CONFIRMATION_ERROR);
  }
  return { access_token: values.access_token, refresh_token: values.refresh_token };
}

export function parseEmailConfirmationHash(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#") || hash.length > 34000) throw new Error(EMAIL_CONFIRMATION_ERROR);
  const params = new URLSearchParams(hash.slice(1));
  if (params.has("error") || params.has("error_code") || params.has("error_description") ||
      !["signup", "email"].includes(params.get("type")) ||
      (params.has("token_type") && params.get("token_type") !== "bearer") ||
      ["access_token", "refresh_token", "type", "token_type"].some((name) => params.getAll(name).length > 1)) {
    throw new Error(EMAIL_CONFIRMATION_ERROR);
  }
  return confirmationTokens({ access_token: params.get("access_token"), refresh_token: params.get("refresh_token") });
}
