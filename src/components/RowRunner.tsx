"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { typewriterFrames } from "@/lib/typewriter";
import styles from "./RowRunner.module.css";

const CARET = "▉";

export interface RowRunnerProps {
  title: string;
  text: string;
  /** Milliseconds per character. */
  speed: number;
}

export default function RowRunner({ title, text, speed }: RowRunnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState("");
  const [pageStart, setPageStart] = useState(0);

  useEffect(() => {
    if (!running) return;
    const frames = typewriterFrames(text);
    const id = setInterval(() => {
      const next = frames.next();
      if (next.done) setRunning(false);
      else setFrame(next.value);
    }, Math.max(1, speed));
    return () => clearInterval(id);
  }, [running, text, speed]);

  // Box full: start a new page with the character just written.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && box.scrollHeight > box.clientHeight) setPageStart(Math.max(0, frame.length - 1));
  }, [frame]);

  useEffect(() => {
    if (!running && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [running]);

  const start = () => {
    setFrame("");
    setPageStart(0);
    setRunning(true);
  };

  const startFullscreen = () => {
    if (!running) start();
    // Optional call: iOS Safari has no Element.requestFullscreen; we then run inline.
    containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div ref={containerRef} className={styles.runner}>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <button
          type="button"
          className={styles.button}
          onClick={running ? () => setRunning(false) : start}
          aria-label={running ? "Row Runner stoppen" : "Row Runner starten"}
        >
          {running ? "Stop" : "Start"}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={startFullscreen}
          aria-label="Row Runner im Vollbild starten"
        >
          Vollbild
        </button>
      </div>

      {running ? (
        <>
          <p className={styles.visuallyHidden} lang="de">
            {text}
          </p>
          <div ref={boxRef} className={styles.box} lang="de" aria-live="off" aria-hidden="true">
            {frame.slice(pageStart)}
            <span className={styles.caret}>{CARET}</span>
          </div>
        </>
      ) : (
        <article className={styles.article} lang="de">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>
      )}
    </div>
  );
}
