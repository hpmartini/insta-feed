"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authAction } from "@/app/actions";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(authAction, {});
  const isLogin = mode === "login";

  return (
    <form action={action} className="card stack" style={{ maxWidth: 420 }}>
      <h1>{isLogin ? "Anmelden" : "Registrieren"}</h1>
      <input type="hidden" name="mode" value={mode} />
      <label>
        E-Mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Passwort
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          required
        />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "…" : isLogin ? "Anmelden" : "Konto anlegen"}
      </button>
      <p className="muted">
        {isLogin ? (
          <>
            Noch kein Konto? <Link href="/register">Registrieren</Link>
          </>
        ) : (
          <>
            Schon registriert? <Link href="/login">Anmelden</Link>
          </>
        )}
      </p>
    </form>
  );
}
