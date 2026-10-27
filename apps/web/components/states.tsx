import type { ReactNode } from "react";
import type { Load } from "../lib/use-load";

/** Trennt Laden / Fehler / Leer / Inhalt; leer ist kein Fehler. */
export function Async<T>({ state, retry, empty, children }: {
  state: Load<T>;
  retry: () => void;
  empty: string;
  children: (d: T) => ReactNode;
}) {
  if (state.status === "loading") return <p aria-busy="true" role="status">Lade …</p>;
  if (state.status === "error")
    return (
      <div role="alert" className="error">
        <p>{state.message}</p>
        <button onClick={retry}>Erneut versuchen</button>
      </div>
    );
  if (Array.isArray(state.data) && state.data.length === 0) return <p className="muted">{empty}</p>;
  return <>{children(state.data)}</>;
}
