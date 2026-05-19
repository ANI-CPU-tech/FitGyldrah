"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Users,
  CalendarDays,
  Clock,
  UserCircle,
  Dumbbell,
  CalendarPlus,
  ChevronRight,
} from "lucide-react";
import { trainerApi, scheduleApi, TrainerProfile, Schedule } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>) {
  return Object.entries(e)
    .map(([k, v]) =>
      k === "detail"
        ? Array.isArray(v) ? v.join(" ") : v
        : `${k}: ${Array.isArray(v) ? v.join(" ") : v}`
    )
    .join(" | ");
}

const QUICK_LINKS = [
  { href: "/dashboard/trainer/profile",  label: "Manage Profile & Apply to Gyms", icon: UserCircle },
  { href: "/dashboard/trainer/clients",  label: "View My Clients",                icon: Users },
  { href: "/dashboard/trainer/schedule", label: "Schedule a Session",             icon: CalendarPlus },
  { href: "/dashboard/trainer/plans",    label: "Generate AI Plan",               icon: Dumbbell },
];

export default function TrainerOverviewPage() {
  const [profile, setProfile]       = useState<TrainerProfile | null>(null);
  const [upcoming, setUpcoming]     = useState<Schedule[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
  })();

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";

    Promise.all([
      trainerApi.getProfile(token),
      scheduleApi.list("upcoming=true", token),
    ]).then(([profileRes, schedRes]) => {
      if (profileRes.error) setProfileError(flattenErrors(profileRes.error));
      else setProfile(profileRes.data);
      setUpcoming(schedRes.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Trainer Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back, <span className="text-zinc-200 font-medium">{user.name ?? "Trainer"}</span>.
        </p>
      </div>

      {/* Alert banners */}
      {profileError && (
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{profileError}</span>
        </div>
      )}

      {!loading && !profile && !profileError && (
        <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3.5 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            No trainer profile found.{" "}
            <Link href="/dashboard/trainer/profile" className="underline underline-offset-2 hover:text-amber-300 transition-colors">
              Set up your profile
            </Link>{" "}
            to start accepting clients.
          </span>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-sky-950/60 border border-sky-900/40">
            <Users className="w-5 h-5 text-sky-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">—</p>
            <p className="text-xs text-zinc-500 mt-0.5">Total Clients</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-900/40">
            <CalendarDays className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">{upcoming.length}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Upcoming Sessions</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-900/40">
            <Clock className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-50">
              {profile ? (profile.is_available ? "Open" : "Closed") : "—"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Availability</p>
          </div>
        </div>
      </div>

      {/* Profile snapshot */}
      {profile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            Your Profile
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Specialty</p>
              <p className="text-zinc-200">{profile.specialty || "—"}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Experience</p>
              <p className="text-zinc-200">{profile.years_experience} yrs</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Available</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${profile.is_available ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
                {profile.is_available ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming sessions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            Upcoming Sessions
          </h2>
          <span className="text-xs text-zinc-500">{upcoming.length} total</span>
        </div>

        {upcoming.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">
            No upcoming accepted sessions.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Gym</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {upcoming.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-3.5 text-zinc-200 font-medium">{s.member_name}</td>
                    <td className="px-6 py-3.5 text-zinc-400">{s.session_type_label}</td>
                    <td className="px-6 py-3.5 text-zinc-400">{new Date(s.proposed_time).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-zinc-400">{s.duration_minutes} min</td>
                    <td className="px-6 py-3.5 text-zinc-400">{s.gym_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 rounded-xl px-5 py-4 text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
          >
            <Icon className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors shrink-0" strokeWidth={1.5} />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
