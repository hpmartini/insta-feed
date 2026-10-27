"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-runs the server components (and so re-fetches the feeds) every `minutes`; 0 = off. */
export default function RefreshTimer({ minutes }: { minutes: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!minutes) return;
    const id = setInterval(() => router.refresh(), minutes * 60_000);
    return () => clearInterval(id);
  }, [minutes, router]);
  return null;
}
