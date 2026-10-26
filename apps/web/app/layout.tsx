import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Shell from '@/components/Shell';
import './globals.css';

export const metadata: Metadata = { title: 'InstaFeed', description: 'RSS-Reader mit KI-Zusammenfassung' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" data-theme="light" suppressHydrationWarning>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
