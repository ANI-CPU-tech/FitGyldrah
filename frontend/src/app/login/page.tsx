"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/utils/api";

// Helper: flatten DRF error objects into a single readable string
function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function LoginPage() {
  const router = useRouter();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: apiError } = await authApi.login({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (apiError) {
      setError(flattenErrors(apiError));
      return;
    }

    if (data) {
      // Persist tokens in localStorage
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      // Cache the user profile so other pages can read it without an extra /me request
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    // The backend defaults every new user to "MEMBER".
    // RoleClaimSerializer only allows a change when role === "MEMBER", so
    // if the user already has TRAINER or OWNER set we skip the claim step.
    const roleAlreadyClaimed =
      data?.user?.role && data.user.role !== "MEMBER";

    router.push(roleAlreadyClaimed ? "/dashboard" : "/claim-role");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main>
      <h1>Log in to FitGyldrah</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <p>
        Don&apos;t have an account? <a href="/register">Register</a>
      </p>
    </main>
  );
}
