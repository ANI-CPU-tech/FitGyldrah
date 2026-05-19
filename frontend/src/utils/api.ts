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
 * Core JSON fetch wrapper. Returns { data, error, status } — never throws.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

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
      /* 204 No Content */
    }

    if (response.ok) return { data: json as T, error: null, status: response.status };

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

/**
 * Multipart fetch wrapper — does NOT set Content-Type so the browser
 * adds the correct boundary for FormData.
 */
export async function multipartRequest<T = unknown>(
  path: string,
  method: "POST" | "PATCH",
  formData: FormData,
  token: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      /* empty */
    }

    if (response.ok) return { data: json as T, error: null, status: response.status };

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

// ── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<UserProfile>("/api/auth/register/", { method: "POST", body: payload }),

  login: (payload: LoginPayload) =>
    apiRequest<LoginResponse>("/api/auth/login/", { method: "POST", body: payload }),

  claimRole: (payload: ClaimRolePayload, token: string) =>
    apiRequest<ClaimRoleResponse>("/api/auth/claim-role/", {
      method: "POST",
      body: payload,
      token,
    }),
};

// ── Gym API ──────────────────────────────────────────────────────────────────

export const gymApi = {
  mine: (token: string) => apiRequest<Gym[]>("/api/gyms/mine/", { token }),

  create: (payload: GymWritePayload, token: string) =>
    apiRequest<Gym>("/api/gyms/", { method: "POST", body: payload, token }),

  createTier: (gymId: string, payload: TierWritePayload, token: string) =>
    apiRequest<SubscriptionTier>(`/api/gyms/${gymId}/tiers/`, {
      method: "POST",
      body: payload,
      token,
    }),

  applications: (gymId: string, status: string, token: string) =>
    apiRequest<GymApplication[]>(
      `/api/gyms/${gymId}/applications/?status=${status}`,
      { token }
    ),

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

  members: (gymId: string, status: string, token: string) =>
    apiRequest<MemberEnrollment[]>(
      `/api/gyms/${gymId}/members/?status=${status}`,
      { token }
    ),

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

  trainers: (gymId: string, token: string) =>
    apiRequest<TrainerProfile[]>(`/api/gyms/${gymId}/trainers/`, { token }),
};

// ── Payment API ───────────────────────────────────────────────────────────────

export const paymentApi = {
  connectBank: (payload: ConnectBankPayload, token: string) =>
    apiRequest<ConnectBankResponse>("/api/payments/connect-bank/", {
      method: "POST",
      body: payload,
      token,
    }),
};

// ── Trainer API ───────────────────────────────────────────────────────────────

