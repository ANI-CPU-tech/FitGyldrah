"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  User,
  Crown,
  ClipboardList,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { apiRequest, UserProfile, RoleValue } from "@/utils/api";

function dashboardForRole(role: RoleValue): string {
  switch (role) {
    case "OWNER":   return "/dashboard/owner";
    case "TRAINER": return "/dashboard/trainer";
    case "MEMBER":  return "/dashboard/member";
    default:        return "/dashboard";
  }
}

type Role = RoleValue;

interface ClaimRoleResponse {
  detail: string;
  user: UserProfile;
}

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

interface RoleOption {
  role: Role;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  border: string;
  glow: string;
  iconBg: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "MEMBER",
    title: "Member",
    description:
      "Join a facility, track your biometrics, and follow personalised training plans crafted by your trainer.",
    icon: <User className="w-7 h-7" strokeWidth={1.5} />,
    accent:  "text-sky-400",
    border:  "hover:border-sky-600",
    glow:    "hover:shadow-sky-900/40",
    iconBg:  "bg-sky-950/60 border-sky-900/50 text-sky-400",
  },
  {
    role: "OWNER",
    title: "Gym Owner",
    description:
      "Register and manage your facility, oversee trainer rosters, and handle membership billing.",
    icon: <Crown className="w-7 h-7" strokeWidth={1.5} />,
    accent:  "text-amber-400",
    border:  "hover:border-amber-600",
    glow:    "hover:shadow-amber-900/40",
    iconBg:  "bg-amber-950/60 border-amber-900/50 text-amber-400",
  },
  {
    role: "TRAINER",
    title: "Trainer",
    description:
      "Manage your clients, schedule sessions, and generate AI-powered diet and workout plans.",
    icon: <ClipboardList className="w-7 h-7" strokeWidth={1.5} />,
    accent:  "text-emerald-400",
    border:  "hover:border-emerald-600",
    glow:    "hover:shadow-emerald-900/40",
    iconBg:  "bg-emerald-950/60 border-emerald-900/50 text-emerald-400",
  },
];

export default function ClaimRolePage() {
  const router = useRouter();

  const [token, setToken]       = useState<string | null>(null);
  const [selecting, setSelecting] = useState<Role | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("access_token");
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  async function handleRoleSelection(selectedRole: Role) {
    if (!token || selecting) return;
    setError(null);
    setSelecting(selectedRole);

    const { data, error: apiError } = await apiRequest<ClaimRoleResponse>(
      "/api/auth/claim-role/",
      { method: "POST", body: { role: selectedRole }, token }
    );

    if (apiError) {
      setError(flattenErrors(apiError));
      setSelecting(null);
      return;
    }

    if (data) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    router.push(dashboardForRole((data?.user?.role as RoleValue) ?? "MEMBER"));
  }

  if (!token) return null;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">

      {/* Header */}
      <div className="flex flex-col items-center mb-12 gap-3 text-center">
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-900/50 mb-1">
          <Shield className="w-8 h-8 text-red-500" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          Choose Your Path
        </h1>
        <p className="text-sm text-zinc-400 max-w-sm">
          Select the role that best describes how you will use FitGyldrah.
          This can only be set once.
        </p>
      </div>

      {/* Role cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {ROLE_OPTIONS.map(({ role, title, description, icon, accent, border, glow, iconBg }) => {
          const isLoading = selecting === role;
          const isDisabled = selecting !== null;

          return (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSelection(role)}
              disabled={isDisabled}
              aria-busy={isLoading}
              className={[
                "group relative flex flex-col items-start gap-4 text-left",
                "bg-zinc-900 border border-zinc-800 rounded-2xl p-6",
                "transition-all duration-200 cursor-pointer",
                "hover:scale-105 hover:shadow-xl",
                glow,
                border,
                isDisabled && !isLoading
                  ? "opacity-40 cursor-not-allowed hover:scale-100"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Icon */}
              <div
                className={`p-3 rounded-xl border ${iconBg} transition-transform duration-200 group-hover:scale-110`}
              >
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  icon
                )}
              </div>

              {/* Text */}
              <div className="space-y-1.5 flex-1">
                <h2 className={`text-lg font-bold ${accent}`}>{title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* CTA row */}
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${accent} transition-opacity`}
              >
                {isLoading ? "Setting role…" : `Continue as ${title}`}
                {!isLoading && (
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 mt-8 bg-red-950/50 border border-red-900/60 rounded-lg px-4 py-3 text-sm text-red-400 max-w-md w-full"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </main>
  );
}
