import { ApiError } from "./supabase.mjs";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new ApiError("Запрос с другого сайта запрещён.", 403);
  }
  if (!origin && site !== "same-origin" && site !== "none") {
    throw new ApiError("Не удалось проверить источник запроса.", 403);
  }
}

export async function readJson(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError("Ожидается JSON.", 415);
  }
  const maxBytes = 2 * 1024 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Пустой запрос.");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new ApiError("Запрос слишком большой.", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Не удалось прочитать JSON.");
  } finally { reader.releaseLock(); }
}

export function jsonError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 400;
  const message = status >= 500 && !(error instanceof ApiError)
    ? "Сервис временно недоступен. Попробуйте ещё раз."
    : error?.message || "Не удалось выполнить действие.";
  return Response.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}
