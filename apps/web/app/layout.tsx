import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "InstaFeed" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-theme="system">
      <body>{children}</body>
    </html>
  );
}
