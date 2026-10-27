export interface Feed {
  id: string;
  url: string;
  title: string;
}

export interface HealthResponse {
  ok: true;
  sqlite: string;
}
