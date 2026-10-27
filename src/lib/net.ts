import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Network dependencies, injectable so tests stay offline. */
export interface Net {
  fetch?: typeof fetch;
  /** Resolves a hostname to its IP addresses. */
  resolve?: (hostname: string) => Promise<string[]>;
}

const MAX_REDIRECTS = 5;

const dnsResolve = async (hostname: string) => (await lookup(hostname, { all: true })).map((a) => a.address);

/** Trust boundary: only http(s) URLs to non-internal host names may be fetched server-side. */
export function assertHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Ungültige URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Nur http(s)-URLs erlaubt: ${raw}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host) || (isIP(host) && isPrivateIp(host))) {
    throw new Error(`Interne Adressen sind nicht erlaubt: ${raw}`);
  }
  return url;
}

/** Loopback, private, link-local, CGNAT, unspecified, multicast/reserved, ULA and IPv4-mapped forms. */
export function isPrivateIp(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateIp(mapped[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6) || /^::ffff:/.test(v6);
}

/**
 * Fetches an untrusted URL: every redirect hop is re-validated and its host's resolved IPs must be public.
 * shortcut: the IP check and the connection resolve DNS separately (rebinding window); pin IPs via an egress proxy if exposed publicly.
 */
export async function safeFetch(raw: string, net: Net = {}): Promise<Response> {
  const doFetch = net.fetch ?? fetch;
  const resolve = net.resolve ?? dnsResolve;
  let url = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = assertHttpUrl(url);
    const host = target.hostname.replace(/^\[|\]$/g, "");
    const ips = isIP(host) ? [host] : await resolve(host);
    if (ips.length === 0 || ips.some(isPrivateIp)) throw new Error(`Interne Adressen sind nicht erlaubt: ${url}`);

    const res = await doFetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "InstaFeed/2.0" },
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return res;
    url = new URL(location, target).toString();
  }
  throw new Error(`Zu viele Weiterleitungen: ${raw}`);
}
