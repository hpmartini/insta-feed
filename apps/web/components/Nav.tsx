"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

const LINKS = [
  ["/articles", "Artikel"],
  ["/stories", "Stories"],
  ["/row-runner", "Row Runner"],
  ["/feeds", "Feeds"],
  ["/settings", "Einstellungen"],
] as const;

export default function Nav({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await api("POST", "/api/auth/logout");
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="nav" aria-label="Hauptnavigation">
      <strong>InstaFeed</strong>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>{label}</Link>
      ))}
      <span className="spacer" />
      <span className="muted">{email}</span>
      <button onClick={logout}>Abmelden</button>
    </nav>
  );
}