export const trainerApi = {
  /** GET /api/trainers/profile/ */
  getProfile: (token: string) =>
    apiRequest<TrainerProfile>("/api/trainers/profile/", { token }),

  /** POST /api/trainers/profile/setup/ — multipart */
  setupProfile: (formData: FormData, token: string) =>
    multipartRequest<TrainerProfile>(
      "/api/trainers/profile/setup/",
      "POST",
      formData,
      token
    ),

  /** PATCH /api/trainers/profile/ — multipart */
  updateProfile: (formData: FormData, token: string) =>
    multipartRequest<TrainerProfile>(
      "/api/trainers/profile/",
      "PATCH",
      formData,
      token
    ),

  /** POST /api/trainers/apply/ */
  apply: (payload: TrainerApplyPayload, token: string) =>
    apiRequest<GymApplication>("/api/trainers/apply/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/trainers/applications/mine/ */
  myApplications: (token: string) =>
    apiRequest<GymApplication[]>("/api/trainers/applications/mine/", { token }),

  /** GET /api/members/clients/ — trainer's assigned client roster */
  clients: (token: string) =>
    apiRequest<TrainerClient[]>("/api/members/clients/", { token }),
};

// ── Biometrics API ────────────────────────────────────────────────────────────

export const biometricsApi = {
  /** GET /api/biometrics/member/<member_id>/ — trainer reads assigned member */
  memberHistory: (memberId: string, token: string) =>
    apiRequest<BiometricEntry[]>(`/api/biometrics/member/${memberId}/`, { token }),

  /** GET /api/biometrics/trends/?granularity=weekly */
  trends: (params: string, token: string) =>
    apiRequest<BiometricTrendsResponse>(`/api/biometrics/trends/?${params}`, {
      token,
    }),
};

// ── Schedule API ──────────────────────────────────────────────────────────────

export const scheduleApi = {
  /** GET /api/schedules/trainer/?upcoming=true */
  list: (query: string, token: string) =>
    apiRequest<Schedule[]>(`/api/schedules/trainer/?${query}`, { token }),

  /** POST /api/schedules/trainer/ */
  create: (payload: ScheduleCreatePayload, token: string) =>
    apiRequest<Schedule>("/api/schedules/trainer/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** PUT /api/schedules/trainer/<id>/complete/ */
  markComplete: (scheduleId: string, token: string) =>
    apiRequest<{ detail: string; schedule: Schedule }>(
      `/api/schedules/trainer/${scheduleId}/complete/`,
      { method: "PUT", token }
    ),
};

// ── Plans API ─────────────────────────────────────────────────────────────────

export const planApi = {
  /** GET /api/plans/trainer/?member_id=<id> */
  list: (query: string, token: string) =>
    apiRequest<FitnessPlan[]>(`/api/plans/trainer/?${query}`, { token }),

  /** POST /api/plans/trainer/generate/ */
  generate: (payload: AIGeneratePayload, token: string) =>
    apiRequest<AIGenerateResponse>("/api/plans/trainer/generate/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/plans/trainer/generate/<task_id>/status/ */
  pollStatus: (taskId: string, token: string) =>
    apiRequest<AIStatusResponse>(
      `/api/plans/trainer/generate/${taskId}/status/`,
      { token }
    ),

  /** PATCH /api/plans/trainer/<id>/ — edit content_json */
  update: (planId: string, payload: Partial<FitnessPlan>, token: string) =>
    apiRequest<FitnessPlan>(`/api/plans/trainer/${planId}/`, {
      method: "PATCH",
      body: payload,
      token,
    }),

  /** PUT /api/plans/trainer/<id>/approve/ */
  approve: (planId: string, token: string) =>
    apiRequest<{ detail: string; plan: FitnessPlan }>(
      `/api/plans/trainer/${planId}/approve/`,
      { method: "PUT", token }
    ),
};

// ── AI Logs API ───────────────────────────────────────────────────────────────

export const aiApi = {
  /** GET /api/ai/logs/ */
  logs: (query: string, token: string) =>
    apiRequest<AIPromptLog[]>(`/api/ai/logs/?${query}`, { token }),

  /** GET /api/ai/logs/<id>/ */
  logDetail: (logId: string, token: string) =>
    apiRequest<AIPromptLogDetail>(`/api/ai/logs/${logId}/`, { token }),
};

// ── Auth types ────────────────────────────────────────────────────────────────

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

// ── Gym types ─────────────────────────────────────────────────────────────────

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

// ── Trainer types ─────────────────────────────────────────────────────────────

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

export interface TrainerApplyPayload {
  gym: string; // gym UUID
  cover_letter?: string;
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

// ── Member / Enrollment types ─────────────────────────────────────────────────

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

// ── Biometrics types ──────────────────────────────────────────────────────────

export interface BiometricEntry {
  id: string;
  weight: number | null;
  height: number | null;
  body_fat_pct: number | null;
  muscle_mass: number | null;
  bmi: number | null;
  bmi_category: string | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  resting_hr: number | null;
  notes: string;
  recorded_at: string;
  created_at: string;
}

export interface BiometricTrendRow {
  period: string;
  avg_weight: number | null;
  avg_body_fat: number | null;
  avg_bmi: number | null;
  avg_muscle_mass: number | null;
  avg_resting_hr: number | null;
  reading_count: number;
}

export interface BiometricTrendsResponse {
  granularity: string;
  from_date: string;
  to_date: string;
  results: BiometricTrendRow[];
}

// ── Schedule types ────────────────────────────────────────────────────────────

export type SessionType = "WORKOUT" | "CONSULTATION" | "ASSESSMENT" | "DIET_REVIEW";
export type ScheduleStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export interface Schedule {
  id: string;
  trainer_name: string;
  trainer_email: string;
  member_name: string;
  member_email: string;
  gym_name: string;
  session_type: SessionType;
  session_type_label: string;
  proposed_time: string;
  duration_minutes: number;
  end_time: string;
  location: string;
  notes: string;
  status: ScheduleStatus;
  status_label: string;
  member_note: string;
  is_upcoming: boolean;
  responded_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleCreatePayload {
  member: string; // UUID
  gym: string; // UUID
  session_type: SessionType;
  proposed_time: string; // ISO datetime
  duration_minutes: number;
  location?: string;
  notes?: string;
}

// ── Plan types ────────────────────────────────────────────────────────────────

export type PlanType = "DIET" | "WORKOUT";
export type PlanStatus = "DRAFT" | "APPROVED" | "ARCHIVED";

export interface FitnessPlan {
  id: string;
  title: string;
  plan_type: PlanType;
  plan_type_label: string;
  trainer_name: string;
  trainer_email: string;
  member_name: string;
  content_json: Record<string, unknown>;
  notes: string;
  ai_generated: boolean;
  ai_task_id: string;
  status: PlanStatus;
  status_label: string;
  version: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIGeneratePayload {
  member_id: string;
  plan_type: PlanType;
  extra_instructions?: string;
}

export interface AIGenerateResponse {
  detail: string;
  task_id: string;
  member_id: string;
  plan_type: PlanType;
}

export interface AIStatusResponse {
  state: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  detail: string;
  plan?: FitnessPlan;
}

// ── AI Log types ──────────────────────────────────────────────────────────────

export interface AIPromptLog {
  id: string;
  plan_type: string;
  member_name: string;
  plan_id: string | null;
  model_used: string;
  total_tokens: number;
  gen_status: "PENDING" | "SUCCESS" | "FAILED";
  status_label: string;
  extra_instructions: string;
  created_at: string;
  completed_at: string | null;
}

export interface AIPromptLogDetail extends AIPromptLog {
  trainer_name: string;
  celery_task_id: string;
  system_prompt: string;
  user_prompt: string;
  raw_response: string;
  error_message: string;
  prompt_tokens: number;
  completion_tokens: number;
}

// ── Payment types ─────────────────────────────────────────────────────────────

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

// ── Member-facing API helpers ─────────────────────────────────────────────────

export const memberApi = {
  /** GET /api/members/gyms/?search= */
  discoverGyms: (search: string, token: string) =>
    apiRequest<GymDiscovery[]>(
      `/api/members/gyms/${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      { token }
    ),

  /** POST /api/members/enroll/ */
  enroll: (payload: EnrollPayload, token: string) =>
    apiRequest<MyEnrollment>("/api/members/enroll/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/members/enrollments/?status= */
  enrollments: (status: string, token: string) =>
    apiRequest<MyEnrollment[]>(
      `/api/members/enrollments/${status ? `?status=${status}` : ""}`,
      { token }
    ),

  /** PUT /api/members/enrollments/<id>/cancel/ */
  cancelEnrollment: (id: string, token: string) =>
    apiRequest<{ detail: string; enrollment: MyEnrollment }>(
      `/api/members/enrollments/${id}/cancel/`,
      { method: "PUT", token }
    ),

  /** POST /api/members/enrollments/<id>/renew/ */
  renewEnrollment: (id: string, token: string) =>
    apiRequest<MyEnrollment>(`/api/members/enrollments/${id}/renew/`, {
      method: "POST",
      token,
    }),
};

export const memberPaymentApi = {
  /** POST /api/payments/create-order/ */
  createOrder: (enrollmentId: string, token: string) =>
    apiRequest<OrderCreateResponse>("/api/payments/create-order/", {
      method: "POST",
      body: { enrollment_id: enrollmentId },
      token,
    }),

  /** POST /api/payments/verify/ */
  verify: (payload: PaymentVerifyPayload, token: string) =>
    apiRequest<PaymentVerifyResponse>("/api/payments/verify/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/payments/history/ */
  history: (token: string) =>
    apiRequest<Transaction[]>("/api/payments/history/", { token }),
};

export const memberBiometricsApi = {
  /** POST /api/biometrics/ */
  log: (payload: BiometricWritePayload, token: string) =>
    apiRequest<BiometricEntry>("/api/biometrics/", {
      method: "POST",
      body: payload,
      token,
    }),

  /** GET /api/biometrics/latest/ */
  latest: (token: string) =>
    apiRequest<BiometricLatest>("/api/biometrics/latest/", { token }),

  /** GET /api/biometrics/history/ */
  history: (token: string) =>
    apiRequest<BiometricEntry[]>("/api/biometrics/history/", { token }),

  /** GET /api/biometrics/trends/?granularity=weekly */
  trends: (granularity: string, token: string) =>
    apiRequest<BiometricTrendsResponse>(
      `/api/biometrics/trends/?granularity=${granularity}`,
      { token }
    ),

  /** DELETE /api/biometrics/<id>/delete/ */
  delete: (id: string, token: string) =>
    apiRequest<{ detail: string }>(`/api/biometrics/${id}/delete/`, {
      method: "DELETE",
      token,
    }),
};

export const memberScheduleApi = {
  /** GET /api/schedules/member/?status=PENDING */
  list: (query: string, token: string) =>
    apiRequest<Schedule[]>(`/api/schedules/member/?${query}`, { token }),

  /** PUT /api/schedules/member/<id>/respond/ */
  respond: (id: string, payload: ScheduleRespondPayload, token: string) =>
    apiRequest<{ detail: string; schedule: Schedule }>(
      `/api/schedules/member/${id}/respond/`,
      { method: "PUT", body: payload, token }
    ),

  /** PUT /api/schedules/member/<id>/cancel/ */
  cancel: (id: string, token: string) =>
    apiRequest<{ detail: string; schedule: Schedule }>(
      `/api/schedules/member/${id}/cancel/`,
      { method: "PUT", token }
    ),
};

export const memberPlanApi = {
  /** GET /api/plans/member/active/ */
  active: (token: string) =>
    apiRequest<FitnessPlan[]>("/api/plans/member/active/", { token }),
};

export const memberProfileApi = {
  /** GET /api/auth/me/ */
  get: (token: string) => apiRequest<UserProfile>("/api/auth/me/", { token }),

  /** PUT /api/auth/me/ */
  update: (payload: ProfileUpdatePayload, token: string) =>
    apiRequest<UserProfile>("/api/auth/me/", {
      method: "PUT",
      body: payload,
      token,
    }),
};

// ── Member-specific types ─────────────────────────────────────────────────────

export interface GymDiscovery {
  id: string;
  name: string;
  location: string;
  facilities: string;
  operating_hours: Record<string, string>;
  logo_url: string;
  owner_name: string;
  trainer_count: number;
  tiers: SubscriptionTier[];
  is_enrolled: boolean;
}

export interface EnrollPayload {
  gym_id: string;
  tier_id: string;
}

export interface MyEnrollment {
  id: string;
  gym_name: string;
  gym_location: string;
  tier_name: string;
  tier_duration: string;
  price_paid: string;
  trainer_name: string | null;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_expired: boolean;
  status: "PENDING_PAYMENT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderCreateResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  razorpay_key_id: string;
  transaction_id: string;
  split: {
    platform_fee_pct: number;
    platform_fee_inr: string;
    gym_transfer_inr: string;
  };
  prefill: { name: string; email: string };
  description: string;
}

export interface PaymentVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerifyResponse {
  detail: string;
  transaction: Transaction;
  enrollment: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    gym: string;
    tier: string;
  };
}

export interface Transaction {
  id: string;
  gym_name: string;
  tier_name: string;
  amount: string;
  currency: string;
  platform_fee_pct: number;
  platform_fee_amount: string;
  gym_transfer_amount: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  status_label: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
}

export interface BiometricLatest {
  latest_weight: number | null;
  latest_height: number | null;
  latest_body_fat: number | null;
  latest_muscle_mass: number | null;
  latest_bmi: number | null;
  latest_bmi_category: string | null;
  latest_waist: number | null;
  latest_resting_hr: number | null;
  last_recorded_at: string | null;
  weight_delta: number | null;
  body_fat_delta: number | null;
}

export interface BiometricWritePayload {
  weight?: number | null;
  height?: number | null;
  body_fat_pct?: number | null;
  muscle_mass?: number | null;
  bmi?: number | null;
  waist_cm?: number | null;
  chest_cm?: number | null;
  hip_cm?: number | null;
  resting_hr?: number | null;
  notes?: string;
  recorded_at?: string;
}

export interface ScheduleRespondPayload {
  action: "accept" | "reject";
  member_note?: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  height?: number | null;
  weight?: number | null;
  body_fat_pct?: number | null;
  goals?: string;
}

// ── Trainer client roster type ────────────────────────────────────────────────

export interface TrainerClient {
  id: string;           // enrollment UUID
  member_id: string;    // member user UUID — used for biometrics endpoint
  member_name: string;
  member_email: string;
  gym_id: string;
  gym_name: string;
  tier_name: string;
  price_paid: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  status: string;
}
