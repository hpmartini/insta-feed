import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type Resolver = (host: string) => Promise<string[]>;

export interface SafeFetchOptions {
  fetch?: typeof fetch;
  resolve?: Resolver;
  /** Total budget for DNS, redirects and body. */
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeResponse {
  status: number;
  /** Final URL after redirects. */
  url: string;
  contentType: string;
  text: string;
}

export class SafeFetchError extends Error {}

export const defaultResolve: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

const v4ToInt = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
const inV4Range = (n: number, [base, bits]: [string, number]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(v4ToInt(base) / 2 ** (32 - bits));

/** Expands any valid IPv6 text form into 8 numeric groups. */
function v6Groups(ip: string): number[] {
  let s = ip.split("%")[0]!;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail) {
    const n = v4ToInt(tail[1]!);
    s = s.slice(0, -tail[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, rest] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const r = rest ? rest.split(":") : [];
  const fill = rest === undefined ? [] : Array<string>(8 - h.length - r.length).fill("0");
  return [...h, ...fill, ...r].map((g) => parseInt(g, 16));
}

const groupsToV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !BLOCKED_V4.some((r) => inV4Range(v4ToInt(ip), r));
  if (kind !== 6) return false;
  const g = v6Groups(ip);
  // IPv4-mapped (::ffff:a.b.c.d): judge the embedded address.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicIp(groupsToV4(g[6]!, g[7]!));
  // 6to4 (2002::/16) embeds an IPv4 address too.
  if (g[0] === 0x2002) return isPublicIp(groupsToV4(g[1]!, g[2]!));
  // Only global unicast 2000::/3 is allowed; this drops ::, ::1, fc00::/7, fe80::/10, ff00::/8, NAT64, compat. Teredo and documentation ranges are carved out.
  if ((g[0]! & 0xe000) !== 0x2000) return false;
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0x0db8)) return false;
  return true;
}

const DEFAULTS = { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 3 };

/**
 * The only way the API talks to the outside world. Returns the fully bounded body so reading it cannot bypass the limits.
 * No cookies or credentials are sent; redirects are followed manually and every hop is re-validated.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const doFetch = opts.fetch ?? fetch;
  const resolve = opts.resolve ?? defaultResolve;
  const { timeoutMs, maxBytes, maxRedirects } = { ...DEFAULTS, ...opts };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const expired = new Promise<never>((_, reject) =>
    ctl.signal.addEventListener("abort", () => reject(new SafeFetchError("timeout")), { once: true }),
  );
  expired.catch(() => {}); // only observed through race()
  const race = <T>(p: Promise<T>) => Promise.race([p, expired]);

  try {
    let url = rawUrl;
    for (let hop = 0; ; hop++) {
      const target = await checkTarget(url, resolve, race);
      // shortcut: DNS wird vorab geprüft; fetch löst erneut auf. DNS-Rebinding bleibt möglich. Entfernung: Verbindung an geprüfte IP binden, Host und TLS-Zertifikatsprüfung erhalten.
      const res = await race(doFetch(target.href, { redirect: "manual", credentials: "omit", signal: ctl.signal }));
      if (res.status >= 300 && res.status < 400) {
        void res.body?.cancel().catch(() => {});
        const location = res.headers.get("location");
        if (!location) throw new SafeFetchError(`redirect ${res.status} without location`);
        if (hop >= maxRedirects) throw new SafeFetchError("too many redirects");
        url = new URL(location, target).href;
        continue;
      }
      return {
        status: res.status,
        url: target.href,
        contentType: res.headers.get("content-type") ?? "",
        text: await readBounded(res, maxBytes, race, ctl),
      };
    }
  } catch (e) {
    ctl.abort(); // stop any in-flight request or body
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

async function checkTarget(raw: string, resolve: Resolver, race: <T>(p: Promise<T>) => Promise<T>): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("invalid url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("only http(s) allowed");
  if (url.username || url.password) throw new SafeFetchError("credentials in url not allowed");
  // URL has already normalized hex/octal/decimal IPv4 forms; IPv6 literals keep their brackets.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : await race(resolve(host)).catch((e) => {
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError(`dns failed for ${host}`);
  });
  if (addrs.length === 0) throw new SafeFetchError(`dns returned no address for ${host}`);
  if (!addrs.every(isPublicIp)) throw new SafeFetchError("target address not allowed");
  return url;
}

async function readBounded(res: Response, maxBytes: number, race: <T>(p: Promise<T>) => Promise<T>, ctl: AbortController): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await race(reader.read());
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      ctl.abort();
      void reader.cancel().catch(() => {});
      throw new SafeFetchError("response too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
