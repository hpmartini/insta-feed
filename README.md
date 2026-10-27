# InstaFeed

RSS-Reader als Bun-Workspaces-Monorepo.

| Pfad | Inhalt |
|:-----|:-------|
| `apps/web` | Next.js-Frontend (Platzhalter-Seite) |
| `apps/api` | Bun-API, SQLite via `bun:sqlite` (`/health`) |
| `packages/shared` | gemeinsame Typen |
| `packages/api-client` | typisierter API-Client |

```sh
bun install
cp .env.example .env   # optional
bun run dev            # web :3000, api :3001
bun run typecheck && bun run build && bun test
```

**Stand:** nur Gerüst. Feeds, Auth, Abruf-Absicherung (SSRF) und KI-Kuratierung sind noch nicht portiert.

Lizenz: siehe `LICENSE`.
