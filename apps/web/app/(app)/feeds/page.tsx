import FeedManager from "@/components/FeedManager";
import { listFeeds } from "@/lib/feeds";
import { requireUser } from "@/lib/session";

export default async function Feeds() {
  const user = await requireUser();
  return (
    <>
      <h1>Feeds</h1>
      <FeedManager feeds={listFeeds(user.id)} />
    </>
  );
}
