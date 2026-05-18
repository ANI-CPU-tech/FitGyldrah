"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data, error: apiError }) => {
      setLoading(false);
      if (apiError) {
        setError(flattenErrors(apiError));
        return;
      }
      setGyms(data ?? []);
    });
  }, []);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") ?? "{}");
    } catch {
      return {};
    }
  })();

  return (
    <div>
      <h1>Owner Dashboard</h1>
      <p>Welcome back, {user.name ?? "Owner"}.</p>

      <h2>Your Gyms</h2>

      {loading && <p>Loading your gyms…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && gyms.length === 0 && (
        <p>
          You have no gyms yet.{" "}
          <Link href="/dashboard/owner/facilities">Register your first gym</Link>.
        </p>
      )}

      {gyms.map((gym) => (
        <div key={gym.id}>
          <h3>{gym.name}</h3>
          <p>{gym.location}</p>
          <p>
            Payment ready:{" "}
            <strong>{gym.is_payment_ready ? "Yes" : "No — connect bank"}</strong>
          </p>
          <p>Tiers: {gym.tiers.length}</p>
          <nav aria-label={`Quick links for ${gym.name}`}>
            <Link href={`/dashboard/owner/trainers?gym=${gym.id}`}>
              Trainer Roster
            </Link>
            {" | "}
            <Link href={`/dashboard/owner/members?gym=${gym.id}`}>
              Member Directory
            </Link>
            {" | "}
            <Link href={`/dashboard/owner/financials?gym=${gym.id}`}>
              Financials
            </Link>
          </nav>
        </div>
      ))}
    </div>
  );
}
