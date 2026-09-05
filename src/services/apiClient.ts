const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_MAIN_URL ||
  "https://app.nowlny.com";

export { API_BASE_URL };

/**
 * Nearly every list endpoint in the Nowlny API answers with this envelope
 * (`{ data, total, page, limit, totalPages }`) rather than a bare array.
 * Several services used to type those responses as `T[]` and then
 * `Array.isArray()` them, which silently produced an empty list — the
 * dashboard's merchant count, for one, was permanently 0.
 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

/** A few endpoints (`/currencies`, `/…/delivery-zones`) really do return arrays. */
export function toList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}

export function toPaginated<T>(
  payload: unknown,
  fallbackLimit = 20,
): Paginated<T> {
  const data = toList<T>(payload);
  const envelope = (payload ?? {}) as Partial<Paginated<T>>;
  const total =
    typeof envelope.total === "number" ? envelope.total : data.length;
  const limit =
    typeof envelope.limit === "number" ? envelope.limit : fallbackLimit;
  return {
    data,
    total,
    page: typeof envelope.page === "number" ? envelope.page : 1,
    limit,
    totalPages:
      typeof envelope.totalPages === "number"
        ? envelope.totalPages
        : Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

/**
 * The id of a record the API just created.
 *
 * Create endpoints are documented as "Item created" with no response schema,
 * so what comes back is not guaranteed: the record itself, an envelope around
 * it, or a Mongo-style `_id`. Reading `.id` and nothing else yields
 * `undefined` on the other two, and whatever was going to be attached to that
 * record — a dish's modifiers, a restaurant's categories — is then lost with
 * no error to show for it.
 */
export function readId(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;

  const source = record as { id?: unknown; _id?: unknown; data?: unknown };
  const direct = source.id ?? source._id;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "number") return String(direct);

  return source.data ? readId(source.data) : null;
}

/**
 * Serialises query params, dropping `undefined`, `null`, `""` and the sentinel
 * `"all"` the filter chips use for "no filter". Hand-rolled `URLSearchParams`
 * blocks were duplicated across nine services and each one forgot a different
 * subset of the parameters the API actually supports.
 */
export function buildQuery(
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const asString = String(value).trim();
    if (asString === "" || asString === "all") continue;
    search.append(key, asString);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

const formatApiError = (status: number, errorText: string): string => {
  try {
    const data = JSON.parse(errorText);

    // Extract human-readable messages from common JSON error structures
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error.message === "string")
      return data.error.message;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: { message?: string; msg?: string }) => e.message || e.msg || e)
        .join(", ");
    }

    return `Request failed (${status}).`;
  } catch {
    // Not JSON
    if (errorText && errorText.trim().length > 0) {
      // Don't show raw HTML to the user
      if (errorText.trim().startsWith("<")) {
        return `Server Error (${status})`;
      }
      return errorText.length > 100
        ? `${errorText.substring(0, 100)}...`
        : errorText;
    }
    return `Server Error (${status})`;
  }
};

/**
 * Carries the HTTP status alongside the message. Callers used to sniff for
 * `"404"` inside the message string, which also matched any error text that
 * happened to contain those digits.
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const isNotFound = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 404;

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
};

/**
 * One in-flight refresh shared by every concurrent 401. The previous
 * `isRefreshing` boolean made *other* requests skip the refresh entirely and
 * fail, so a single expired token could sign the operator out mid-dashboard
 * while a perfectly good refresh token sat in storage.
 */
let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      const accessToken = data.access_token || data.accessToken;
      const nextRefresh = data.refresh_token || data.refreshToken;
      if (!accessToken) return null;

      localStorage.setItem("token", accessToken);
      if (nextRefresh) localStorage.setItem("refreshToken", nextRefresh);
      return accessToken as string;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so simultaneous callers all read this result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
};

const parseBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return {} as T;
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
};

export const apiClient = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // `FormData` must set its own multipart boundary — forcing a JSON
  // Content-Type onto an upload makes the server reject every file.
  const isFormData =
    typeof FormData !== "undefined" && options?.body instanceof FormData;

  const buildHeaders = (accessToken: string | null): HeadersInit => ({
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options?.headers || {}),
  });

  let response = await fetch(url, { ...options, headers: buildHeaders(token) });

  if (response.status === 401 && typeof window !== "undefined") {
    const nextToken = await refreshAccessToken();

    if (nextToken) {
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(nextToken),
      });
    } else {
      // The session is genuinely over. Drop it and let the app fall back to
      // the login screen instead of reloading straight into the same 401.
      clearSession();
      window.dispatchEvent(new CustomEvent("nowlny:session-expired"));
      throw new ApiError(
        401,
        "Your session has expired. Please sign in again.",
      );
    }
  }

  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      /* body already consumed or empty */
    }
    throw new ApiError(
      response.status,
      formatApiError(response.status, errorText),
    );
  }

  return parseBody<T>(response);
};
