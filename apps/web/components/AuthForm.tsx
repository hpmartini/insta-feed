'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { api, errMsg } from '@/lib/api';

export default function AuthForm({ register }: { register?: boolean }) {
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    try {
      if (register) await api.register(email, password, String(f.get('name')));
      else await api.login(email, password);
      window.location.href = '/'; // full load so the shell fetches settings
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <form className="card auth" onSubmit={submit}>
      <h1>{register ? 'Registrieren' : 'Anmelden'}</h1>
      {register && <input name="name" placeholder="Name" required />}
      <input name="email" type="email" placeholder="E-Mail" required />
      <input name="password" type="password" placeholder="Passwort" required />
      {error && <p className="error">{error}</p>}
      <button className="primary">{register ? 'Konto erstellen' : 'Anmelden'}</button>
      <p>{register ? <Link href="/login">Schon ein Konto? Anmelden</Link> : <Link href="/register">Noch kein Konto? Registrieren</Link>}</p>
    </form>
  );
}
