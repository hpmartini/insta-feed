import SettingsForm from "@/components/SettingsForm";
import { listFeeds } from "@/lib/feeds";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <h1>Einstellungen</h1>
      <SettingsForm settings={getSettings(user.id)} feeds={listFeeds(user.id)} />
    </>
  );
}
