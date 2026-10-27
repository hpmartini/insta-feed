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
- Evidence:
  - `bun install`, `bun run build`, `bun run typecheck` und `bun test` grün im Repo-Root, offline und ohne GEMINI_API_KEY
  - Tests für Parsing, Feeds-CRUD/Abo/Isolation, Auth inkl. Ablauf, safeFetch, Clustering-Gegenbeispiele, AI-Mock und gestubbtes Gemini inkl. Fehlerfall
  - `bun run dev` plus curl-Smoke-Test (Register → Feed → Refresh → Artikel → Zusammenfassung → Stories)
  - Browser-Durchlauf aller Seiten inklusive Ticker
  - Daten nach Neustart vorhanden
  - `git status` sauber auf bench/t2-C
- Range: Stack ersetzen, Features portieren, Abrufe absichern, KI anbinden, offline beweisen, dokumentieren -> Web-Architektur (Next.js/Bun-Monorepo), Backend-Sicherheit (Auth, SSRF, Isolation), AI-Integration (Adapter, Schema, Cache), Test Engineering

## Schrittfolge

1. **Ausgangsstand sichern; Web-Schnitt festlegen.** Vor Umsetzung erneut `git status` und betroffene Diffs prüfen. Befund: Web-Platzhalter, vorhandenes Backend und typisierter Client mit allen benötigten Operationen; Lockfile enthält Next.js 15.5.28. Abhängigkeiten zunächst mit `bun install --frozen-lockfile` installieren, tatsächliche Version prüfen. Für diesen Stand `apps/web/middleware.ts` verwenden. Legacy- und BakeNews-Originale im untersuchten Checkout nicht gefunden; vorhandene Verträge sind Umsetzungsgrundlage. Ticker-Portierung bleibt gesonderter Arbeitsschritt des Gesamtziels.

2. **Rewrites mit bestehendem Origin-Schutz verbinden.** `apps/web/next.config.ts` um `/api/:path*` → `${API_URL}/:path*` ergänzen; serverseitige Zieladresse auf gültige HTTP(S)-Basis prüfen, Vorgabe `http://localhost:3001`. Bestehenden Catch-all-Handler ersetzen, damit genau ein Weiterleitungspfad bleibt. Konkretes Hindernis: Backend vergleicht Browser-Origin mit eigenem Origin; direkte Rewrites allein würden Schreibzugriffe mit 403 ablehnen. Deshalb Middleware auch auf `/api/:path*` anwenden: vorhandenen Origin mutierender Requests gegen konfigurierten öffentlichen Web-Origin prüfen, fremden beziehungsweise `null`-Origin ablehnen, erst danach gültigen Origin als Request-Header auf Backend-Origin setzen. Fehlender Origin bleibt wie bisher erlaubt. Query, Methoden, Body, Cookies, `Set-Cookie`, Status und leere 204-Antworten erhalten; private Antworten ohne Cache ausliefern. Backend-Origin-Prüfung beibehalten. Grundlage: [Rewrites in Next.js 15](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites), [Middleware und Request-Header](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware).

3. **Routen und Sitzungsablauf aufbauen.** Öffentliche Seiten unter `app/(auth)/login` und `register`; geschützte Seiten unter `app/(reader)` mit gemeinsamer Navigation und Logout. Middleware leitet fehlendes Sitzungscookie auf `/login`; API-Pfade behalten ihre Statusantworten. Geschützte Shell verifiziert Sitzung über `me()`, bevor Nutzerdaten erscheinen. Zentrale Behandlung jedes späteren 401: Nutzerdaten verwerfen, Login anzeigen; Netzwerkfehler und 5xx bleiben sichtbare Fehler mit Wiederholung. Cookie-Präsenz gilt nicht als Sitzungsnachweis. Login/Register über bestehenden Browser-Client `/api`, nach Erfolg Navigation aktualisieren; Rücksprungziele ausschließlich lokale Pfade. Logout löscht Sitzung und angezeigte Daten.

4. **Artikelübersicht und Detailseite implementieren.** `/`: Artikel, Feed-Auswahl, gespeicherter Standardfeed und Listen-/Kartenansicht. Aktualisierung verwendet vorhandene `refreshFeed`-Operationen; bei Gesamtauswahl abonnierte Feeds aktualisieren, Teilfehler einzeln melden und erfolgreiche Ergebnisse anzeigen. Filterwechsel und konkurrierende Requests dürfen keine veralteten Ergebnisse überschreiben. `/articles/[id]`: `articleContent(id)`, Originalquelle, ehrlicher Hinweis bei `fallback: true`; Zusammenfassung ausdrücklich auslösen und unabhängig vom Volltext laden beziehungsweise erneut versuchen. Provider, Modell und Quellen aus validierter Antwort anzeigen; Mock als Mock kennzeichnen. Feed- und Artikelinhalt als Text rendern. Für Next.js 15 asynchrone Routenparameter berücksichtigen.

