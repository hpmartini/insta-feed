# Briefing

## The Job

Implementiere **InstaFeed** in diesem Repository komplett neu als Next.js-App (App Router, TypeScript) mit **Bun** als Runtime und Paketmanager. Die bestehende Angular-11-/Firebase-App (`src/`, `functions/`, `angular.json` …) ist die fachliche Vorlage; sie darf ersetzt und entfernt werden. Architektur, Muster und KI-Funktionen übernimmst du aus **BakeNews** (`/Users/hape/PROJECTS/BakeNews`, nur lesen, nichts dort ändern).

## Why

InstaFeed (RSS-Reader) läuft auf einem veralteten Stack. BakeNews hat inzwischen die bessere Basis: KI-kuratierte Nachrichten mit Zusammenfassung, Story-Clustering und Quellenanalyse über Gemini. InstaFeed soll diese Stärken für eigene RSS-Feeds bekommen und wieder wartbar sein.

## Guardrails

- Bun für Install, Skripte und Tests; Next.js aktuell stabil.
- Keine Secrets im Repo, kein Deploy, kein Push auf `master`.
- Persistenz lokal lauffähig ohne Cloud-Konto (z. B. SQLite über `bun:sqlite`); Firebase ist nicht Pflicht.
- Externe Feeds und KI in Tests gemockt; Tests laufen offline.

## Done means

1. `bun install` und `bun run build` laufen im Repo-Root grün; `bun run typecheck` (tsc) grün; `bun test` grün mit Tests für Feed-Parsing, Feed-Verwaltung (CRUD/Abo), Auth und KI-Adapter (Mock).
2. Alle Punkte des fachlichen Umfangs sind umgesetzt und über die UI erreichbar.
3. KI-Zusammenfassung und Story-Clustering funktionieren mit Mock ohne API-Key und mit Gemini, wenn `GEMINI_API_KEY` gesetzt ist.
4. `bun run dev` startet die App lokal; ein README beschreibt Start, Umgebungsvariablen und Architektur.
5. Die alte Angular-App ist entfernt oder klar als Altbestand abgetrennt; im Root gibt es keinen kaputten Build.
6. Alle Änderungen sind im Branch committet.

## First on approval

Monorepo-Gerüst mit Bun-Workspaces und Next.js-App lauffähig machen (`bun install`, `bun run build` grün), danach Domain (Feeds, Auth, SQLite) und KI-Adapter mit Mock.


## Next: plan


## PRD
```json
{
  "title": "InstaFeed neu in Next.js auf Bun",
  "summary": "Angular/Firebase-InstaFeed als Bun-Monorepo mit Next.js, SQLite, Auth, Feeds, Artikel, Row Runner und KI-Adapter (Gemini/Mock) neu umsetzen.",
  "scope": [
    "Monorepo apps/web, apps/api, packages/shared, packages/api-client",
    "Auth, Feeds-CRUD/Abo, Artikel, Proxy, Settings, Row Runner",
    "KI-Adapter: Zusammenfassung und Story-Clustering, Mock ohne Key",
    "Tests, README, Altbestand entfernen"
  ],
  "risks": [
    "Next.js/Bun-Kompatibilit\u00e4t bun:sqlite",
    "Offline-Tests mit Mocks f\u00fcr Feeds und KI"
  ],
  "open_points": [
    "Annahme: Cookie-Session-Auth mit bun:sqlite statt Firebase",
    "Annahme: Gemini per Fetch ohne SDK"
  ]
}
```

