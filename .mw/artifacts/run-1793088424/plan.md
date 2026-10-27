## Ambition
- Altitude: InstaFeed wird wieder ein wartbarer RSS-Reader, der lokal sofort läuft. Eigene Feeds bekommen KI-Kuratierung aus BakeNews: Zusammenfassung sowie Story-Clustering mit Quellen. Neue Features und ein späterer Anbieterwechsel (Gemini/Claude) gehen ohne Umbau.
- Depth: Ausgangsmaterial ist Primärquellcode, kein Digest: functions/src/index.ts (Proxy, Abo, Settings), die Angular-Komponenten (row-runner speed/autostart/fullscreen), BakeNews gemini.ts, llm/index.ts, clustering.ts, shared/sources.ts und api-client. Was ein Profi zusätzlich tut:
  - jeden ausgehenden Abruf als SSRF-Grenze behandeln (http(s), Private-IP-Sperre, Limits; Proxy nur für gespeicherte Artikel)
  - Passwörter mit Bun.password hashen, Sitzungen nur gehasht speichern, Origin-Check
  - Nutzerisolation per Test belegen
  - I/O (db, fetch, ai, now) injizieren
  - echte RSS-/Atom-Fixtures nutzen, den Import idempotent machen
  - die bekannten Fehler aus BakeNews nicht übernehmen (leere Jaccard-Mengen = 1, Gemini-Fehler als [])
  - KI-Ergebnisse validieren, nach Provider und Prompt-Version cachen und ehrlich labeln
  - ein ehrliches README schreiben
- Evidence:
  - `bun install`, `bun run build`, `bun run typecheck` und `bun test` grün im Repo-Root, offline und ohne GEMINI_API_KEY
  - Tests für Parsing, Feeds-CRUD/Abo/Isolation, Auth inkl. Ablauf, safeFetch, Clustering-Gegenbeispiele, AI-Mock und gestubbtes Gemini inkl. Fehlerfall
  - `bun run dev` plus curl-Smoke-Test (Register → Feed → Refresh → Artikel → Zusammenfassung → Stories)
  - Browser-Durchlauf aller Seiten inklusive Ticker
  - Daten nach Neustart vorhanden
  - `git status` sauber auf bench/t2-C
- Range: Stack ersetzen, Features portieren, Abrufe absichern, KI anbinden, offline beweisen, dokumentieren -> Web-Architektur (Next.js/Bun-Monorepo), Backend-Sicherheit (Auth, SSRF, Isolation), AI-Integration (Adapter, Schema, Cache), Test Engineering

## Untersuchung abgeschlossen

- Arbeitsstand: Branch `issue-36`, `git status --short` und `git diff --stat` leer; keine Dateien geändert, kein `plan.md` geschrieben.
- Orientierung: `graphify query` erfolgreich; Repository-Anweisungen, Frontend-Konventionen und relevante Quelldateien gelesen.
- Befund: `/ticker` fehlt; `settings.speed` bereits 1–100 Millisekunden pro Zeichen, Vorgabe 30; typisierter Volltextabruf vorhanden.
- Primärquelle: Angular-Komponenten aus `19028fa^:src/app/pages/row-runner/` gelesen; zeichenweise Ausgabe, Start/Stopp und Vollbildansicht; Autostart erst nach geladenem Artikel.
- Sicherheitsbasis: `apps/api/src/articles.ts` liefert Volltext ausschließlich für gespeicherte Artikel eigener Feeds; vorhandene Tests prüfen Nutzerisolation und blockierte private Abrufziele.
- Konkrete Integrationslücke: Middleware erhält Queryparameter beim Login-Rücksprung; `SessionProvider.toLogin()` verliert sie bei vorhandenem, ungültigem Sitzungscookie.

## Umsetzungsschritte

1. **Route und Session anbinden.** Physische Datei `apps/web/app/ticker/page.tsx` anlegen, damit exakter Abnahmepfad erfüllt wird. Server-Seite liest asynchrone `searchParams`, normalisiert `article` und wertet ausschließlich `autostart === "true"` als Startsignal. `apps/web/app/ticker/layout.tsx` bindet vorhandene `SessionProvider` und `Shell` ein. Browserlogik in kleine Client-Komponente auslagern; kein Zugriff auf Browserobjekte während Server-Rendering.

2. **Zwei Datenmodi festlegen.** Ohne `article`: eigene Feeds und Artikel über vorhandenen Client laden, Schlagzeilen abonnierter Feeds in bestehender Reihenfolge ausgeben. Mit nichtleerem `article`: ausschließlich `api.articleContent(id)` laden und dessen vollständigen Text verwenden; keine URL aus Queryparametern abrufen. Vorhandene Fallback-Kennzeichnung übernehmen. Laden, Fehler mit Wiederholen, fehlenden Artikel und leeren Text getrennt darstellen. Komponentenwechsel nach Artikelkennung zurücksetzen; verspätete Antworten dürfen keinen vorherigen Artikel anzeigen.

3. **Laufschrift implementieren.** Gemeinsame Wiedergabekomponente für Schlagzeilen und Volltext; zeichenweise Ausgabe mit automatischem Nachscrollen, getrennte Schlagzeilen und lesbare Absatzumbrüche. Vorschlag: Start setzt fort, Stopp pausiert, am Ende stoppt Wiedergabe; erneuter Start beginnt von vorn. Tempo unmittelbar aus `useSession().settings.speed`, kleinere Werte schneller. Zeitgeber bei Stopp, Datenwechsel und Unmount löschen; keine parallelen Wiedergabeschleifen. Autostart genau einmal je geladenem Datensatz aktivieren; manuelles Stoppen bleibt wirksam. Keine Silbentrennungsbibliothek übernehmen.

