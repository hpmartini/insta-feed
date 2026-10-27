import { Ticker } from "./ticker";

type Param = string | string[] | undefined;
const first = (p: Param) => (Array.isArray(p) ? p[0] : p);

export default async function TickerPage({ searchParams }: { searchParams: Promise<Record<string, Param>> }) {
  const q = await searchParams;
  const article = first(q.article)?.trim() || undefined;
  // Nur der exakte Wert "true" startet automatisch.
  return <Ticker article={article} autostart={first(q.autostart) === "true"} />;
}
