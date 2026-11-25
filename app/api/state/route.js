import { requireActor } from "@/lib/server/auth.mjs";
import { assertSameOrigin, jsonError, PRIVATE_HEADERS, readJson } from "@/lib/server/http.mjs";
import { readSnapshot, updateState } from "@/lib/server/store.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  try {
    const actor = await requireActor(request, { optional: true });
    return Response.json(await readSnapshot(actor), { headers: PRIVATE_HEADERS });
  } catch (error) { return jsonError(error); }
}

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const command = await readJson(request);
    if (command.expectedActorId !== actor.id) {
      const error = new Error("Аккаунт изменился. Обновите страницу.");
      error.status = 409;
      throw error;
    }
    return Response.json(await updateState(actor, command), { headers: PRIVATE_HEADERS });
  } catch (error) { return jsonError(error); }
}
