"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gymApi, Gym, GymApplication } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function TrainerRosterPage() {
  const searchParams = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  // ── Gym selector ───────────────────────────────────────────────────────────
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState(preselectedGymId);

  // ── Applications ───────────────────────────────────────────────────────────
  const [applications, setApplications] = useState<GymApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);

  // Per-row action state: maps application id → "approving" | "rejecting" | null
  const [actionState, setActionState] = useState<
    Record<string, "approving" | "rejecting" | null>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Load owner's gyms ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data }) => {
      if (data) {
        setGyms(data);
        if (!selectedGymId && data.length > 0) {
          setSelectedGymId(data[0].id);
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load PENDING applications whenever selected gym changes ───────────────
  useEffect(() => {
    if (!selectedGymId) return;
    const token = localStorage.getItem("access_token") ?? "";
    setAppsLoading(true);
    setAppsError(null);
    setApplications([]);

    gymApi.applications(selectedGymId, "PENDING", token).then(({ data, error: apiError }) => {
      setAppsLoading(false);
      if (apiError) {
        setAppsError(flattenErrors(apiError));
        return;
      }
      setApplications(data ?? []);
    });
  }, [selectedGymId]);

  // ── Review handler ─────────────────────────────────────────────────────────
  async function handleReview(
    appId: string,
    action: "approve" | "reject"
  ) {
    if (!selectedGymId) return;
    setActionError(null);
    setActionState((prev) => ({
      ...prev,
      [appId]: action === "approve" ? "approving" : "rejecting",
    }));

    const token = localStorage.getItem("access_token") ?? "";
    const { error: apiError } = await gymApi.reviewApplication(
      selectedGymId,
      appId,
      { action },
      token
    );

    setActionState((prev) => ({ ...prev, [appId]: null }));

    if (apiError) {
      setActionError(flattenErrors(apiError));
      return;
    }

    // Remove the reviewed application from the PENDING list
    setApplications((prev) => prev.filter((a) => a.id !== appId));
  }

  return (
    <div>
      <h1>Trainer Roster — Pending Applications</h1>

      {/* Gym selector */}
      <div>
        <label htmlFor="gymSelect">Select Gym</label>
        <select
          id="gymSelect"
          value={selectedGymId}
          onChange={(e) => setSelectedGymId(e.target.value)}
        >
          <option value="" disabled>
            Choose a gym
          </option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {appsLoading && <p>Loading applications…</p>}
      {appsError && <p role="alert">{appsError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {!appsLoading && applications.length === 0 && selectedGymId && (
        <p>No pending trainer applications for this gym.</p>
      )}

      {applications.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Trainer</th>
              <th>Email</th>
              <th>Specialty</th>
              <th>Experience (yrs)</th>
              <th>Cover Letter</th>
              <th>CV</th>
              <th>Applied</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const busy = actionState[app.id];
              return (
                <tr key={app.id}>
                  <td>{app.trainer_name}</td>
                  <td>{app.trainer_email}</td>
                  <td>{app.trainer_specialty || "—"}</td>
                  <td>{app.trainer_experience}</td>
                  <td>{app.cover_letter || "—"}</td>
                  <td>
                    {app.trainer_cv ? (
                      <a
                        href={app.trainer_cv}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View CV
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{new Date(app.applied_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleReview(app.id, "approve")}
                      disabled={busy !== null && busy !== undefined}
                      aria-busy={busy === "approving"}
                    >
                      {busy === "approving" ? "Approving…" : "Approve"}
                    </button>
                    {" "}
                    <button
                      type="button"
                      onClick={() => handleReview(app.id, "reject")}
                      disabled={busy !== null && busy !== undefined}
                      aria-busy={busy === "rejecting"}
                    >
                      {busy === "rejecting" ? "Rejecting…" : "Reject"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
