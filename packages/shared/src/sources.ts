import type { Source } from "./schemas";

/** Host lowercased by URL parsing; path/query case kept; unparsable URLs (e.g. `#`) match only on name+url. */
function key(s: Source): string {
  try {
    const u = new URL(s.url);
    u.hash = "";
    return u.href;
  } catch {
    return `raw:${s.name}|${s.url}`;
  }
}

/** Origin sources first, then extras; first occurrence wins (keeps origin). Inputs untouched. */
export function mergeSources(origin: Source[] = [], extra: Source[] = []): Source[] {
  const seen = new Set<string>();
  return [...origin, ...extra].filter((s) => !seen.has(key(s)) && !!seen.add(key(s))).map((s) => ({ ...s }));
}
