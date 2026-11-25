import { createClient } from "@supabase/supabase-js";

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function supabaseConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) {
    throw new ApiError("Supabase не настроен. Заполните .env.local по примеру .env.example и перезапустите сервер.", 503);
  }
  let parsed;
  try { parsed = new URL(url); } catch { throw new ApiError("Проверьте NEXT_PUBLIC_SUPABASE_URL в .env.local.", 503); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new ApiError("Проверьте NEXT_PUBLIC_SUPABASE_URL в .env.local.", 503);
  }
  return { url, publicKey, secretKey };
}

export function isSupabaseConfigured() {
  try { supabaseConfig(); return true; } catch { return false; }
}

function client(key) {
  const config = supabaseConfig();
  return createClient(config.url, config[key], {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// A fresh Auth client prevents sessions from being shared between requests.
export function getSupabaseAuth() { return client("publicKey"); }
export function getSupabaseAdmin() { return client("secretKey"); }
