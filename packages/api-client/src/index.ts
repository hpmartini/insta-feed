import type { HealthResponse } from "@insta-feed/shared";

export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  return {
    async health(): Promise<HealthResponse> {
      const res = await fetchImpl(`${baseUrl}/health`);
      if (!res.ok) throw new Error(`health failed: ${res.status}`);
      return (await res.json()) as HealthResponse;
    },
  };
}
