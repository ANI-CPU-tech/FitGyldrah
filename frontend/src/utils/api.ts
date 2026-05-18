const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

interface ApiResponse<T = unknown> {
  data: T | null;
  error: Record<string, string | string[]> | null;
  status: number;
}

/**
 * Core fetch wrapper. Returns { data, error, status } so callers never
 * have to deal with raw Response objects or thrown exceptions.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Try to parse JSON regardless of status so we can surface DRF errors
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Non-JSON response (e.g. 204 No Content)
    }

    if (response.ok) {
      return { data: json as T, error: null, status: response.status };
    }

    // DRF returns errors as an object: { field: ["msg"], detail: "msg" }
    const errorPayload =
      json && typeof json === "object"
        ? (json as Record<string, string | string[]>)
        : { detail: "An unexpected error occurred." };

    return { data: null, error: errorPayload, status: response.status };
  } catch {
    return {
      data: null,
      error: { detail: "Network error. Is the backend running?" },
      status: 0,
    };
  }
}

// ── Convenience helpers ──────────────────────────────────────────────────────

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<UserProfile>("/api/auth/register/", {
      method: "POST",
      body: payload,
    }),

  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>("/api/auth/login/", {
      method: "POST",
      body: payload,
    }),
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
  password2: string;
  height?: number | null;
  weight?: number | null;
  body_fat_pct?: number | null;
  goals?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: string;
  height: number | null;
  weight: number | null;
  body_fat_pct: number | null;
  goals: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}
