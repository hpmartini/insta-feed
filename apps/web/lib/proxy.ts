import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { stripHtml } from "@instafeed/shared";
import { HttpError } from "./errors";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

type Lookup = (host: string) => Promise<string[]>;
const resolveAll: Lookup = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v6.match(/^(?:::ffff:|64:ff9b::)(.+)$/); // IPv4-mapped / NAT64
  if (mapped) {
    const rest = mapped[1]!;
    if (isIP(rest) === 4) return privateV4(rest);
    const hex = rest.split(":").map((h) => parseInt(h, 16));
    if (hex.length === 2 && hex.every((n) => n >= 0 && n <= 0xffff)) return privateV4(`${hex[0]! >> 8}.${hex[0]! & 255}.${hex[1]! >> 8}.${hex[1]! & 255}`);
    return true;
  }
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith("ff");
}

/**
 * SSRF guard: http(s) only, and every address the host resolves to must be public.
 * shortcut: checked before fetch, not pinned to the connection, so DNS rebinding is not fully closed; pin the resolved IP if this is ever hosted publicly.
 */
export async function assertPublicUrl(raw: string, resolve: Lookup = resolveAll): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Ungültige URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(400, "Nur http(s)-URLs erlaubt");
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpError(400, "Interne Adressen sind nicht erlaubt");
  }
  let addrs: string[];
  try {
    addrs = isIP(host) ? [host] : await resolve(host);
  } catch {
    throw new HttpError(502, "Host nicht auflösbar");
  }
  if (!addrs.length || addrs.some(isPrivateIp)) throw new HttpError(400, "Interne Adressen sind nicht erlaubt");
  return url;
}

export interface SafeFetchOptions {
  fetch?: typeof fetch;
  resolve?: Lookup;
  accept?: string;
}

/** GET with SSRF guard on every redirect hop, 10 s timeout and a 2 MB body cap. */
export async function safeFetchText(raw: string, opts: SafeFetchOptions = {}): Promise<{ text: string; url: string }> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, opts.resolve);
    let res: Response;
    try {
      res = await doFetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "InstaFeed/1.0", accept: opts.accept ?? "*/*" },
      });
    } catch (e) {
      throw new HttpError(504, e instanceof Error && e.name === "TimeoutError" ? "Zeitüberschreitung" : "Abruf fehlgeschlagen");
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, url).href;
      continue;
    }
    if (!res.ok) throw new HttpError(502, `Quelle antwortete mit HTTP ${res.status}`);
    return { text: await readCapped(res), url: url.href };
  }
  throw new HttpError(502, "Zu viele Weiterleitungen");
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new HttpError(502, "Antwort zu groß");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface Article {
  title: string;
  siteName: string;
  excerpt: string;
  /** plain-text paragraphs: Readability's HTML is never rendered, so nothing from the source page can inject markup */
  paragraphs: string[];
}

export function extractArticle(html: string): Article {
  const { document } = parseHTML(html);
  const parsed = new Readability(document as unknown as Document).parse();
  let paragraphs: string[] = [];
  if (parsed?.content) {
    const frag = parseHTML(`<div>${parsed.content}</div>`).document;
    paragraphs = [...frag.querySelectorAll("p, h2, h3, h4, li, blockquote")].map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  // Extraction failed: still usable as one block of text.
  if (!paragraphs.length) {
    const body = stripHtml(html);
    paragraphs = body ? [body.slice(0, 20_000)] : [];
  }
  return {
    title: parsed?.title || document.title || "",
    siteName: parsed?.siteName || "",
    excerpt: parsed?.excerpt || "",
    paragraphs,
  };
}

export async function loadArticle(url: string, opts?: SafeFetchOptions): Promise<Article> {
  return extractArticle((await safeFetchText(url, { accept: "text/html,application/xhtml+xml", ...opts })).text);
}
