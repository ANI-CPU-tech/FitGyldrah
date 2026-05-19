"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Scale,
  Activity,
  Heart,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { memberApi, memberBiometricsApi, MyEnrollment, BiometricLatest } from "@/utils/api";

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

function DeltaBadge({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) return null;
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-red-400" : "text-emerald-400"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{delta} {unit}
    </span>
  );
}

export default function MemberOverviewPage() {
  const [pendingEnrollments, setPendingEnrollments] = useState<MyEnrollment[]>([]);
  const [latest, setLatest]       = useState<BiometricLatest | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
  })();

  useEffect(() => {
    const token = getToken();
    async function load() {
      const [enrollRes, bioRes] = await Promise.all([
        memberApi.enrollments("PENDING_PAYMENT", token),
        memberBiometricsApi.latest(token),
      ]);
      if (enrollRes.data) setPendingEnrollments(enrollRes.data);
      if (bioRes.data) setLatest(bioRes.data);
      else setLatestError("No biometric data yet.");
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading overview…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Member Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back, <span className="text-zinc-200 font-medium">{user.name ?? "Member"}</span>.
        </p>
      </div>

      {/* Pending payment banners */}
      {pendingEnrollments.map((e) => (
        <div key={e.id}
          className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/60 rounded-xl px-4 py-4 text-sm text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">Payment Required</p>
            <p className="text-amber-400/80 mt-0.5">
              Your enrollment at <span className="font-medium text-amber-200">{e.gym_name}</span> ({e.tier_name} — ₹{e.price_paid}) is awaiting payment.
            </p>
          </div>
          <Link href="/dashboard/member/billing"
            className="flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold transition-colors">
            Pay Now <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      ))}

      {/* Biometric metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-900/40">
              <Scale className="w-4 h-4 text-sky-400" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Weight</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {latest?.latest_weight != null ? `${latest.latest_weight} kg` : "—"}
            </p>
            <DeltaBadge delta={latest?.weight_delta ?? null} unit="kg" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-900/40">
              <Activity className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Body Fat</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {latest?.latest_body_fat != null ? `${latest.latest_body_fat}%` : "—"}
            </p>
            <DeltaBadge delta={latest?.body_fat_delta ?? null} unit="%" />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-950/60 border border-red-900/40">
              <Heart className="w-4 h-4 text-red-400" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Resting HR</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {latest?.latest_resting_hr != null ? `${latest.latest_resting_hr} bpm` : "—"}
            </p>
            {latest?.latest_bmi_category && (
              <span className="text-xs text-zinc-500">BMI: {latest.latest_bmi} ({latest.latest_bmi_category})</span>
            )}
          </div>
        </div>
      </div>

      {latestError && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-6 text-center">
          <Activity className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">{latestError}</p>
          <Link href="/dashboard/member/biometrics"
            className="inline-flex items-center gap-1 mt-3 text-xs text-sky-500 hover:text-sky-400 font-medium transition-colors">
            Log your first reading <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: "/dashboard/member/explore",    label: "Explore Gyms" },
          { href: "/dashboard/member/plans",      label: "View Training Plans" },
          { href: "/dashboard/member/schedule",   label: "Check Schedule" },
          { href: "/dashboard/member/biometrics", label: "Log Biometrics" },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 rounded-xl px-5 py-4 text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group">
            <span>{label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
