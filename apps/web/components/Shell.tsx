'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '@instafeed/shared';
import { api, errMsg } from '@/lib/api';

type Ctx = { settings: Settings; setSettings: (s: Settings) => void };
const SettingsCtx = createContext<Ctx>({ settings: DEFAULT_SETTINGS, setSettings: () => {} });
export const useSettings = () => useContext(SettingsCtx);

const LINKS = [['/', 'Artikel'], ['/feeds', 'Feeds'], ['/runner', 'Row Runner'], ['/settings', 'Einstellungen']] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const guest = path === '/login' || path === '/register';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (guest) return;
    api.settings().then((s) => { setSettings(s); setReady(true); }).catch(errMsg);
  }, [guest]);

  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);

  async function logout() {
    await api.logout().catch(() => {});
    window.location.href = '/login';
  }

  return (
    <SettingsCtx.Provider value={{ settings, setSettings }}>
      {!guest && (
        <nav className="nav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>
          ))}
          <button onClick={logout}>Abmelden</button>
        </nav>
      )}
      <main>{guest || ready ? children : <p>Lade …</p>}</main>
    </SettingsCtx.Provider>
  );
}
