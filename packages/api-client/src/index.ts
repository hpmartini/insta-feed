import type {
  ArticleDetail, ArticleListItem, ClustersResult, Feed, FeedInput, Settings, Summary, User,
} from '@instafeed/shared';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Typed fetch wrapper for the InstaFeed API. `base` is '' in the browser (Next rewrites /api). */
export function createApiClient(base = '', fetchImpl: typeof fetch = fetch) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await fetchImpl(`${base}/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
    return data as T;
  }
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return s ? `?${s}` : '';
  };

  return {
    me: () => call<{ user: User }>('/auth/me').then((r) => r.user),
    register: (email: string, password: string, name: string) =>
      call<{ user: User }>('/auth/register', 'POST', { email, password, name }).then((r) => r.user),
    login: (email: string, password: string) =>
      call<{ user: User }>('/auth/login', 'POST', { email, password }).then((r) => r.user),
    logout: () => call<{ ok: true }>('/auth/logout', 'POST'),
    feeds: () => call<{ feeds: Feed[] }>('/feeds').then((r) => r.feeds),
    addFeed: (input: FeedInput) => call<{ feed: Feed }>('/feeds', 'POST', input).then((r) => r.feed),
    updateFeed: (id: string, patch: Partial<FeedInput> & { subscribed?: boolean }) =>
      call<{ feed: Feed }>(`/feeds/${id}`, 'PATCH', patch).then((r) => r.feed),
    deleteFeed: (id: string) => call<{ ok: true }>(`/feeds/${id}`, 'DELETE'),
    articles: (feedId?: string) =>
      call<{ articles: ArticleListItem[] }>(`/articles${q({ feedId })}`).then((r) => r.articles),
    article: (url: string) => call<ArticleDetail>(`/article${q({ url })}`),
    summary: (url: string, title: string, text: string) =>
      call<Summary>('/ai/summary', 'POST', { url, title, text }),
    clusters: (feedId?: string) => call<ClustersResult>(`/ai/clusters${q({ feedId })}`),
    settings: () => call<{ settings: Settings }>('/settings').then((r) => r.settings),
    saveSettings: (s: Partial<Settings>) =>
      call<{ settings: Settings }>('/settings', 'PUT', s).then((r) => r.settings),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
