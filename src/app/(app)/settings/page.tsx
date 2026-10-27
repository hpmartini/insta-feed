import SettingsForm from "@/components/SettingsForm";
import { getDb } from "@/lib/db";
import { listFeeds } from "@/lib/feeds";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await requireUser();
  const db = getDb();
  return (
    <>
      <h1>Einstellungen</h1>
      <p className="muted">Angemeldet als {user.email}</p>
      <SettingsForm settings={getSettings(db, user.id)} feeds={listFeeds(db, user.id)} />
    </>
  );
}
