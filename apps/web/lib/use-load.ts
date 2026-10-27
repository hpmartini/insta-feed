"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { useSession } from "./session";

export type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Lädt bei Änderung von deps neu; veraltete Antworten werden verworfen. Leere Daten sind "ready", nie "error". */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList): { state: Load<T>; reload: () => void } {
  const { fail } = useSession();
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const mine = ++latest.current;
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    fnRef.current().then(
      (data) => mine === latest.current && setState({ status: "ready", data }),
      (e) => mine === latest.current && setState({ status: "error", message: fail(e) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, fail]);

  return { state, reload: useCallback(() => setTick((n) => n + 1), []) };
}
