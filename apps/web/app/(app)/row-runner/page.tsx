import RowRunner from "@/components/RowRunner";
import { loadArticles } from "@/lib/articles";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function RowRunnerPage() {
  const user = await requireUser();
  const { items, errors } = await loadArticles(user.id);
  return (
    <>
      <h1>Row Runner</h1>
      {errors.map((e) => <p key={e.feedId} role="alert" className="error">{e.feedName}: {e.error}</p>)}
      <RowRunner headlines={items.slice(0, 40).map((i) => i.title)} speed={getSettings(user.id).speed} />
    </>
  );
}
