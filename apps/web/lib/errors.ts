/** Thrown anywhere below a route handler; `api()` in http.ts turns it into a JSON error response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
