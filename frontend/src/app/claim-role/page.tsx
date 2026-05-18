"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, UserProfile } from "@/utils/api";

// Exact string values from backend authentication/models.py Role.TextChoices
type Role = "MEMBER" | "TRAINER" | "OWNER";

interface ClaimRoleResponse {
  detail: string;
  user: UserProfile;
}

// Helper: flatten DRF error objects into a single readable string
function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

const ROLE_OPTIONS: {
  role: Role;
  title: string;
  description: string;
}[] = [
  {
    role: "MEMBER",
    title: "Member",
    description:
      "Join a gym, track your workouts, and follow personalised training plans.",
  },
  {
    role: "OWNER",
    title: "Gym Owner",
    description:
      "Register and manage your gym, handle memberships, and oversee trainers.",
  },
  {
    role: "TRAINER",
    title: "Trainer",
    description:
      "Create training plans, manage your clients, and schedule sessions.",
  },
];

export default function ClaimRolePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Guard: redirect to /login if no token in localStorage ─────────────────
  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  // ── Role selection handler ─────────────────────────────────────────────────
  async function handleRoleSelection(selectedRole: Role) {
    if (!token || selecting) return; // prevent double-clicks
    setError(null);
    setSelecting(selectedRole);

    const { data, error: apiError } = await apiRequest<ClaimRoleResponse>(
      "/api/auth/claim-role/",
      {
        method: "POST",
        body: { role: selectedRole },
        token,
      }
    );

    if (apiError) {
      setError(flattenErrors(apiError));
      setSelecting(null);
      return;
    }

    if (data) {
      // Update the cached user profile so downstream pages see the new role
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    router.push("/dashboard");
  }

  // Don't render the page until we've confirmed a token exists
  if (!token) return null;

  return (
    <main>
      <h1>Choose your role</h1>
      <p>
        Select the role that best describes how you will use FitGyldrah. This
        can only be set once.
      </p>

      <div>
        {ROLE_OPTIONS.map(({ role, title, description }) => (
          <div key={role}>
            <h2>{title}</h2>
            <p>{description}</p>
            <button
              type="button"
              onClick={() => handleRoleSelection(role)}
              disabled={selecting !== null}
              aria-busy={selecting === role}
            >
              {selecting === role ? "Setting role…" : `Continue as ${title}`}
            </button>
          </div>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
