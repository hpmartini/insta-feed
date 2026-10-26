'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { useSettings } from '@/components/Shell';

function Runner() {
  const url = useSearchParams().get('url');
  const { settings } = useSettings();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = url
      ? api.article(url).then((a) => a.content)
      : api.articles().then((l) => l.map((a) => a.title).join('   •   '));
    load.then((t) => setText(t.replace(/\s+/g, ' '))).catch((e) => setError(errMsg(e)));
  }, [url]);

  const seconds = Math.max(5, text.length / Math.max(1, settings.speed));

  return (
    <div ref={box} className="runner">
      <div className="bar">
        <h1>Row Runner</h1>
        <button onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Abspielen'}</button>
        <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())}>Vollbild</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="marquee">
        {text && (
          <span style={{ animationDuration: `${seconds}s`, animationPlayState: playing ? 'running' : 'paused' }}>{text}</span>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Runner /></Suspense>;
}
