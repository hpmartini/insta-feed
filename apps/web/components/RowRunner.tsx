"use client";

import { useEffect, useRef, useState } from "react";

/** Headline ticker. `speed` 1-10: higher = faster (0.4 s per character / speed). */
export default function RowRunner({ headlines, speed }: { headlines: string[]; speed: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [full, setFull] = useState(false);
  const text = headlines.join("   •   ");
  const seconds = Math.max(10, (text.length * 0.4) / speed);

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  return (
    <div ref={box} className={`runner ${full ? "runner-full" : ""}`}>
      <div className="runner-bar">
        <button onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? "Weiter" : "Pause"}</button>
        <button onClick={() => (full ? document.exitFullscreen() : box.current?.requestFullscreen())}>{full ? "Vollbild beenden" : "Vollbild"}</button>
      </div>
      {text ? (
        <div className="runner-view" aria-label="Laufschrift der Schlagzeilen">
          <span className="runner-track" style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? "paused" : "running" }}>{text}</span>
        </div>
      ) : (
        <p className="muted">Keine Schlagzeilen.</p>
      )}
    </div>
  );
}
