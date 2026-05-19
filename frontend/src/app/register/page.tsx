"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Mail,
  Lock,
  User,
  Ruler,
  Weight,
  Percent,
  Target,
  AlertCircle,
  UserPlus,
  Loader2,
} from "lucide-react";
import { authApi, RegisterPayload } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-300"
      >
        <span className="text-zinc-500">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail]           = useState("");
  const [name, setName]             = useState("");
  const [password, setPassword]     = useState("");
  const [password2, setPassword2]   = useState("");
  const [height, setHeight]         = useState("");
  const [weight, setWeight]         = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [goals, setGoals]           = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const payload: RegisterPayload = {
      email: email.trim(),
      name: name.trim(),
      password,
      password2,
      height:       height      !== "" ? parseFloat(height)      : null,
      weight:       weight      !== "" ? parseFloat(weight)      : null,
      body_fat_pct: bodyFatPct  !== "" ? parseFloat(bodyFatPct)  : null,
      goals:        goals.trim() || undefined,
    };

    const { error: apiError } = await authApi.register(payload);
    setLoading(false);

    if (apiError) {
      setError(flattenErrors(apiError));
      return;
    }

    router.push("/login?first_time=true");
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-900/50">
            <Shield className="w-8 h-8 text-red-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            FitGyldrah
          </h1>
          <p className="text-sm text-zinc-400">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-6">

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Required fields */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Account details
              </p>

              <Field id="name" label="Full name" icon={<User className="w-3.5 h-3.5" />}>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="John Smith"
                  className={inputCls}
                />
              </Field>

              <Field id="email" label="Email" icon={<Mail className="w-3.5 h-3.5" />}>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </Field>

              <Field id="password" label="Password" icon={<Lock className="w-3.5 h-3.5" />}>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>

              <Field id="password2" label="Confirm password" icon={<Lock className="w-3.5 h-3.5" />}>
                <input
                  id="password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Optional biometric fields */}
            <div className="space-y-4 pt-2 border-t border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 pt-2">
                Biometrics — optional
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Field id="height" label="Height (cm)" icon={<Ruler className="w-3.5 h-3.5" />}>
                  <input
                    id="height"
                    type="number"
                    step="0.1"
                    min="0"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                    className={inputCls}
                  />
                </Field>

                <Field id="weight" label="Weight (kg)" icon={<Weight className="w-3.5 h-3.5" />}>
                  <input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="75"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field id="bodyFatPct" label="Body fat %" icon={<Percent className="w-3.5 h-3.5" />}>
                <input
                  id="bodyFatPct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                  placeholder="18"
                  className={inputCls}
                />
              </Field>

              <Field id="goals" label="Goals" icon={<Target className="w-3.5 h-3.5" />}>
                <textarea
                  id="goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  placeholder="Lose fat, build muscle, improve endurance…"
                  className={`${inputCls} resize-none`}
                />
              </Field>
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
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-red-500 hover:text-red-400 font-medium transition-colors"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
