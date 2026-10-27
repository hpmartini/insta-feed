"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveFeedAction } from "@/app/actions";
import type { Feed } from "@/lib/types";

/** Add form when `feed` is absent, edit form otherwise. */
export default function FeedForm({ feed }: { feed?: Feed }) {
  const [state, action, pending] = useActionState(saveFeedAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !feed) formRef.current?.reset();
  }, [state, feed]);

  return (
    <form ref={formRef} action={action} className="stack">
      {feed && <input type="hidden" name="id" value={feed.id} />}
      <div className="row">
        <label style={{ width: "5rem" }}>
          Icon
          <input name="icon" defaultValue={feed?.icon ?? "📰"} maxLength={8} />
        </label>
        <label style={{ flex: "1 1 10rem" }}>
          Name
          <input name="name" defaultValue={feed?.name} required maxLength={100} />
        </label>
      </div>
      <label>
        Feed-URL
        <input name="url" type="url" defaultValue={feed?.url} placeholder="https://example.com/rss.xml" required />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="row">
        <button type="submit" disabled={pending}>
          {feed ? "Speichern" : "Feed hinzufügen"}
        </button>
        {state.ok && feed && (
          <span className="muted" role="status">
            Gespeichert
          </span>
        )}
      </div>
    </form>
  );
}
