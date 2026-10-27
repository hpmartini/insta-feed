"use client";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="error">
      <p>Die Seite konnte nicht angezeigt werden.</p>
      <button onClick={reset}>Erneut versuchen</button>
    </div>
  );
}
