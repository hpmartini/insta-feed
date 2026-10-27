/** Login-URL mit Rücksprungziel (Pfad + Query); "/" braucht keins. */
export const loginUrl = (path: string, search = ""): string => (path === "/" ? "/login" : `/login?next=${encodeURIComponent(path + search)}`);