5. **Feeds, Stories und Einstellungen anschließen.** `/feeds`: Anlegen mit Pflichtfeldern URL und Titel, Bearbeiten, Abonnieren/Abbestellen, Löschen und Aktualisieren; `lastError`, Konflikte und Fehler pro Aktion anzeigen. `/stories`: Cluster mit Quellenlinks und Verweisen auf eigene Artikel; `jaccard-v1` als lokale Heuristik kennzeichnen. `/settings`: alle fünf Vertragsfelder vollständig laden und speichern; Zahlen validieren, Standardfeed aus eigenen Feeds wählen. Theme auf `document.documentElement.dataset.theme` anwenden; `system` über CSS-Medienabfrage auflösen. Aktualisierungsintervall gemäß Einstellung aktivieren, Überschneidungen verhindern und Timer beim Verlassen bereinigen. `speed` speichern; Ticker-Verwendung als noch offen dokumentieren.

6. **Zustände und Projektverdrahtung vervollständigen.** Lade-, Leer-, Fehler- und Erfolgszustände getrennt modellieren; erfolgreiche leere Antwort darf keinen Fehler verdecken. Route-Loading, Fehlergrenze, fehlenden Artikel und lokale Mutationszustände ergänzen. Beschriftete Formulare, Tastaturbedienung, sichtbaren Fokus und Statusmeldungen vorsehen. Theme-Variablen und responsive Darstellung in `app/globals.css`; keine entfernten Fonts für Build oder Darstellung benötigen. `apps/web/tsconfig.json` muss auch Middleware, Konfiguration und neue Hilfsmodule erfassen. Direkte Workspace-Abhängigkeiten deklarieren; Root-Skripte und Basiskonfiguration nur bei nachgewiesenem Bedarf ändern.

7. **Gezielt verifizieren.** Origin-Prüfung, Middleware-Matcher, Weiterleitung und Sitzungsablauf mit relevanten Regressionstests prüfen: gültiger/fremder/fehlender Origin, fehlendes und ungültiges Cookie, Query-Weitergabe, Register/Login-Cookie, Logout-204 und keine Redirect-Schleifen. Danach im Repo-Root `bun run build`, `bun run typecheck` und `bun test`; Build ohne laufende API und ohne Gemini-Key. Mit injiziertem Fetch und vorhandenen RSS-/Atom-Fixtures offline Register → Feed → Refresh → Artikel → Zusammenfassung → Stories durchlaufen; produktiven SSRF-Schutz dafür unverändert lassen. Im Browser sämtliche angeforderten Seiten, Filter, Teilfehler, Sitzungsablauf und Themes prüfen. Neustart mit dateibasierter Datenbank bestätigt Persistenz. Offline-Ausführung getrennt von erstmaliger Abhängigkeitsinstallation bewerten.

8. **Dokumentieren und übergeben.** `.env.example` auf `API_URL` umstellen; öffentlichen Origin und tatsächliches Laden der Root-Umgebung im Workspace-Start dokumentieren und testen. README um Seiten, Startablauf, Rewrite-/Origin-Verhalten, Zustände und belegte Prüfungen ergänzen; bestehende Grenzen wie DNS-Rebinding und fehlenden Ticker ehrlich fortschreiben. Veraltete Angaben zum Route-Proxy entfernen. Abschließend Diff auf Scope und unbeabsichtigte Lockfile-Änderungen prüfen; Branch-Integration und Commit durch leitenden Workflow.

## Übergabe

- Erledigt: Repository, Codegraph, Verträge und Next.js-15-Dokumentation geprüft; konkreten Umsetzungsplan erstellt.
- Ergebnis: kritische Rewrite-/Origin-Abhängigkeit erkannt; Middleware-Lösung innerhalb `apps/web` vorgesehen.
- Geänderte Dateien: keine; `plan.md` wegen Schreibverbots nicht angelegt.
- Vorgesehene Dateien: `apps/web/{next.config.ts,middleware.ts,tsconfig.json,package.json,app/**}`, `.env.example`, `README.md`; `bun.lock` nur bei erforderlichen Abhängigkeitsänderungen.
- Befehle: `graphify query` erfolgreich; `git status` und `git diff --stat` leer; Quellcode-/Lockfile-Abfragen erfolgreich; Bun 1.2.18 vorhanden.
- Tests: Installation, Build, Typecheck und Tests nicht ausgeführt; Abhängigkeiten fehlen, Ausführung erzeugt Dateien. Keine grüne Abnahme behauptet.
- Offen: Rewrite-Header und Cookies im echten Next-Prozess belegen; Browser-/Offline-/Neustartnachweise fehlen. HTTPS-Cookie-Verhalten hinter vorgeschaltetem Proxy gesondert prüfen.
- Nächster Schritt: Plan im leitenden Workflow umsetzen; aktueller Branch `issue-35`, Zielbranch `bench/t2-C` erst bei Integration bestätigen.