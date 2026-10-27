// Fake RSS feed, article page and Gemini on :5055
const item = (t: string, d: string) =>
  `<item><title>${t}</title><link>http://127.0.0.1:5055/a/${encodeURIComponent(t)}</link><pubDate>${d}</pubDate><description>${t}. Zweiter Satz.</description></item>`;
const page = '<html><head><title>Artikel</title></head><body><article><h1>Artikel</h1><p>' + 'Langer Inhalt des Artikels zum Lesen. '.repeat(30) + '</p></article></body></html>';
Bun.serve({
  port: 5055,
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname === '/feed.xml')
      return new Response(`<rss><channel>${item('Bundestag beschließt Klimagesetz', 'Tue, 02 Jan 2024 10:00:00 GMT')}${item('Klimagesetz im Bundestag beschlossen', 'Tue, 02 Jan 2024 11:00:00 GMT')}${item('Bayern gewinnt Pokal', 'Mon, 01 Jan 2024 10:00:00 GMT')}</channel></rss>`);
    if (u.pathname.startsWith('/a/')) return new Response(page);
    if (u.pathname.includes(':generateContent')) {
      const body = await req.text();
      const text = body.includes('Gruppiere')
        ? JSON.stringify([{ title: 'GEMINI-Story', summary: 'x', ids: [0, 1, 2] }])
        : 'GEMINI-Zusammenfassung';
      return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
    }
    return new Response('404', { status: 404 });
  },
});
