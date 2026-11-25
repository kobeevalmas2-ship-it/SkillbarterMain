import { safeAuthNext } from "../auth-navigation.mjs";
import { ApiError } from "./supabase.mjs";

export function siteOrigin(request, env = process.env) {
  const configured = env.SITE_URL;
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const source = configured || (vercelHost ? `https://${vercelHost}` : env.NODE_ENV !== "production" ? new URL(request.url).origin : null);
  if (!source) throw new ApiError("Укажите публичный адрес сайта в переменной SITE_URL на хостинге.", 503);
  try {
    const url = new URL(source);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.NODE_ENV !== "production"))) throw new Error();
    return url.origin;
  } catch {
    throw new ApiError("Проверьте SITE_URL: нужен адрес сайта HTTPS без пути и параметров.", 503);
  }
}

export function emailConfirmationRedirect(request, next, env = process.env) {
  const url = new URL("/auth/callback", siteOrigin(request, env));
  url.searchParams.set("next", next ? safeAuthNext(next) : "/day");
  return url.href;
}
