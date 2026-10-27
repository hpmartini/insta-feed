import Link from "next/link";
import { deleteFeedAction, toggleSubscriptionAction } from "@/app/actions";
import FeedForm from "@/components/FeedForm";
import { getDb } from "@/lib/db";
import { listFeeds } from "@/lib/feeds";
import { requireUser } from "@/lib/session";

export default async function FeedsPage() {
  const user = await requireUser();
  const feeds = listFeeds(getDb(), user.id);

  return (
    <>
      <h1>Feeds</h1>
      <section className="card" aria-labelledby="add-feed">
        <h2 id="add-feed" style={{ marginTop: 0, fontSize: "1.1rem" }}>
          Neuer Feed
        </h2>
        <FeedForm />
      </section>

      {feeds.length === 0 && <p className="muted">Noch keine Feeds. Füge oben deinen ersten RSS-Feed hinzu.</p>}

      {feeds.map((feed) => (
        <section key={feed.id} className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <Link href={`/articles?feed=${feed.id}`} className="item-title">
                <span aria-hidden="true">{feed.icon}</span> {feed.name}
              </Link>
              <div className="muted">
                {feed.url} · {feed.subscribed ? "abonniert" : "nicht abonniert"}
              </div>
            </div>
            <div className="row">
              <form action={toggleSubscriptionAction}>
                <input type="hidden" name="id" value={feed.id} />
                <input type="hidden" name="subscribed" value={String(!feed.subscribed)} />
                <button type="submit" className="secondary">
                  {feed.subscribed ? "Abbestellen" : "Abonnieren"}
                </button>
              </form>
              <form action={deleteFeedAction}>
                <input type="hidden" name="id" value={feed.id} />
                <button type="submit" className="secondary" aria-label={`${feed.name} löschen`}>
                  Löschen
                </button>
              </form>
            </div>
          </div>
          <details style={{ marginTop: "0.75rem" }}>
            <summary>Bearbeiten</summary>
            <div style={{ marginTop: "0.75rem" }}>
              <FeedForm feed={feed} />
            </div>
          </details>
        </section>
      ))}
    </>
  );
}
