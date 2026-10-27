/** Feed links are untrusted: only http(s) may end up in an href (blocks javascript: URLs). */
export function safeHref(link: string): string | undefined {
  return /^https?:\/\//i.test(link) ? link : undefined;
}

export const formatDate = (iso: string) =>
  iso.startsWith("1970") ? "" : new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
