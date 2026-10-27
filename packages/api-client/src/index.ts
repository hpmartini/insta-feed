import { z } from "zod";
import {
  ArticleContentSchema, ArticleSchema, ErrorBodySchema, FeedSchema, RefreshResultSchema, SettingsSchema, StoryClusterSchema, SummarySchema, UserSchema,
  type Article, type ArticleContent, type Credentials, type Feed, type FeedCreate, type FeedUpdate, type HealthResponse, type RefreshResult,
  type Settings, type StoryCluster, type Summary, type User,
} from "@insta-feed/shared";

export type ApiErrorKind = "http" | "network" | "response";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    /** HTTP status; 0 for network errors, the received status for malformed responses. */
    readonly status = 0,
    /** Validated validation issues of a 400 response. */
    readonly issues?: unknown[],
    /** Validated refresh result carried by a 502 from POST /feeds/:id/refresh. */
    readonly refresh?: RefreshResult,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

const HealthSchema = z.object({ ok: z.literal(true), sqlite: z.string() });
const enc = encodeURIComponent;

/** baseUrl defaults to "/api" (same-origin proxy of apps/web); cookies are sent with credentials "same-origin". */
export function createApiClient(baseUrl = "/api", fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = (input, init) => fetch(input, init)) {
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown> | null, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        credentials: "same-origin",
        ...(body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      });
    } catch (e) {
      throw new ApiError("network", "network error", 0, undefined, undefined, { cause: e });
    }
    const text = await res.text().catch(() => "");
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    if (!res.ok) throw httpError(res.status, text, json);
    if (schema === null) return undefined as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiError("response", "unexpected response format", res.status);
    return parsed.data;
  }

  return {
    health: () => request<HealthResponse>("GET", "/health", HealthSchema),

    register: (c: Credentials) => request<User>("POST", "/auth/register", UserSchema, c),
    login: (c: Credentials) => request<User>("POST", "/auth/login", UserSchema, c),
    me: () => request<User>("GET", "/auth/me", UserSchema),
    logout: () => request<void>("POST", "/auth/logout", null),

    listFeeds: () => request<Feed[]>("GET", "/feeds", z.array(FeedSchema)),
    createFeed: (input: FeedCreate) => request<Feed>("POST", "/feeds", FeedSchema, input),
    getFeed: (id: string) => request<Feed>("GET", `/feeds/${enc(id)}`, FeedSchema),
    updateFeed: (id: string, patch: FeedUpdate) => request<Feed>("PATCH", `/feeds/${enc(id)}`, FeedSchema, patch),
    deleteFeed: (id: string) => request<void>("DELETE", `/feeds/${enc(id)}`, null),
    setSubscribed: (id: string, subscribed: boolean) => request<Feed>("PATCH", `/feeds/${enc(id)}`, FeedSchema, { subscribed }),
    refreshFeed: (id: string) => request<RefreshResult>("POST", `/feeds/${enc(id)}/refresh`, RefreshResultSchema),

    listArticles: (filter: { feedId?: string } = {}) =>
      request<Article[]>("GET", `/articles${filter.feedId === undefined ? "" : `?feedId=${enc(filter.feedId)}`}`, z.array(ArticleSchema)),
    articleContent: (id: string) => request<ArticleContent>("GET", `/articles/${enc(id)}/content`, ArticleContentSchema),
    summarize: (id: string) => request<Summary>("POST", `/articles/${enc(id)}/summary`, SummarySchema),

    listStories: () => request<StoryCluster[]>("GET", "/stories", z.array(StoryClusterSchema)),

    getSettings: () => request<Settings>("GET", "/settings", SettingsSchema),
    putSettings: (s: Settings) => request<Settings>("PUT", "/settings", SettingsSchema, s),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function httpError(status: number, text: string, json: unknown): ApiError {
  const err = ErrorBodySchema.safeParse(json);
  const message = err.success ? err.data.error : text.trim().slice(0, 200) || `HTTP ${status}`;
  const issues = err.success && status === 400 ? err.data.issues : undefined;
  const refresh = status === 502 ? RefreshResultSchema.safeParse(json) : undefined;
  return new ApiError("http", message, status, issues, refresh?.success ? refresh.data : undefined);
}
