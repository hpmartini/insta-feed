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

## Schrittplan — vorgeschlagene Umsetzung

1. **Routenvertrag festlegen.** Öffentlich: `POST /auth/register`, `POST /auth/login`, bestehendes `GET /health`. Geschützt: `GET /auth/me`, `POST /auth/logout`, übrige Anwendungspfade. Erfolgsstatus: 201/200/200/204; fehlende, unbekannte oder abgelaufene Sitzung: 401. Annahme: Registrierung meldet unmittelbar an. Wortlaut „alle Routen“ benötigt diese öffentlichen Ausnahmen; sonst Registrierung und Anmeldung unmöglich.
2. **`apps/api/src/auth.ts` ergänzen.** Vorhandene Tabellen `users`/`sessions` verwenden; keine Migration erforderlich. E-Mail trimmen und kleinschreiben; JSON und Zugangsdaten validieren, Passwort unverändert übernehmen. Asynchron `Bun.password.hash(password, { algorithm: "argon2id" })` und `Bun.password.verify` einsetzen; ungültige Zugangsdaten einheitlich mit 401, doppelte E-Mail mit 409 beantworten. Nur erwartete Validierungs-/Eindeutigkeitsfehler übersetzen. Algorithmus und asynchroner Aufruf laut [Bun-Dokumentation](https://bun.sh/docs/runtime/hashing).
3. **Sitzungslebenszyklus implementieren.** Pro Anmeldung 32 kryptografisch zufällige Bytes als opaken Cookie-Token erzeugen; ausschließlich SHA-256-Hexdigest speichern. Ablauf aus injiziertem `now()` plus 30 Tagen; gültig ausschließlich bei `expires_at > now`. Registrierung: Nutzer und Sitzung gemeinsam atomar speichern, Hashing vorher abschließen. Cookie: `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, passendes `Expires`; bei HTTPS zusätzlich `Secure`. `/auth/me` liefert vorhandenen öffentlichen User-Vertrag ohne Passwort- oder Sitzungsdaten. Logout löscht aktuelle Sitzung und Cookie mit identischen Pfadattributen; Token danach unbrauchbar.
4. **`apps/api/src/app.ts` verdrahten.** `db` und `now` durchreichen; Umgebungszugriff in bestehender Startverdrahtung belassen. Vor mutierenden Requests vorhandenen `Origin` gegen Request-Origin vergleichen; fremden, ungültigen oder `null`-Origin mit 403 vor jeder Zustandsänderung abweisen. Fehlenden Origin für lokale Kommandozeilenaufrufe zulassen. Öffentliche Ausnahmen explizit behandeln, danach zentral Sitzung prüfen. Handler asynchron machen; bestehenden Gesundheitscheck in `apps/api/test/db.test.ts` vor `.json()` auf Handler-Ergebnis warten lassen.
5. **`apps/api/test/auth.test.ts` ergänzen.** Migrierte In-Memory-Datenbank, verstellbare Uhr, Netzwerk-/KI-Stubs. Prüfen: Register → `/auth/me`; normalisierte E-Mail und Dublette; Argon2id-Hash statt Klartext; Login mit richtigem/falschem Passwort und unbekanntem Nutzer; unabhängige Token; Datenbank enthält nur Token-Digest; Cookieattribute und exakt 30 Tage; Ablauf unmittelbar vor/an Grenze; fehlendes/fremdes/malformed Cookie → 401; Logout löscht Datenbankeintrag und Cookie, Token-Wiederverwendung → 401. Zwei Nutzer: Cookie bestimmt ausschließlich eigenen Nutzer; Logout lässt andere Sitzung gültig. Origin-Matrix für Register/Login/Logout: gleich, fremd, `null`, fehlend; abgewiesene Requests ohne Änderungen an Nutzern/Sitzungen. Ungültiges JSON und falsche Feldtypen ohne 500.
6. **README aktualisieren, Änderung begrenzen.** Auth-Routen, Cookie-Verhalten, öffentliche Ausnahmen, Origin-Regel und Cookie-Jar-Beispiel dokumentieren; bisherigen Hinweis „Auth noch nicht portiert“ korrigieren. Geplante Dateien: neue `auth.ts`, neue `auth.test.ts`, bestehende `app.ts`, notwendige Await-Anpassung in `db.test.ts`, `README.md`. Keine neuen Abhängigkeiten, Frontend-Funktionen oder Änderungen an Manifesten/Lockfile/Schema erforderlich. Übrige Ambition bleibt Folgearbeit.
7. **Im schreibberechtigten Builder abnehmen.** Abhängigkeiten installieren; `bun test apps/api/test/auth.test.ts`, `bun run typecheck`, `bun run build`, `bun test` ausführen, ohne Schlüssel/Netzwerk zur Laufzeit. Cookie-Jar-Smoke-Test: Register → Me → Logout → Me=401; Login → Me; Sitzung nach Neustart weiterhin gültig. Abschließend Diff auf Auth-Umfang und unbeabsichtigte Dateien prüfen. Vollständiger Feed-/KI-/Browser-Durchlauf erst nach betreffenden Folgefeatures.

## Ergebnis dieser Untersuchung

- Erledigt: Repository-Vorgaben, Codegraph, App, Schema, Tests und Verträge geprüft; keine Dateien geändert, kein `plan.md` geschrieben.
- Befund: `apps/api/src/auth.ts` und `apps/api/test/auth.test.ts` fehlen; `app.ts` implementiert ausschließlich öffentlichen Gesundheitscheck; Nutzer-/Sitzungstabellen bereits vorhanden.
- Navigation: `graphify query …`, `graphify explain createApp` erfolgreich; Arbeitsbaum vor/nach Prüfung sauber (`git status --short`, `git diff --exit-code`).
- Abnahmetest: `bun test apps/api/test/auth.test.ts` → Exit 1, keine passende Testdatei; Akzeptanz nicht erfüllt.
- Laufzeitprobe: `bun --no-install -e …` → Exit 0; Argon2id-Hash/Verifikation, falsches Passwort, Zufallstoken, SHA-256, vorhandenes In-Memory-Schema und exakte Ablaufgrenze erfolgreich; kein Nachweis implementierter Auth-Routen.
- Weitere Prüfungen: `bun --no-install test packages/shared/src/sources.test.ts` → Exit 1, `zod` fehlt; `tsc -p apps/api --incremental false` → Exit 2, Bun-Typdefinition fehlt. Install/Build/Gesamttests nicht ausgeführt; würden Dateien schreiben.
- Offene Vertragsfragen: öffentliche Ausnahmen vom pauschalen 401; vorgeschlagener Vorrang 403 bei fremdem Origin auch ohne Cookie. Web `:3000` und API `:3001` haben unterschiedliche Origins; vorgeschlagene strikte Prüfung erfordert später gleiche Browser-Origin oder ausdrücklich vereinbarte Vertrauenskonfiguration.
- Nächster Schritt: Builder setzt Schritte 1–7 um; Reviewer prüft Auth-Abnahme, Seiteneffektfreiheit abgewiesener Requests und unveränderten Umfang. Breite Ambition durch diesen Auth-Teil allein nicht erfüllt.