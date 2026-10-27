"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession } from "../lib/session";

const NAV = [["/", "Artikel"], ["/feeds", "Feeds"], ["/stories", "Stories"], ["/settings", "Einstellungen"]] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <header className="bar">
        <strong>InstaFeed</strong>
        <nav aria-label="Hauptnavigation">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" || pathname.startsWith("/articles") : pathname.startsWith(href)) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="muted">{user.email}</span>
        <button onClick={() => logout().catch(() => setError("Abmelden fehlgeschlagen"))}>Abmelden</button>
      </header>
      {error && <p role="alert" className="error">{error}</p>}
      <main>{children}</main>
    </>
  );
}
