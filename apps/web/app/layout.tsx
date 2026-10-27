import type { Metadata } from "next";
import { currentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = { title: "InstaFeed", description: "RSS-Reader mit KI-Zusammenfassungen und Story-Clustering" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const theme = user ? getSettings(user.id).theme : "system";
  return (
    <html lang="de" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
