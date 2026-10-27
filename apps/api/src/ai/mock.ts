import type { AiAdapter } from "./adapter";

/** Deterministic, offline: a pure function of the input (no clock, no randomness, no network). */
export class MockAdapter implements AiAdapter {
  readonly provider = "mock" as const;
  readonly model = "mock-extractive-v1";

  async summarize({ title, content }: { title: string; content: string }) {
    const head = title.trim() || "Untitled";
    const body = content.replace(/\s+/g, " ").trim().slice(0, 280);
    return { text: body ? `${head}: ${body}` : head };
  }
}
