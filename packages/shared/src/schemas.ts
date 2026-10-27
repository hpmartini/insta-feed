import { z } from "zod";

const id = z.string().min(1);
const time = z.string().datetime(); // ISO-8601 UTC
// Nur Format-Check; SSRF-Schutz leistet safeFetch beim Abruf.
const httpUrl = z.string().url().refine((u) => /^https?:\/\//i.test(u), "http(s) only");

export const UserSchema = z.object({ id, email: z.string().email(), createdAt: time });
export type User = z.infer<typeof UserSchema>;

export const FeedSchema = z.object({
  id,
  userId: id,
  url: httpUrl,
  title: z.string(),
  iconUrl: httpUrl.optional(),
  subscribed: z.boolean().default(true),
  lastError: z.string().optional(), // letzter fehlgeschlagener Abruf, bis zum nächsten Erfolg
});
export type Feed = z.infer<typeof FeedSchema>;

export const ArticleSchema = z.object({
  id,
  feedId: id,
  guid: id, // stabile Importkennung, eindeutig je Feed
  url: httpUrl,
  title: z.string(),
  content: z.string(),
  publishedAt: time.optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

// Werte wie Legacy (THEMES/VIEWS, refreshMinutes 0–1440; 0 = aus). Tempo in ms pro Zeichen.
export const SettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  view: z.enum(["list", "cards"]),
  refresh_minutes: z.number().int().min(0).max(1440),
  speed: z.number().finite().min(1).max(100),
  default_feed_id: id.nullable(),
}).strict();
export const DEFAULT_SETTINGS: Settings = { theme: "system", view: "list", refresh_minutes: 0, speed: 30, default_feed_id: null };
export type Settings = z.infer<typeof SettingsSchema>;

export const SourceSchema = z.object({
  name: z.string(),
  url: httpUrl,
  origin: z.enum(["feed", "ai"]),
});
export type Source = z.infer<typeof SourceSchema>;

const generated = {
  provider: z.enum(["mock", "gemini", "claude"]),
  model: z.string(),
  promptVersion: z.string().min(1),
  createdAt: time,
};

export const SummarySchema = z.object({
  articleId: id,
  text: z.string().min(1),
  sources: z.array(SourceSchema),
  ...generated,
});
export type Summary = z.infer<typeof SummarySchema>;

export const StoryClusterSchema = z.object({
  id,
  title: z.string().min(1),
  articleIds: z.array(id).min(1),
  sources: z.array(SourceSchema),
  ...generated,
});
export type StoryCluster = z.infer<typeof StoryClusterSchema>;

export interface HealthResponse {
  ok: true;
  sqlite: string;
}
