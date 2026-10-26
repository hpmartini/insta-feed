# Briefing T2: InstaFeed komplett neu in Next.js auf Bun, auf Grundlage von BakeNews

## The Job
Implementiere **InstaFeed** in diesem Repository komplett neu als Next.js-App (App Router, TypeScript) mit **Bun** als Runtime und Paketmanager. Die bestehende Angular-11-/Firebase-App (`src/`, `functions/`, `angular.json` …) ist die fachliche Vorlage; sie darf ersetzt und entfernt werden. Architektur, Muster und KI-Funktionen übernimmst du aus **BakeNews** (`/Users/hape/PROJECTS/BakeNews`, nur lesen, nichts dort ändern).

## Why
InstaFeed (RSS-Reader) läuft auf einem veralteten Stack. BakeNews hat inzwischen die bessere Basis: KI-kuratierte Nachrichten mit Zusammenfassung, Story-Clustering und Quellenanalyse über Gemini. InstaFeed soll diese Stärken für eigene RSS-Feeds bekommen und wieder wartbar sein.

## Fachlicher Umfang (aus InstaFeed)
- Konto: Registrieren, Anmelden, Abmelden; geschützte Bereiche nur angemeldet.
- Feeds: RSS-Feed per URL hinzufügen (Name, URL, Icon), bearbeiten, abonnieren/abbestellen; Feeds gehören zum Nutzer.
- Artikel: Artikel aller abonnierten Feeds als Übersicht, neueste zuerst, Filter nach Feed; Artikel-Detail mit Volltext über einen serverseitigen Proxy (CORS).
- Einstellungen pro Nutzer (z. B. Theme, Ansicht, Aktualisierung).
- Der „Row Runner" (Laufschrift-/Animationsansicht der Schlagzeilen) als eigene Ansicht.

## Aus BakeNews übernehmen
- Monorepo-/Paketaufteilung und Muster, soweit sinnvoll (`apps/web`, `apps/api`, `packages/shared`, `packages/api-client`).
- KI-Schicht über einen austauschbaren Adapter: Zusammenfassung pro Artikel und Story-Clustering über Feeds hinweg (Gemini wie in BakeNews). API-Key nur per Umgebungsvariable; ohne Key greift ein deterministischer Mock, die App bleibt voll benutzbar.

## Guardrails
- Bun für Install, Skripte und Tests; Next.js aktuell stabil.
- Keine Secrets im Repo, kein Deploy, kein Push auf `master`.
- Persistenz lokal lauffähig ohne Cloud-Konto (z. B. SQLite über `bun:sqlite`); Firebase ist nicht Pflicht.
- Externe Feeds und KI in Tests gemockt; Tests laufen offline.

## Done means (Abnahmekriterien)
1. `bun install` und `bun run build` laufen im Repo-Root grün; `bun run typecheck` (tsc) grün; `bun test` grün mit Tests für Feed-Parsing, Feed-Verwaltung (CRUD/Abo), Auth und KI-Adapter (Mock).
2. Alle Punkte des fachlichen Umfangs sind umgesetzt und über die UI erreichbar.
3. KI-Zusammenfassung und Story-Clustering funktionieren mit Mock ohne API-Key und mit Gemini, wenn `GEMINI_API_KEY` gesetzt ist.
4. `bun run dev` startet die App lokal; ein README beschreibt Start, Umgebungsvariablen und Architektur.
5. Die alte Angular-App ist entfernt oder klar als Altbestand abgetrennt; im Root gibt es keinen kaputten Build.
6. Alle Änderungen sind im Branch committet.
