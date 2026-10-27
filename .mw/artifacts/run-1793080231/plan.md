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

## Schrittweiser Plan

1. **Vorhandene Verträge nutzen, Änderungsgrenze festhalten.**
   - `app.ts`: bisher nur `AiPort.summarize(): Promise<string>`; `index.ts`: fest verdrahteter Platzhalter. Adapter, Zusammenfassungsroute, Stories und Zieltests fehlen.
   - `db.ts`: `ai_cache` bereits vorhanden, inklusive Nutzer, Operation, Provider, Modell, Prompt-Version und Fingerprint; keine Migration erforderlich.
   - Shared-Verträge enthalten `SummarySchema`, `StoryClusterSchema` und `mergeSources`; wiederverwenden.
   - BakeNews-Primärquellen geprüft: `gemini.ts` verschluckt Fehler als `[]`; Clustering bewertet zwei leere Mengen mit 1, verarbeitet Eingabereihenfolge und erweitert Wortmengen. Diese Verhaltensweisen gezielt ausschließen.
   - Vor Umsetzung erneut `git status`/`git diff`; Änderungen anderer Arbeitsschritte erhalten. Frontend/Ticker bleiben Folgearbeit außerhalb dieses Vertrags.

2. **Adapter und Factory implementieren.**
   - Unter `apps/api/src/ai/`: providerneutraler `AiAdapter`, `MockAdapter`, `GeminiAdapter`, Factory, Antwortschema und `PROMPT_VERSION`; Abhängigkeit aus `Deps` auf diesen Vertrag umstellen.
   - Antwortpayload: nichtleerer Zusammenfassungstext; Identität, Quellen und Erzeugungsmetadaten serverseitig ergänzen. Provider/Modell niemals aus Modellantwort übernehmen.
   - Mock ausschließlich aus Eingabe ableiten; keine Zufallswerte, Uhrzeit oder Netzaufrufe. Vollständige Ergebnisse verwenden injiziertes `now`.
   - Factory erhält Konfiguration explizit: `AI_PROVIDER=mock` gewinnt auch mit Schlüssel; andernfalls Gemini bei nichtleerem `GEMINI_API_KEY`, sonst Mock. Umgebung ausschließlich im Einstiegspunkt lesen.
   - Gemini nutzt `@google/genai`, `gemini-2.5-flash`, `models.generateContent`, `responseMimeType: application/json` und `responseSchema`; anschließend JSON parsen und mit Zod validieren. Diese Konfiguration unterstützt die [offizielle GenerateContentConfig-Dokumentation](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).
   - Kleine injizierbare Client-Schnittstelle für Tests; Transportfehler, fehlender Text, ungültiges JSON und Schemaverletzungen als Adapterfehler weiterreichen. Kein Fallback nach fehlgeschlagenem Gemini-Aufruf; begrenzte Aufrufdauer, keine Schlüssel in Fehlermeldungen.

3. **Erfolgscache und Zusammenfassungsroute ergänzen.**
   - Fingerprint als SHA-256 über eindeutig serialisierte Eingabe einschließlich Titel/Inhalt, Provider, Modell und `PROMPT_VERSION`; vorhandene Trennung nach Nutzer und Operation zusätzlich beibehalten.
   - Nur validierte erfolgreiche Adapterpayloads speichern. Cachetreffer ebenfalls validieren; fehlerhafte Einträge nicht ausliefern.
   - Artikel-ID und aktuelle Originalquelle bei Auslieferung ergänzen: gleicher Inhalt verschiedener Artikel darf keine fremde Artikel-ID oder veraltete Quellen übernehmen.
   - `POST /articles/:id/summary`: nach Authentifizierung eigenen Artikel laden; unbekannte/fremde ID → 404 vor Cachezugriff oder Adapteraufruf. Gespeicherten Inhalt verwenden, keinen zusätzlichen Artikelabruf einführen.
   - Erfolg → validiertes `Summary`; Gemini-Transport-/Antwortfehler → 502 mit bereinigter Meldung, ohne Cacheeintrag. Fehlerbehandlung auf Anbieterfehler begrenzen.

4. **Deterministisches Clustering implementieren.**
   - Reine Funktionen in `apps/api/src/clustering.ts`: Unicode-Normalisierung, Wortmengen, Jaccard und Gruppierung; Ziffern erhalten, Satzzeichen durch Trenner ersetzen.
   - Sobald eine Wortmenge leer ist: Ähnlichkeit 0. Schwellenwert explizit und validiert; Vorschlag 0,75 entsprechend BakeNews-Ausgangswert.
   - Eingaben kopieren und vollständig sortieren: Veröffentlichungszeit absteigend, anschließend stabile Artikel-ID; keine Mutation, Zufalls-ID oder umgebungsabhängige Sortierung.
   - Vorgeschlagene Fenstersemantik: bekannte Veröffentlichungszeit innerhalb `[now − 48 h, now]`; undatierte/zukünftige Artikel ausschließen. Grenzen und Entscheidung dokumentieren.
   - Gruppenzuordnung gegen jedes Mitglied prüfen; dadurch keine Brückencluster durch fortlaufende Wortmengen-Erweiterung. Titel aus stabil bestimmtem Repräsentanten, Cluster-ID aus sortierten Mitglieds-IDs ableiten.
   - Quellen aller Mitglieder mit bestehendem `mergeSources` zusammenführen; Originalartikel-URLs und Feednamen erhalten, Reihenfolge stabilisieren.

