"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("POST", `/api/auth/${mode}`, { email: f.get("email"), password: f.get("password") });
      router.replace("/articles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2>{register ? "Registrieren" : "Anmelden"}</h2>
      <label>
        E-Mail
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Passwort
        <input name="password" type="password" required minLength={register ? 8 : undefined} autoComplete={register ? "new-password" : "current-password"} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>{register ? "Konto anlegen" : "Anmelden"}</button>
      <p className="muted">
        {register ? <>Schon ein Konto? <Link href="/login">Anmelden</Link></> : <>Noch kein Konto? <Link href="/register">Registrieren</Link></>}
      </p>
    </form>
  );
}
