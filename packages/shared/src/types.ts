export interface Feed {
  id: number;
  name: string;
  url: string;
  icon: string;
  subscribed: boolean;
}

export interface FeedItem {
  /** stable across fetches: feed id + hash of guid/link/title */
  id: string;
  feedId: number;
  feedName: string;
  title: string;
  link: string;
  /** plain text, tags stripped */
  description: string;
  /** raw HTML if the feed ships full content, else the description */
  content: string;
  /** ISO 8601 */
  publishedAt: string;
}

export const THEMES = ["light", "dark", "system"] as const;
export const VIEWS = ["list", "cards"] as const;

export interface Settings {
  theme: (typeof THEMES)[number];
  view: (typeof VIEWS)[number];
  refreshMinutes: number;
  /** row runner: seconds per headline */
  speed: number;
  defaultFeedId: number | null;
}

export interface Cluster {
  title: string;
  summary: string;
  itemIds: string[];
}
