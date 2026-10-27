/** Yields the progressively growing visible text, one character per frame. */
export function* typewriterFrames(text: string): Generator<string> {
  const clean = text.replace(/\s+/g, " ").trim();
  for (let i = 1; i <= clean.length; i++) yield clean.slice(0, i);
}
