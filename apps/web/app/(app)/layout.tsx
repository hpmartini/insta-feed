import Nav from "@/components/Nav";
import RefreshTimer from "@/components/RefreshTimer";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Nav email={user.email} />
      <RefreshTimer minutes={getSettings(user.id).refreshMinutes} />
      <main className="page">{children}</main>
    </>
  );
}
