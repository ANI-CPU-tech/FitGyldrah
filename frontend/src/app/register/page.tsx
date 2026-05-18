"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi, RegisterPayload } from "@/utils/api";

// Helper: flatten DRF error objects into a single readable string
function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function RegisterPage() {
  const router = useRouter();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  // Optional biometric fields — backend accepts them at registration
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [goals, setGoals] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side password match check before hitting the network
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
      // Only include optional fields if the user filled them in
      height: height !== "" ? parseFloat(height) : null,
      weight: weight !== "" ? parseFloat(weight) : null,
      body_fat_pct: bodyFatPct !== "" ? parseFloat(bodyFatPct) : null,
      goals: goals.trim() || undefined,
    };

    const { error: apiError } = await authApi.register(payload);

    setLoading(false);

    if (apiError) {
      setError(flattenErrors(apiError));
      return;
    }

    // Registration successful — redirect to login
    router.push("/login");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main>
      <h1>Create your FitGyldrah account</h1>

      <form onSubmit={handleSubmit}>
        {/* Required fields */}
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
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
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
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="password2">Confirm password</label>
          <input
            id="password2"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {/* Optional biometric fields */}
        <div>
          <label htmlFor="height">Height (cm) — optional</label>
          <input
            id="height"
            type="number"
            step="0.1"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="weight">Weight (kg) — optional</label>
          <input
            id="weight"
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="bodyFatPct">Body fat % — optional</label>
          <input
            id="bodyFatPct"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={bodyFatPct}
            onChange={(e) => setBodyFatPct(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="goals">Goals — optional</label>
          <textarea
            id="goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={3}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
