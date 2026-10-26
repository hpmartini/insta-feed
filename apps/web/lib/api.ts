'use client';
import { createApiClient, ApiError } from '@instafeed/api-client';

export const api = createApiClient();

/** Redirects to /login on 401, otherwise returns the message. */
export function errMsg(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) {
    window.location.href = '/login';
    return '';
  }
  return e instanceof Error ? e.message : 'Unbekannter Fehler';
}
