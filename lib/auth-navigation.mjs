// Only known application pages may be used as a post-login destination.
export function safeAuthNext(value) {
  if (typeof value !== "string" || /[\\\u0000-\u0020\u007f]/.test(value) || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://skillbarter.invalid");
    if (url.origin !== "https://skillbarter.invalid") return "/";
    if (!/^\/(?:wallet|services|favorites|profile|find|day|notifications|requests(?:\/[a-zA-Z0-9-]+)?|offers\/[a-zA-Z0-9-]+)?$/.test(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function consumeOfferCreationIntent(href, signedIn) {
  if (!signedIn) return null;
  const url = new URL(href);
  if (url.pathname !== "/services" || url.searchParams.get("create") !== "1") return null;
  url.searchParams.delete("create");
  return `${url.pathname}${url.search}${url.hash}`;
}
