"use client";

import { ApiError, createApiClient } from "@insta-feed/api-client";
import type { Settings, User } from "@insta-feed/shared";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loginUrl } from "./login-url";

export const api = createApiClient();

export const errMsg = (e: unknown): string =>
  e instanceof ApiError ? (e.kind === "network" ? "Server nicht erreichbar" : e.kind === "response" ? "Unerwartete Serverantwort" : e.message) : "Unbekannter Fehler";

type Boot = { status: "loading" } | { status: "error"; message: string } | { status: "anon" } | { status: "ready"; user: User; settings: Settings };

interface Session {
  user: User;
  settings: Settings;
  setSettings: (s: Settings) => void;
  /** Meldung für die UI; bei 401 zusätzlich Sitzung verwerfen und zum Login. */
  fail: (e: unknown) => string;
  logout: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);
export const useSession = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [boot, setBoot] = useState<Boot>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const toLogin = useCallback(() => {
    setBoot({ status: "anon" });
    router.replace(loginUrl(pathRef.current, window.location.search)); // Query erhalten (z. B. /ticker?article=…&autostart=true)
  }, [router]);

  useEffect(() => {
    let live = true;
    setBoot({ status: "loading" });
    Promise.all([api.me(), api.getSettings()]).then(
      ([user, settings]) => live && setBoot({ status: "ready", user, settings }),
      (e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) toLogin();
        else setBoot({ status: "error", message: errMsg(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt, toLogin]);

  const theme = boot.status === "ready" ? boot.settings.theme : null;
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        toLogin();
        return "Sitzung abgelaufen";
      }
      return errMsg(e);
    },
    [toLogin],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
    setBoot({ status: "anon" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  if (boot.status === "error")
    return (
      <main className="center" role="alert">
        <p className="error">{boot.message}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Erneut versuchen</button>
      </main>
    );
  if (boot.status !== "ready") return <main className="center" aria-busy="true">{boot.status === "loading" ? "Lade …" : "Weiterleitung zum Login …"}</main>;

  const { user, settings } = boot;
  const setSettings = (s: Settings) => setBoot({ status: "ready", user, settings: s });
  return <Ctx.Provider value={{ user, settings, setSettings, fail, logout }}>{children}</Ctx.Provider>;
}
