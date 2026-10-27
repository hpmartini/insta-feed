const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bdquo: "„",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** HTML -> plain text. Entities are decoded after the tags are gone, so "&lt;b&gt;" stays literal text. */
export function stripHtml(html: string): string {
  return decodeEntities(
    dropBlocks(dropBlocks(html, "script"), "style")
      .replace(/<[^<>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function firstSentences(text: string, n: number, maxChars = 600): string {
  const out = text.split(/(?<=[.!?])\s+/).slice(0, n).join(" ");
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}

/** Length-preserving lowercase (String#toLowerCase can change the length, which would break index maths). */
export const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** Drops <tag>…</tag> elements via indexOf: linear, unlike a lazy regex on unclosed tags in hostile input. */
function dropBlocks(html: string, tag: string): string {
  const lower = asciiLower(html);
  let out = "";
  for (let from = 0; ; ) {
    const start = lower.indexOf(`<${tag}`, from);
    if (start < 0) return out + html.slice(from);
    out += `${html.slice(from, start)} `;
    const end = lower.indexOf(`</${tag}>`, start);
    if (end < 0) return out;
    from = end + tag.length + 3;
  }
}