4. **Vollbild und Bedienbarkeit ergänzen.** Vollbild per Benutzeraktion öffnen und verlassen; Browserzustand über `fullscreenchange` einschließlich Escape synchronisieren. Bei nicht verfügbarer Fullscreen-Schnittstelle bedienbare bildschirmfüllende Ansicht anbieten. Autostart startet Wiedergabe ohne automatische Browser-Vollbildanforderung. Start/Stopp und Vollbild verlassen jederzeit erreichbar; Tastaturfokus sichtbar. Animierten Text nicht fortlaufend als Live-Meldung vorlesen lassen; Statusmeldungen separat ausgeben.

5. **Erreichbarkeit und Login-Rücksprung vervollständigen.** `/ticker` in `apps/web/components/shell.tsx` verlinken; Artikelansicht um Link `/ticker?article=<kodierte Kennung>` ergänzen. In `apps/web/lib/session.tsx` aktuellen lokalen Pfad einschließlich Query beim Sitzungsausfall erhalten, damit Artikelmodus und Autostart nach Anmeldung wiederhergestellt werden. Änderung auf dieses konkrete Ticker-Problem begrenzen; vorhandene Prüfung lokaler Rücksprungziele beibehalten.

6. **Dokumentation aktualisieren.** Veralteten Hinweis „Ticker noch nicht portiert“ aus Settings-Seite entfernen. README um Route, beide Datenmodi, Start/Stopp, Tempoeinheit, Vollbild und Beispiele `/ticker?autostart=true` sowie `/ticker?article=<id>&autostart=true` ergänzen. Tatsächlich ausgeführte Browserprüfung und verbleibende Grenzen dokumentieren. Bestehende Styles und Themevariablen verwenden; keine neue Styling-Infrastruktur oder Backend-Erweiterung.

7. **Abnahme durchführen.** Im schreibfähigen Builder zuerst `bun install --frozen-lockfile`, anschließend `bun run build`, `bun run typecheck`, `bun test` ohne Gemini-Schlüssel; Tests ohne externe Abrufe. Exakten Routencheck `sh -c 'ls apps/web/app/ticker/page.tsx || ls apps/web/src/app/ticker/page.tsx'` wiederholen. Gezielte Regressionen für Queryparameter und Login-Rücksprung ergänzen. Browserprüfung mit kontrollierten Daten: Standardzustand gestoppt, Start/Stopp/Fortsetzen, Autostart true/false, Tempo 1/30/100, Vollbild/Escape, Artikelwechsel während Abruf, leerer Inhalt, Fallback, fremde Kennung und Sitzungsausfall. Danach bestehenden Register→Feed→Refresh→Artikel→Zusammenfassung→Stories-Smoke-Test und Persistenz nach Neustart prüfen; abschließend Diff und Status kontrollieren.

## Dateien

- Geändert: keine.
- Geplant neu: `apps/web/app/ticker/page.tsx`, `apps/web/app/ticker/layout.tsx`, kleine Wiedergabe-Client-Komponente mit lokalem Stylesheet unter `apps/web/app/ticker/`.
- Geplant angepasst: `apps/web/components/shell.tsx`, `apps/web/app/(reader)/articles/[id]/page.tsx`, `apps/web/app/(reader)/settings/page.tsx`, `apps/web/lib/session.tsx`, `README.md`; gezielte Regressionstests unter `apps/web`.
- Paket-, Lock- und Backendänderungen derzeit nicht begründet.

## Ausgeführte Prüfungen

- `git status --short`, `git diff --stat`: sauber; Abschlussstatus ebenfalls sauber.
- `graphify query`, `git log`, `git ls-tree`, `git show`, gezielte Quelltextlektüre: erfolgreich; Altbestand aus Git gelesen.
- Exakter Routencheck: Exit 2; beide zulässigen Ticker-Dateien fehlen.
- `bun test`: Exit 1; 8 bestanden, 11 fehlgeschlagen, 10 Fehler; Abhängigkeiten einschließlich `next/server`, `rss-parser`, `zod` und Workspace-Verknüpfungen fehlen.
- `bun run typecheck`: Exit 2; `@types/bun` fehlt; zusätzlich verweigerter Schreibversuch für inkrementelle TypeScript-Datei. Keine Dateiänderung erfolgt.
- `bun install`, `bun run build`, Dev- und Browserprüfung: nicht ausgeführt; Installation und Build erzeugen Dateien und gehören in Builder-Schritt.

## Offen / nächster Schritt

- Builder setzt Plan um; Reviewer prüft unveränderten Ambition-Block und konkrete Ticker-Abnahme. Breitere Architekturarbeiten außerhalb dieses Issues bleiben ausgeschlossen.
- Vorschläge zu Pausieren/Fortsetzen, Endverhalten und Schlagzeilenauswahl müssen als Produktverhalten dokumentiert und geprüft werden; Vertrag legt diese Details nicht fest.
- Browser-Vollbild benötigt Benutzeraktion; Autostart kann native Vollbildanforderung nicht zuverlässig ersetzen.
- Grüne Build-, Test- und Browsernachweise fehlen; vorhandene Abhängigkeitsfehler belegen keinen Ticker-Implementierungsfehler.
- Aktueller Branch `issue-36`; Übergabe beziehungsweise Integration nach `bench/t2-C` durch leitenden Workflow. Kein Commit, Branchwechsel oder Push erfolgt.