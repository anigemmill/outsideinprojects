/*
  Where to send someone after signing in. Only paths on this site are allowed, so a crafted link
  (?next=https://evil.example) can't turn the sign-in page into an open redirect.
*/
export const DEFAULT_AFTER_SIGN_IN = "/account";

export function safeNext(next: string | null | undefined, fallback = DEFAULT_AFTER_SIGN_IN): string {
  if (!next) return fallback;
  // Must be a single-slash absolute path. Rejects "//host", "/\\host", schemes and control characters.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://same-origin.invalid");
    if (url.origin !== "http://same-origin.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
