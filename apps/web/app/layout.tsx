import type { ReactNode } from "react";

export const metadata = { title: "InstaFeed" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
