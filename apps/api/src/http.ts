export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, { status, headers });

/** Only http(s) to public hosts; blocks the obvious SSRF targets (localhost, private IP literals). */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'Ungültige URL');
  }
  const host = url.hostname.toLowerCase();
  if (process.env.ALLOW_PRIVATE_URLS === "1") return url; // dev/e2e only
  // shortcut: literal-host check only, no DNS resolution; add resolve-and-check if exposed publicly
  const privateHost =
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '[::1]' ||
    /^(127|10|0)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!['http:', 'https:'].includes(url.protocol) || privateHost) throw new HttpError(400, 'URL nicht erlaubt');
  return url;
}
