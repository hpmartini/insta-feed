/** Domain types shared by server code, route handlers and UI. */

export interface User {
  id: string;
  email: string;
}

export interface Feed {
  id: number;
  userId: string;
  name: string;
  url: string;
  /** Emoji or short label shown next to the feed name. */
  icon: string;
  subscribed: boolean;
  createdAt: string;
}

export interface FeedInput {
  name: string;
  url: string;
  icon?: string;
}

/** One entry of a parsed RSS/Atom feed. */
export interface FeedItem {
  guid: string;
  title: string;
  link: string;
  snippet: string;
  /** ISO 8601, null when the feed gives no parseable date. */
  publishedAt: string | null;
  feedId?: number;
  feedName?: string;
}

export interface ParsedFeed {
  title: string;
  link: string;
  items: FeedItem[];
}

/** Readable article text extracted from a web page. */
export interface Article {
  url: string;
  title: string;
  siteName: string | null;
  excerpt: string | null;
  /** Plain text, whitespace collapsed. */
  content: string;
}

export type Theme = "system" | "light" | "dark";
export type ArticleView = "list" | "stories";

export interface Settings {
  theme: Theme;
  view: ArticleView;
  /** Auto-refresh interval of the article overview; 0 = off. */
  refreshMinutes: number;
  /** Row Runner speed in milliseconds per character. */
  speed: number;
  defaultFeedId: number | null;
}

/** A cluster of feed items reporting on the same story, across feeds. */
export interface Story {
  id: string;
  title: string;
  summary: string;
  items: FeedItem[];
}

/** Exchangeable AI layer (mock without key, Gemini with GEMINI_API_KEY). */
export interface AiAdapter {
  readonly name: "mock" | "gemini";
  summarize(input: { title: string; content: string }): Promise<string>;
  clusterStories(items: FeedItem[]): Promise<Story[]>;
}
