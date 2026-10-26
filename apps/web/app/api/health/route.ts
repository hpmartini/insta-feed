import { Database } from "bun:sqlite";

export const dynamic = "force-dynamic";

export function GET() {
  const db = new Database(":memory:");
  return Response.json(db.query("SELECT 1 AS ok").get());
}