5. **Stories anbinden und Herkunft ehrlich ausweisen.**
   - `GET /stories`: ausschließlich Artikel des Sitzungsnutzers, Fenster anhand injiziertem `now`, Ergebnis als validiertes `StoryCluster[]`; keine passenden Artikel → `[]`.
   - Deterministische Gruppierung benötigt keinen Gemini-Aufruf. Vorschlag für vorhandenes Metadatenschema: `provider: mock`, `model: jaccard-v1`; Bedeutung als lokale Heuristik dokumentieren. Gemini-Summaries tragen tatsächlichen Gemini-Provider und Modell.
   - `createdAt` und `promptVersion` gemäß Shared-Vertrag setzen; algorithmische Änderungen ebenfalls versionieren.
   - `app.ts` verdrahtet Routen; `index.ts` ersetzt Platzhalter durch Factory. Bestehende injizierte Testadapter gezielt an Vertragsänderungen anpassen.

6. **Akzeptanz und Gegenbeispiele absichern.**
   - `ai.test.ts`: Mock-Wiederholbarkeit; Factory-Matrix einschließlich Mock trotz Schlüssel; gestubbter Gemini-Erfolg mit Prüfung von Modell/Schema; Transportfehler, leere Antwort, JSON-Fehler und Schemaverletzung → 502, kein Mock-Aufruf, kein Cacheeintrag; anschließender erfolgreicher Versuch bleibt möglich.
   - Cachetests: Treffer vermeidet Anbieteraufruf; Inhalt, Titel, Provider, Modell und Prompt-Version invalidieren unabhängig; Nutzerisolierung und gleiche Inhalte verschiedener Artikel bewahren korrekte Identität/Quellen.
   - Routentests: 401, fremder Origin beim POST, fremde/unbekannte Artikel-ID → 404 ohne Anbieteraufruf; fremde Artikel erscheinen weder in Stories noch Quellen.
   - `clustering.test.ts`: leere/Stopwort-/Satzzeichen-Titel, Unicode/Ziffern, Schwellenwertgrenzen, Eingabepermutationen, Zeitgleichstände, 48-h-Grenze, undatierte/zukünftige Artikel, Brückenfall, Quellen-Deduplizierung und unveränderte Eingaben.
   - Im schreibfähigen Builder nach Dependency-Installation: beide geforderten Testkommandos, danach `bun run typecheck`, `bun run build`, `bun test`; Mock-Lauf ohne Schlüssel und ohne Netzwerkzugriffe nachweisen. Abschließend curl-Kette und Cachepersistenz nach Neustart prüfen.

7. **Abhängigkeiten und Dokumentation abschließen.**
   - `@google/genai` in `apps/api/package.json`, direkte Zod-Abhängigkeit dort bei direktem Import; `bun.lock` über Bun aktualisieren.
   - `.env.example`: `AI_PROVIDER=mock`, optionaler Schlüssel, Auswahlpriorität. README: Routen, reale Mock-Funktion, Gemini-502, Cacheversionierung, Fenster und Herkunftslabels; bisherige Aussage „ohne Key aus“ korrigieren.
   - Root-Konfiguration, Shared-Pakete, Client und `.gitignore` nur bei konkretem Integrationsbedarf ändern; bestehende Schema-/Cache-Strukturen bevorzugen.

## Abschlussstand

- Erledigt: Repository-Vorgaben, Codegraph (`graphify query`, `graphify explain Deps`), Integrationsstellen und BakeNews-Primärquellen lesend geprüft; Implementierungsplan erstellt.
- Ergebnis: Feature fehlt bislang; vorhandene Datenbank und Shared-Verträge ermöglichen Umsetzung ohne geplante Migration.
- Geänderte Dateien: keine; kein `plan.md` geschrieben. Geplant: `apps/api/src/ai/*`, `clustering.ts`, `app.ts`, `index.ts`, beide Zieltests, `apps/api/package.json`, `bun.lock`, README und `.env.example`; bestehende Tests nur bei erforderlicher Typanpassung.
- Kommandos/Tests: `git status --short` und `git diff --stat` leer; Akzeptanzkommando mit beiden Zieltests Exit 1, Dateien fehlen; `bun test apps/api/test/parse-feed.test.ts` Exit 1, `rss-parser` fehlt; `bun run typecheck` Exit 2, Bun-Typen fehlen und Web-Inkrementaldatei darf nicht geschrieben werden. Keine Installation/Build-Ausführung im lesenden Auftrag.
- Offen: vorgeschlagene 48-h-Semantik, Cluster-Zuordnung und Story-Herkunftslabels vor Implementierung gegen vorhandene Issue-Vorgaben abgleichen; echte Gemini-Erreichbarkeit durch Stubs unbewiesen. Legacy-Funktionen/Angular-Komponenten nicht geprüft; Browser-/Ticker-Ziele übersteigen aktuellen Vertrag, Frontend derzeit Platzhalter.
- Nächster Schritt: Plan an schreibfähigen Builder übergeben; dependencies installieren, gezielt implementieren, Akzeptanz und Regression nachweisen. Git-Arbeitsstand weiterhin sauber.