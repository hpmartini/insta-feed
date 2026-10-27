"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Async } from "../../components/states";
import { api, useSession } from "../../lib/session";
import { useLoad, type Load } from "../../lib/use-load";

export function Ticker({ article, autostart }: { article?: string; autostart: boolean }) {
  return article === undefined ? <Headlines autostart={autostart} /> : <ArticleText key={article} id={article} autostart={autostart} />;
}

function Headlines({ autostart }: { autostart: boolean }) {
  const feeds = useLoad(() => api.listFeeds(), []);
  const articles = useLoad(() => api.listArticles(), []);
  const f = feeds.state;
  const a = articles.state;
  const state: Load<string[]> =
    f.status === "error" ? f
    : a.status === "error" ? a
    : f.status === "ready" && a.status === "ready"
      ? { status: "ready", data: a.data.filter((x) => f.data.some((y) => y.id === x.feedId && y.subscribed)).map((x) => x.title) }
      : { status: "loading" };
  return (
    <Async state={state} retry={() => { feeds.reload(); articles.reload(); }} empty="Keine Schlagzeilen in abonnierten Feeds.">
      {(titles) => <Player text={titles.join("\n\n")} autostart={autostart} heading="Ticker: Schlagzeilen" />}
    </Async>
  );
}

function ArticleText({ id, autostart }: { id: string; autostart: boolean }) {
  const content = useLoad(() => api.articleContent(id), [id]);
  const s = content.state;
  if (s.status === "error" && s.message === "not found") return <p role="alert">Artikel nicht gefunden. <Link href="/ticker">Zu den Schlagzeilen</Link></p>;
  if (s.status === "ready" && s.data.text === "") return <p className="muted">Kein Text vorhanden.</p>;
  return (
    <>
      {s.status === "ready" && s.data.fallback && <p className="warn" role="status">Volltext nicht abrufbar – es wird nur der gespeicherte Auszug angezeigt.</p>}
      <Async state={s} retry={content.reload} empty="">
        {(d) => <Player text={d.text} autostart={autostart} heading="Ticker: Artikel" />}
      </Async>
    </>
  );
}

/** Gibt text zeichenweise aus, ein Zeichen je settings.speed ms. Start setzt fort, am Ende stoppt er; erneuter Start beginnt von vorn. */
function Player({ text, autostart, heading }: { text: string; autostart: boolean; heading: string }) {
  const { settings } = useSession();
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(autostart); // einmal je Mount = je geladenem Datensatz
  const [full, setFull] = useState(false);
  const box = useRef<HTMLElement>(null);
  const out = useRef<HTMLDivElement>(null);
  const native = useRef(false);
  const done = pos >= text.length;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setPos((p) => Math.min(p + 1, text.length)), settings.speed);
    return () => clearInterval(t);
  }, [running, settings.speed, text.length]);
  useEffect(() => {
    if (running && done) setRunning(false);
  }, [running, done]);
  useEffect(() => {
    if (out.current) out.current.scrollTop = out.current.scrollHeight;
  }, [pos]);

  // Browser-Vollbild (inkl. Escape) spiegeln; ohne Fullscreen-API bildschirmfüllendes CSS.
  useEffect(() => {
    const sync = () => {
      if (!native.current) return;
      native.current = !!document.fullscreenElement;
      setFull(native.current);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !native.current) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", esc);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function toggleFull() {
    if (full) {
      if (native.current) await document.exitFullscreen().catch(() => {});
      else setFull(false);
      return;
    }
    try {
      await box.current!.requestFullscreen();
      native.current = true;
    } catch {
      native.current = false; // API fehlt oder abgelehnt → CSS-Vollbild
    }
    setFull(true);
  }

  function toggle() {
    if (running) return setRunning(false);
    if (done) setPos(0);
    setRunning(true);
  }

  const status = running ? "Läuft" : done && pos > 0 ? "Ende erreicht" : "Gestoppt";
  return (
    <section ref={box} className={`ticker${full ? " ticker-full" : ""}`} aria-labelledby="ticker-h">
      <h1 id="ticker-h">{heading}</h1>
      <div className="toolbar">
        <button onClick={toggle} aria-pressed={running}>{running ? "Stopp" : done && pos > 0 ? "Neu starten" : "Start"}</button>
        <button onClick={toggleFull}>{full ? "Vollbild verlassen" : "Vollbild"}</button>
        <span role="status" className="muted">{status}</span>
      </div>
      <div ref={out} className="ticker-out" tabIndex={0} aria-label="Laufschrift">{text.slice(0, pos)}</div>
    </section>
  );
}
