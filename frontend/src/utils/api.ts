const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

export interface ApiResponse<T = unknown> {
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

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Non-JSON response (e.g. 204 No Content)
    }

    if (response.ok) {
      return { data: json as T, error: null, status: response.status };
    }

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

  claimRole: (payload: ClaimRolePayload, token: string) =>
    apiRequest<ClaimRoleResponse>("/api/auth/claim-role/", {
      method: "POST",
      body: payload,
      token,
    }),
};

export const gymApi = {
  /** GET /api/gyms/mine/ — owner's own gyms */
  mine: (token: string) =>
    apiRequest<Gym[]>("/api/gyms/mine/", { token }),

  /** POST /api/gyms/ — create a new gym */
  create: (payload: GymWritePayload, token: string) =>
    apiRequest<Gym>("/api/gyms/", { method: "POST", body: payload, token }),

  /** POST /api/gyms/<id>/tiers/ — add a subscription tier */
  createTier: (gymId: string, payload: TierWritePayload, token: string) =>
    apiRequest<SubscriptionTier>(`/api/gyms/${gymId}/tiers/`, {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/gyms/<id>/applications/?status=PENDING */
  applications: (gymId: string, status: string, token: string) =>
    apiRequest<GymApplication[]>(
      `/api/gyms/${gymId}/applications/?status=${status}`,
      { token }
    ),

  /** PUT /api/gyms/<id>/applications/<app_id>/review/ */
  reviewApplication: (
    gymId: string,
    appId: string,
    payload: ReviewPayload,
    token: string
  ) =>
    apiRequest<ReviewResponse>(
      `/api/gyms/${gymId}/applications/${appId}/review/`,
      { method: "PUT", body: payload, token }
    ),

  /** GET /api/gyms/<id>/members/?status=ACTIVE */
  members: (gymId: string, status: string, token: string) =>
    apiRequest<MemberEnrollment[]>(
      `/api/gyms/${gymId}/members/?status=${status}`,
      { token }
    ),

  /** PUT /api/gyms/<id>/members/<enrollment_id>/assign-trainer/ */
  assignTrainer: (
    gymId: string,
    enrollmentId: string,
    trainerId: string,
    token: string
  ) =>
    apiRequest<AssignTrainerResponse>(
      `/api/gyms/${gymId}/members/${enrollmentId}/assign-trainer/`,
      { method: "PUT", body: { trainer_id: trainerId }, token }
    ),

  /** GET /api/gyms/<id>/trainers/ — approved trainers at a gym */
  trainers: (gymId: string, token: string) =>
    apiRequest<TrainerProfile[]>(`/api/gyms/${gymId}/trainers/`, { token }),
};

export const paymentApi = {
  /** POST /api/payments/connect-bank/ */
  connectBank: (payload: ConnectBankPayload, token: string) =>
    apiRequest<ConnectBankResponse>("/api/payments/connect-bank/", {
      method: "POST",
      body: payload,
      token,
    }),
};

// ── Auth types ───────────────────────────────────────────────────────────────

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
  id: string;
  email: string;
  name: string;
  role: RoleValue;
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

export type RoleValue = "MEMBER" | "TRAINER" | "OWNER";

export interface ClaimRolePayload {
  role: RoleValue;
}

export interface ClaimRoleResponse {
  detail: string;
  user: UserProfile;
}

// ── Gym types ────────────────────────────────────────────────────────────────

export interface SubscriptionTier {
  id: string;
  gym: string;
  name: string;
  price: string;
  duration_type: "MONTHLY" | "YEARLY";
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Gym {
  id: string;
  name: string;
  location: string;
  facilities: string;
  operating_hours: Record<string, string>;
  logo_url: string;
  is_active: boolean;
  owner_name: string;
  owner_email: string;
  is_payment_ready: boolean;
  tiers: SubscriptionTier[];
  created_at: string;
  updated_at: string;
}

export interface GymWritePayload {
  name: string;
  location: string;
  facilities: string;
  operating_hours: Record<string, string>;
  logo_url?: string;
}

export interface TierWritePayload {
  name: string;
  price: string;
  duration_type: "MONTHLY" | "YEARLY";
  description?: string;
}

// ── Trainer / Application types ──────────────────────────────────────────────

export interface TrainerProfile {
  id: string;
  name: string;
  email: string;
  certifications: string;
  years_experience: number;
  specialty: string;
  bio: string;
  cv_file: string | null;
  profile_picture: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface GymApplication {
  id: string;
  gym_name: string;
  trainer_name: string;
  trainer_email: string;
  trainer_specialty: string;
  trainer_experience: number;
  trainer_cv: string | null;
  cover_letter: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  owner_note: string;
  applied_at: string;
  reviewed_at: string | null;
}

export interface ReviewPayload {
  action: "approve" | "reject";
  owner_note?: string;
}

export interface ReviewResponse {
  detail: string;
  application: GymApplication;
}

// ── Member / Enrollment types ────────────────────────────────────────────────

export interface MemberEnrollment {
  id: string;
  member_name: string;
  member_email: string;
  tier_name: string;
  price_paid: string;
  trainer_name: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
}

export interface AssignTrainerResponse {
  detail: string;
  enrollment: MemberEnrollment;
}

// ── Payment types ────────────────────────────────────────────────────────────

export interface ConnectBankPayload {
  gym_id: string;
  account_number: string;
  ifsc_code: string;
}

export interface ConnectBankResponse {
  detail: string;
  gym_id: string;
  linked_account_hint: string;
  is_payment_ready: boolean;
}
