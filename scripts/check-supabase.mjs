import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Use the same .env.local loading rules as `next dev` without printing values.
nextEnv.loadEnvConfig(process.cwd(), true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const checkReports = process.argv.includes("--reports");

const reportTables = [
  ["reviews", "id"],
  ["wallet_transactions", "id"],
  ["wallet_balances", "email"],
  ["service_requests", "id"],
  ["complaints", "id"],
  ["service_offers", "id"],
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function check() {
  if (!url || !publicKey || !secretKey || url.includes("your-project")) {
    fail("Supabase не настроен. Заполните URL, публичный ключ и серверный ключ в .env.local по примеру .env.example.");
    return;
  }
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch {
    fail("Проверьте NEXT_PUBLIC_SUPABASE_URL: нужен HTTP(S) URL проекта Supabase.");
    return;
  }
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  };
  const admin = createClient(url, secretKey, options);

  // Read only: no users, rows, schemas, or settings are changed by this script.
  const checks = [
    ["серверный ключ / Auth", () => admin.auth.admin.listUsers({ page: 1, perPage: 1 })],
    ["публичный ключ / Auth", () => fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: publicKey }, signal: AbortSignal.timeout(15000),
    }).then((response) => ({ error: response.ok ? null : { status: response.status } }))],
    ["таблица profiles", () => admin.from("profiles").select("id").limit(1)],
    ["таблица application_state", () => admin.from("application_state").select("id,revision").eq("id", 1).single()],
    ...(checkReports ? reportTables.map(([table, column]) => [
      `таблица ${table}`, () => admin.from(table).select(column, { head: true, count: "exact" }),
    ]) : []),
  ];
  const results = await Promise.all(checks.map(([, run]) => run()));
  let failed = false;
  results.forEach((result, index) => {
    if (result.error) {
      failed = true;
      console.error(`Не прошла проверка: ${checks[index][0]}. Проверьте ключи и применение SQL-миграции.`);
    } else console.log(`OK: ${checks[index][0]}.`);
  });
  if (failed) process.exitCode = 1;
  else console.log("Подключение Supabase проверено. Секреты и содержимое базы не выводились.");
}

try { await check(); }
catch { fail("Не удалось связаться с Supabase. Проверьте URL проекта, доступ к сети и состояние проекта."); }
