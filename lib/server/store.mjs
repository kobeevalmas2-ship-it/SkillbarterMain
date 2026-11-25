import { getSupabaseAdmin } from "./supabase.mjs";
import { applyAction, filterSnapshot, initializeState } from "./domain.mjs";

function databaseError() {
  const error = new Error("Не удалось обратиться к базе данных. Проверьте подключение Supabase и применение миграции.");
  error.status = 503;
  return error;
}

async function loadProfiles(client) {
  // Supabase limits individual responses; page through the complete directory.
  const people = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("profiles").select("id,email,name,role").order("id").range(from, from + 999);
    if (error || !data) throw databaseError();
    people.push(...data);
    if (data.length < 1000) return people;
  }
}

async function loadState(client) {
  const { data, error } = await client.from("application_state").select("revision,state").eq("id", 1).single();
  if (error || !data || data.state?.version !== 1 || !data.state.ledger || !data.state.catalog || !Array.isArray(data.state.reviews)) throw databaseError();
  return data;
}

export async function updateState(actor, command = null, client = getSupabaseAdmin()) {
  const participants = await loadProfiles(client);
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 12; attempt++) {
    const { revision, state } = await loadState(client);
    const next = command ? applyAction(state, actor, command, participants, now) : initializeState(state, actor, participants, now);
    if (next === state) return filterSnapshot(state, actor, participants);
    const { data, error } = await client.rpc("skillbarter_commit_state", { p_revision: revision, p_state: next });
    if (error) throw databaseError();
    if (data === true) return filterSnapshot(next, actor, participants);
    if (data !== false) throw databaseError();
    // A concurrent server committed first. Re-check balances and reservations
    // against the latest snapshot instead of overwriting that server's work.
  }
  const error = new Error("Данные сейчас обновляются другим участником. Повторите действие.");
  error.status = 409;
  throw error;
}

export function readSnapshot(actor = null) { return updateState(actor); }
