"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errMsg } from "../lib/session";

/** Nur lokale Pfade: aufgelöste URL muss derselbe Origin sein (fängt "//h", "/\\h", "/<TAB>/h"). */
export const localPath = (p: string | null): string => {
  if (!p || !p.startsWith("/") || /[\u0000-\u001f\\]/.test(p)) return "/";
  try {
    const u = new URL(p, "http://local.invalid");
    return u.origin === "http://local.invalid" ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = localPath(useSearchParams().get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = mode === "login";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const creds = { email: String(f.get("email")), password: String(f.get("password")) };
    setBusy(true);
    setError(null);
    try {
      await (login ? api.login(creds) : api.register(creds));
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <h1>{login ? "Anmelden" : "Registrieren"}</h1>
      <form onSubmit={submit} aria-busy={busy}>
        <label>E-Mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Passwort<input name="password" type="password" required minLength={8} maxLength={256} autoComplete={login ? "current-password" : "new-password"} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>{login ? "Anmelden" : "Konto anlegen"}</button>
      </form>
      <p>
        {login ? <>Noch kein Konto? <Link href="/register">Registrieren</Link></> : <>Schon registriert? <Link href="/login">Anmelden</Link></>}
      </p>
    </main>
  );
}
