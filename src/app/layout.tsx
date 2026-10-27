import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "./actions";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaFeed",
  description: "RSS-Reader mit KI-Zusammenfassung und Story-Clustering",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const theme = user ? getSettings(getDb(), user.id).theme : "system";

  return (
    <html lang="de" data-theme={theme === "system" ? undefined : theme}>
      <body>
        <header className="nav">
          <Link href="/" className="brand">
            InstaFeed
          </Link>
          {user ? (
            <nav aria-label="Hauptnavigation">
              <Link href="/articles">Artikel</Link>
              <Link href="/feeds">Feeds</Link>
              <Link href="/settings">Einstellungen</Link>
              <form action={logoutAction}>
                <button type="submit" className="link" title={user.email}>
                  Abmelden
                </button>
              </form>
            </nav>
          ) : (
            <nav aria-label="Konto">
              <Link href="/login">Anmelden</Link>
              <Link href="/register">Registrieren</Link>
            </nav>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
