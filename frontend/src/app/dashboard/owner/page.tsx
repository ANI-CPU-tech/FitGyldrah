"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Users,
  Landmark,
  UserCheck,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { gymApi, Gym } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function OwnerOverviewPage() {
  const [gyms, setGyms]     = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
  })();

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data, error: apiError }) => {
      setLoading(false);
      if (apiError) { setError(flattenErrors(apiError)); return; }
      setGyms(data ?? []);
    });
  }, []);

  const totalTiers    = gyms.reduce((s, g) => s + g.tiers.length, 0);
  const unpaidGyms    = gyms.filter((g) => !g.is_payment_ready);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Owner Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back,{" "}
          <span className="text-zinc-200 font-medium">{user.name ?? "Owner"}</span>.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bank-not-linked warning banners */}
      {unpaidGyms.map((g) => (
        <div
          key={g.id}
          className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3.5 text-sm text-amber-400"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">{g.name}</span> has no linked bank account.{" "}
            <Link
              href={`/dashboard/owner/financials?gym=${g.id}`}
              className="underline underline-offset-2 hover:text-amber-300 transition-colors"
            >
              Connect bank
            </Link>{" "}
            to accept member payments.
          </span>
        </div>
      ))}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-sky-950/60 border border-sky-900/40">
            <Building2 className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">{loading ? "—" : gyms.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Facilities</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-900/40">
            <Users className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">{loading ? "—" : totalTiers}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Subscription Tiers</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-900/40">
            <UserCheck className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {loading ? "—" : gyms.filter((g) => g.is_payment_ready).length}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Payment-Ready Gyms</p>
          </div>
        </div>
      </div>

      {/* Gym cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your gyms…
        </div>
      ) : gyms.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
          <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500 mb-3">You have no gyms yet.</p>
          <Link
            href="/dashboard/owner/facilities"
            className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-400 font-medium transition-colors"
          >
            Register your first gym <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Your Gyms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gyms.map((gym) => (
              <div
                key={gym.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{gym.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{gym.location}</p>
                  </div>
                  {gym.is_payment_ready ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Payment Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-900/40 shrink-0">
                      <AlertCircle className="w-3 h-3" /> No Bank
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-500">
                  <span className="text-zinc-400 font-medium">{gym.tiers.length}</span> tier{gym.tiers.length !== 1 ? "s" : ""}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                  {[
                    { href: `/dashboard/owner/trainers?gym=${gym.id}`,   label: "Trainers",  icon: UserCheck },
                    { href: `/dashboard/owner/members?gym=${gym.id}`,    label: "Members",   icon: Users },
                    { href: `/dashboard/owner/financials?gym=${gym.id}`, label: "Financials", icon: Landmark },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
