import type { Cluster, FeedItem } from "../types";

export interface SummaryInput {
  title: string;
  /** plain text, article body or feed description */
  text: string;
}

/** Seam between the app and the model: Gemini in production, deterministic mock without a key and in tests. */
export interface AiAdapter {
  summarize(input: SummaryInput): Promise<string>;
  cluster(items: FeedItem[]): Promise<Cluster[]>;
}
