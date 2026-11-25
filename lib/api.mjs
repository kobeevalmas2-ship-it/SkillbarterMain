export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    ...(options.body && typeof options.body !== "string" ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Не удалось связаться с сервером. Попробуйте ещё раз.");
  if (!payload) throw new Error("Сервер вернул некорректный ответ.");
  return payload;
}
