"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi, RoleValue } from "@/utils/api";

// Helper: flatten DRF error objects into a single readable string
function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

/** Maps a claimed role to its dedicated dashboard path. */
function dashboardForRole(role: RoleValue): string {
  switch (role) {
    case "OWNER":
      return "/dashboard/owner";
    case "TRAINER":
      return "/dashboard/trainer";
    case "MEMBER":
      return "/dashboard/member";
    default:
      return "/dashboard";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    const role = data?.user?.role;

    // "MEMBER" is the backend default — it means the user hasn't claimed a
    // real role yet. Send them to /claim-role first.
    // Once they have OWNER or TRAINER, route them to their specific dashboard.
    if (!role || role === "MEMBER") {
      // A brand-new MEMBER who hasn't explicitly claimed still goes to claim-role
      // so they can confirm or upgrade. If they already have an active MEMBER
      // dashboard we still send them there — the claim-role page handles the
      // "already claimed" case gracefully via the backend's own guard.
      router.push("/claim-role");
    } else {
      router.push(dashboardForRole(role));
    }
  }

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
