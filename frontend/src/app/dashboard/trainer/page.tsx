"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trainerApi, scheduleApi, TrainerProfile, Schedule } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>) {
  return Object.entries(e)
    .map(([k, v]) => (k === "detail" ? (Array.isArray(v) ? v.join(" ") : v) : `${k}: ${Array.isArray(v) ? v.join(" ") : v}`))
    .join(" | ");
}

export default function TrainerOverviewPage() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";

    trainerApi.getProfile(token).then(({ data, error }) => {
      if (error) setProfileError(flattenErrors(error));
      else setProfile(data);
    });

    scheduleApi.list("upcoming=true", token).then(({ data }) => {
      setUpcoming(data ?? []);
    });
  }, []);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
  })();

  return (
    <div>
      <h1>Trainer Dashboard</h1>
      <p>Welcome back, {user.name ?? "Trainer"}.</p>

      {profileError && <p role="alert">{profileError}</p>}

      {profile ? (
        <div>
          <h2>Your Profile</h2>
          <p><strong>Specialty:</strong> {profile.specialty || "—"}</p>
          <p><strong>Experience:</strong> {profile.years_experience} years</p>
          <p><strong>Available:</strong> {profile.is_available ? "Yes" : "No"}</p>
        </div>
      ) : (
        !profileError && (
          <p>
            No trainer profile found.{" "}
            <Link href="/dashboard/trainer/profile">Set up your profile</Link>.
          </p>
        )
      )}

      <h2>Upcoming Sessions ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <p>No upcoming accepted sessions.</p>
      ) : (
        <table border={1}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Type</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Gym</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((s) => (
              <tr key={s.id}>
                <td>{s.member_name}</td>
                <td>{s.session_type_label}</td>
                <td>{new Date(s.proposed_time).toLocaleString()}</td>
                <td>{s.duration_minutes} min</td>
                <td>{s.gym_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <nav aria-label="Quick links">
        <ul>
          <li><Link href="/dashboard/trainer/profile">Manage Profile &amp; Apply to Gyms</Link></li>
          <li><Link href="/dashboard/trainer/clients">View My Clients</Link></li>
          <li><Link href="/dashboard/trainer/schedule">Schedule a Session</Link></li>
          <li><Link href="/dashboard/trainer/plans">Generate AI Plan</Link></li>
        </ul>
      </nav>
    </div>
  );
}
