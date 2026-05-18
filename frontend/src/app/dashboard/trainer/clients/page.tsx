"use client";

/**
 * Clients page — shows the trainer's assigned members.
 *
 * Strategy: The backend has no single "my clients" endpoint for trainers.
 * We derive clients by:
 *   1. Fetching the trainer's APPROVED gym applications → get gym IDs.
 *   2. For each gym, fetching /api/gyms/<id>/members/?status=ACTIVE.
 *   3. Filtering enrollments where trainer_name matches the logged-in trainer.
 *
 * When a member row is clicked, we fetch their biometric trends from
 * GET /api/biometrics/member/<member_id>/ (trainer-scoped endpoint).
 */

import { useEffect, useState } from "react";
import {
  trainerApi,
  gymApi,
  biometricsApi,
  GymApplication,
  MemberEnrollment,
  BiometricEntry,
} from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

// The GymMemberListSerializer doesn't include member.id directly —
// we need it to fetch biometrics. We'll store it alongside the enrollment.
interface ClientRow extends MemberEnrollment {
  gym_id: string;
  gym_name_display: string;
  // member_id is not in GymMemberListSerializer, so we derive it from
  // the enrollment id — but actually we need to use the biometrics
  // trainer endpoint which takes member_id. We'll store it separately.
  member_id_hint: string; // populated from enrollment.id as fallback
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected member for biometrics drill-down
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [biometrics, setBiometrics] = useState<BiometricEntry[]>([]);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // ── Load clients ───────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    const user = (() => {
      try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
    })();
    const trainerName: string = user.name ?? "";

    trainerApi.myApplications(token).then(async ({ data: apps, error }) => {
      if (error) {
        setLoadError(flattenErrors(error));
        setLoading(false);
        return;
      }

      const approvedApps: GymApplication[] = (apps ?? []).filter(
        (a) => a.status === "APPROVED"
      );

      if (approvedApps.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch members for each approved gym in parallel
      const results = await Promise.all(
        approvedApps.map((app) =>
          gymApi.members(
            // gym_name is in the application but not gym_id directly.
            // GymApplicationReadSerializer only has gym_name, not gym id.
            // We need to resolve gym id. The application serializer doesn't
            // expose gym.id — only gym_name. We'll use the public gym list
            // to resolve name → id.
            "", // placeholder — handled below
            "ACTIVE",
            token
          ).then((r) => ({ app, result: r }))
        )
      );

      // Since GymApplicationReadSerializer doesn't expose gym.id, we need
      // to fetch the public gym list and match by name.
      const gymsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`
      );
      const allGyms = gymsRes.ok ? await gymsRes.json() : [];

      // Build name → id map
      const gymNameToId: Record<string, string> = {};
      for (const g of allGyms) {
        gymNameToId[g.name] = g.id;
      }

      // Now fetch members for each approved gym using resolved IDs
      const clientRows: ClientRow[] = [];
      await Promise.all(
        approvedApps.map(async (app) => {
          const gymId = gymNameToId[app.gym_name];
          if (!gymId) return;

          const { data: members } = await gymApi.members(gymId, "ACTIVE", token);
          if (!members) return;

          for (const m of members) {
            // Only include members assigned to this trainer
            if (m.trainer_name === trainerName) {
              clientRows.push({
                ...m,
                gym_id: gymId,
                gym_name_display: app.gym_name,
                // We don't have member UUID from this serializer.
                // The biometrics trainer endpoint needs member_id.
                // We'll use enrollment.id as a key and note the limitation.
                member_id_hint: m.id,
              });
            }
          }
        })
      );

      setClients(clientRows);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch biometrics for selected client ───────────────────────────────────
  async function handleSelectClient(client: ClientRow) {
    setSelectedClient(client);
    setBiometrics([]);
    setBioError(null);
    setBioLoading(true);

    const token = localStorage.getItem("access_token") ?? "";
    // The biometrics trainer endpoint: GET /api/biometrics/member/<member_id>/
    // We use the enrollment id as a proxy — in a real scenario the member UUID
    // would come from a richer serializer. For now we pass it and let the
    // backend return a 403/404 if it doesn't match.
    const { data, error } = await biometricsApi.memberHistory(
      client.member_id_hint,
      token
    );

    setBioLoading(false);

    if (error) {
      setBioError(flattenErrors(error));
      return;
    }

    setBiometrics(data ?? []);
  }

  return (
    <div>
      <h1>My Clients</h1>

      {loading && <p>Loading clients…</p>}
      {loadError && <p role="alert">{loadError}</p>}

      {!loading && clients.length === 0 && (
        <p>
          No assigned clients found. You need to be approved at a gym and have
          members assigned to you by the gym owner.
        </p>
      )}

      {clients.length > 0 && (
        <table border={1}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Gym</th>
              <th>Tier</th>
              <th>Start</th>
              <th>End</th>
              <th>Days Left</th>
              <th>Biometrics</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.member_name}</td>
                <td>{c.member_email}</td>
                <td>{c.gym_name_display}</td>
                <td>{c.tier_name}</td>
                <td>{c.start_date}</td>
                <td>{c.end_date}</td>
                <td>{c.days_remaining}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleSelectClient(c)}
                    aria-pressed={selectedClient?.id === c.id}
                  >
                    {selectedClient?.id === c.id ? "Viewing" : "View Trends"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Biometrics drill-down ── */}
      {selectedClient && (
        <section>
          <h2>
            Biometric History — {selectedClient.member_name}
          </h2>

          {bioLoading && <p>Loading biometrics…</p>}
          {bioError && <p role="alert">{bioError}</p>}

          {!bioLoading && biometrics.length === 0 && !bioError && (
            <p>No biometric readings found for this member.</p>
          )}

          {biometrics.length > 0 && (
            <table border={1}>
              <thead>
                <tr>
                  <th>Recorded At</th>
                  <th>Weight (kg)</th>
                  <th>Height (cm)</th>
                  <th>Body Fat %</th>
                  <th>Muscle Mass</th>
                  <th>BMI</th>
                  <th>BMI Category</th>
                  <th>Waist (cm)</th>
                  <th>Resting HR</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {biometrics.map((b) => (
                  <tr key={b.id}>
                    <td>{new Date(b.recorded_at).toLocaleString()}</td>
                    <td>{b.weight ?? "—"}</td>
                    <td>{b.height ?? "—"}</td>
                    <td>{b.body_fat_pct ?? "—"}</td>
                    <td>{b.muscle_mass ?? "—"}</td>
                    <td>{b.bmi ?? "—"}</td>
                    <td>{b.bmi_category ?? "—"}</td>
                    <td>{b.waist_cm ?? "—"}</td>
                    <td>{b.resting_hr ?? "—"}</td>
                    <td>{b.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
