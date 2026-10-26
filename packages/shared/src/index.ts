export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  icon?: string;
  subscribed: boolean;
}

export interface FeedInput {
  name: string;
  url: string;
  icon?: string;
}

export interface FeedItem {
  guid: string;
  title: string;
  link: string;
  content: string;
  snippet: string;
  isoDate: string;
}

/** Article overview entry: a feed item tagged with its feed. */
export interface ArticleListItem extends FeedItem {
  feedId: string;
  feedName: string;
}

export interface ArticleDetail {
  siteName: string;
  title: string;
  excerpt: string;
  content: string;
  url: string;
}

export interface Settings {
  theme: 'light' | 'dark';
  view: 'list' | 'grid';
  /** Row Runner speed in characters per second. */
  speed: number;
  /** Feed id preselected in the overview, '' for all. */
  defaultFeed: string;
  /** Auto refresh of the overview in minutes, 0 = off. */
  refreshMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  view: 'list',
  speed: 30,
  defaultFeed: '',
  refreshMinutes: 0,
};

export type AiProvider = 'mock' | 'gemini';

export interface Summary {
  summary: string;
  provider: AiProvider;
}

export interface StoryCluster {
  title: string;
  summary: string;
  articles: ArticleListItem[];
}

export interface ClustersResult {
  clusters: StoryCluster[];
  provider: AiProvider;
}

// --- Story clustering (pure, shared by the mock adapter and the Gemini fallback) ---

const STOP_WORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'und', 'oder', 'aber', 'nicht',
  'ist', 'sind', 'war', 'hat', 'wird', 'für', 'mit', 'von', 'auf', 'aus', 'bei', 'nach', 'vor',
  'über', 'unter', 'sich', 'wie', 'als', 'wenn', 'dass', 'im', 'am', 'zum', 'zur', 'vom',
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'has', 'have', 'for', 'with', 'from',
  'by', 'to', 'in', 'on', 'at', 'of', 'be', 'as', 'it', 'its',
]);

export function normalizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-zäöüß\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / (a.size + b.size - common);
}

/** Greedy single-link grouping by title similarity; returns groups of indexes. */
export function clusterIndexes(titles: string[], threshold = 0.4): number[][] {
  const words = titles.map(normalizeTitle);
  const groups: number[][] = [];
  titles.forEach((_, i) => {
    const group = groups.find((g) => g.some((j) => jaccardSimilarity(words[i]!, words[j]!) >= threshold));
    if (group) group.push(i);
    else groups.push([i]);
  });
  return groups;
}
