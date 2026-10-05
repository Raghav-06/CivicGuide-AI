// Empty = same origin: the Vite dev server proxies /api and /health to the backend,
// and in production the backend serves this app itself. Set VITE_API_BASE to call a backend elsewhere.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** JSON request to the backend, sending the session cookie. Throws ApiError with the server's `detail`. */
export async function apiRequest(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Make sure the backend is running.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail ?? `Request failed (${res.status})`, res.status, data.code);
  return data;
}
