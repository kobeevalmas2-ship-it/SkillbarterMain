import { ApiError, getSupabaseAdmin, getSupabaseAuth, isSupabaseConfigured } from "@/lib/server/supabase.mjs";
import { accessToken, authError, clearSessionCookies, profileForUser, requireActor, setSessionCookies } from "@/lib/server/auth.mjs";
import { assertSameOrigin, jsonError, PRIVATE_HEADERS, readJson } from "@/lib/server/http.mjs";
import { updateAccountProfile } from "@/lib/admin-auth.mjs";
import { confirmationTokens, EMAIL_CONFIRMATION_ERROR } from "@/lib/auth-confirmation.mjs";
import { emailConfirmationRedirect } from "@/lib/server/site-url.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isSupabaseConfigured()) return Response.json({ user: null, configured: false,
    error: "Supabase не настроен. Заполните .env.local по примеру .env.example и перезапустите сервер." }, { headers: PRIVATE_HEADERS });
  try { return Response.json({ user: await requireActor(request, { optional: true }), configured: true }, { headers: PRIVATE_HEADERS }); }
  catch (error) { return jsonError(error); }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const { action, values } = await readJson(request);
    if (!["login", "register", "confirm"].includes(action) || !values || typeof values !== "object" || Array.isArray(values)) throw new ApiError("Неизвестное действие.");
    const auth = getSupabaseAuth();
    if (action === "confirm") {
      const tokens = confirmationTokens(values);
      let result;
      try { result = await auth.auth.setSession(tokens); }
      catch { throw new ApiError(EMAIL_CONFIRMATION_ERROR, 400); }
      if (result?.error || !result?.data?.session || !result.data.user) throw new ApiError(EMAIL_CONFIRMATION_ERROR, 400);
      confirmationTokens(result.data.session);
      const user = await profileForUser(result.data.user);
      await setSessionCookies(result.data.session);
      return Response.json({ user }, { headers: PRIVATE_HEADERS });
    }
    const email = String(values.email || "").trim().toLowerCase();
    const password = values.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError("Введите корректный адрес электронной почты.");
    if (typeof password !== "string" || password.length < 6 || password.length > 1024) throw new ApiError("Пароль должен содержать от 6 до 1024 символов.");
    let result;
    if (action === "register") {
      const name = String(values.name || "").trim();
      if (name.length < 2 || name.length > 50) throw new ApiError("Имя должно содержать от 2 до 50 символов.");
      result = await auth.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: emailConfirmationRedirect(request, values.next) } });
    } else result = await auth.auth.signInWithPassword({ email, password });
    if (result.error) throw authError(result.error);
    if (!result.data.session) return Response.json({ user: null, requiresEmailConfirmation: true }, { headers: PRIVATE_HEADERS });
    const user = await profileForUser(result.data.user);
    await setSessionCookies(result.data.session);
    return Response.json({ user }, { headers: PRIVATE_HEADERS });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    if (request.headers.get("x-skillbarter-actor") !== actor.id) throw new ApiError("Аккаунт изменился. Обновите страницу.", 409);
    const changes = await readJson(request);
    const next = updateAccountProfile(actor, changes);
    const profile = { city: next.city, about: next.about, skills: next.skills, avatar: next.avatar };
    const { error } = await getSupabaseAdmin().from("profiles").update({ name: next.name, profile }).eq("id", actor.id);
    if (error) throw new ApiError("Не удалось сохранить профиль в Supabase. Попробуйте ещё раз.", 503);
    return Response.json({ user: { ...actor, ...profile, name: next.name } }, { headers: PRIVATE_HEADERS });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request) {
  try {
    assertSameOrigin(request);
    if (isSupabaseConfigured()) {
      const actor = await requireActor(request, { optional: true });
      if (actor && request.headers.get("x-skillbarter-actor") !== actor.id) throw new ApiError("Аккаунт изменился. Обновите страницу.", 409);
      // requireActor may have refreshed an expired/missing access cookie.
      const token = await accessToken();
      if (actor && token) {
        const { error } = await getSupabaseAdmin().auth.admin.signOut(token, "local");
        if (error && error.status !== 401 && error.status !== 403 && error.status !== 404) {
          throw new ApiError("Не удалось завершить сессию. Попробуйте ещё раз.", 503);
        }
      }
    }
    await clearSessionCookies();
    return Response.json({ user: null }, { headers: PRIVATE_HEADERS });
  } catch (error) { return jsonError(error); }
}
