"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Mail, Lock, AlertCircle, LogIn, Loader2 } from "lucide-react";
import { authApi, RoleValue } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

function dashboardForRole(role: RoleValue): string {
  switch (role) {
    case "OWNER":   return "/dashboard/owner";
    case "TRAINER": return "/dashboard/trainer";
    case "MEMBER":  return "/dashboard/member";
    default:        return "/dashboard";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

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

    if (searchParams.get("first_time") === "true") {
      router.push("/claim-role");
      return;
    }

    const role = data?.user?.role;
    if (!role) {
      router.push("/claim-role");
    } else {
      router.push(dashboardForRole(role));
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-900/50">
            <Shield className="w-8 h-8 text-red-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            FitGyldrah
          </h1>
          <p className="text-sm text-zinc-400">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-300"
              >
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-300"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="text-red-500 hover:text-red-400 font-medium transition-colors"
          >
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
