import { cookies } from "next/headers";
import { ApiError, getSupabaseAdmin, getSupabaseAuth } from "./supabase.mjs";

const ACCESS_COOKIE = "skillbarter-access";
const REFRESH_COOKIE = "skillbarter-refresh";
const pendingRefreshes = new Map();

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });

export async function setSessionCookies(session) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.access_token, { ...cookieOptions(), maxAge: Math.max(60, session.expires_in || 3600) });
  jar.set(REFRESH_COOKIE, session.refresh_token, { ...cookieOptions(), maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) jar.set(name, "", { ...cookieOptions(), maxAge: 0 });
}

export async function accessToken() { return (await cookies()).get(ACCESS_COOKIE)?.value; }

function unavailable(error) {
  if (!error || error.status >= 500 || error.name === "AuthRetryableFetchError") {
    throw new ApiError("Сервис входа временно недоступен. Попробуйте ещё раз.", 503);
  }
}

export async function profileForUser(user) {
  const { data, error } = await getSupabaseAdmin().from("profiles")
    .select("id,email,name,profile,role").eq("id", user.id).single();
  if (error || !data) throw new ApiError("Не удалось открыть профиль. Проверьте миграцию Supabase и повторите вход.", 503);
  if (!user.email || data.email !== user.email.trim().toLowerCase()) {
    throw new ApiError("Профиль аккаунта не синхронизирован. Повторите вход.", 503);
  }
  const fields = data.profile || {};
  return {
    id: user.id, email: data.email, name: data.name,
    city: fields.city || "", about: fields.about || "",
    skills: Array.isArray(fields.skills) ? fields.skills : [], avatar: fields.avatar || "",
    role: data.role === "admin" && user.app_metadata?.role === "admin" ? "admin" : "user",
    verified: true,
  };
}

export async function requireActor(_request, { optional = false } = {}) {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) {
    if (optional) return null;
    throw new ApiError("Войдите в аккаунт.", 401);
  }
  const auth = getSupabaseAuth();
  if (access) {
    const { data, error } = await auth.auth.getUser(access);
    if (!error && data.user) return profileForUser(data.user);
    unavailable(error);
  }
  if (refresh) {
    let pending = pendingRefreshes.get(refresh);
    if (!pending) {
      pending = auth.auth.refreshSession({ refresh_token: refresh });
      pendingRefreshes.set(refresh, pending);
      pending.finally(() => pendingRefreshes.delete(refresh)).catch(() => {});
    }
    const { data, error } = await pending;
    if (!error && data.session && data.user) {
      await setSessionCookies(data.session);
      return profileForUser(data.user);
    }
    unavailable(error);
  }
  await clearSessionCookies();
  if (optional) return null;
  throw new ApiError("Сессия завершилась. Войдите снова.", 401);
}

export function authError(error) {
  const code = error?.code;
  if (code === "invalid_credentials") return new ApiError("Неверный адрес электронной почты или пароль.", 401);
  if (code === "email_not_confirmed") return new ApiError("Подтвердите адрес электронной почты по ссылке из письма.", 403);
  if (code === "user_already_exists") return new ApiError("Этот адрес электронной почты уже зарегистрирован. Войдите в аккаунт.", 409);
  if (code === "weak_password") return new ApiError("Пароль не соответствует требованиям безопасности Supabase.");
  if (code === "over_email_send_rate_limit" || error?.status === 429) return new ApiError("Слишком много попыток. Подождите и попробуйте снова.", 429);
  return new ApiError("Не удалось выполнить вход или регистрацию. Проверьте данные и настройки Supabase.", 400);
}
