"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gymApi, Gym, MemberEnrollment, TrainerProfile } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function MemberDirectoryPage() {
  const searchParams = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  // ── Gym selector ───────────────────────────────────────────────────────────
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState(preselectedGymId);

  // ── Members ────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<MemberEnrollment[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Approved trainers for the dropdown ────────────────────────────────────
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);

  // Per-row selected trainer: maps enrollment id → trainer id
  const [selectedTrainer, setSelectedTrainer] = useState<Record<string, string>>({});
  // Per-row assign state: maps enrollment id → "assigning" | null
  const [assignState, setAssignState] = useState<Record<string, boolean>>({});
  const [assignError, setAssignError] = useState<string | null>(null);

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

  // ── Load members + approved trainers when gym changes ─────────────────────
  useEffect(() => {
    if (!selectedGymId) return;
    const token = localStorage.getItem("access_token") ?? "";

    setMembersLoading(true);
    setMembersError(null);
    setMembers([]);
    setTrainers([]);

    // Fetch members and approved trainers in parallel
    Promise.all([
      gymApi.members(selectedGymId, "ACTIVE", token),
      gymApi.trainers(selectedGymId, token),
    ]).then(([membersRes, trainersRes]) => {
      setMembersLoading(false);

      if (membersRes.error) {
        setMembersError(flattenErrors(membersRes.error));
      } else {
        setMembers(membersRes.data ?? []);
      }

      if (trainersRes.data) {
        setTrainers(trainersRes.data);
      }
    });
  }, [selectedGymId]);

  // ── Assign trainer handler ─────────────────────────────────────────────────
  async function handleAssign(enrollmentId: string) {
    const trainerId = selectedTrainer[enrollmentId];
    if (!trainerId || !selectedGymId) return;

    setAssignError(null);
    setAssignState((prev) => ({ ...prev, [enrollmentId]: true }));

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error: apiError } = await gymApi.assignTrainer(
      selectedGymId,
      enrollmentId,
      trainerId,
      token
    );

    setAssignState((prev) => ({ ...prev, [enrollmentId]: false }));

    if (apiError) {
      setAssignError(flattenErrors(apiError));
      return;
    }

    // Update the trainer_name in the local member list
    if (data) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === enrollmentId ? data.enrollment : m
        )
      );
    }
  }

  return (
    <div>
      <h1>Member Directory — Active Enrollments</h1>

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

      {membersLoading && <p>Loading members…</p>}
      {membersError && <p role="alert">{membersError}</p>}
      {assignError && <p role="alert">{assignError}</p>}

      {!membersLoading && members.length === 0 && selectedGymId && (
        <p>No active members at this gym.</p>
      )}

      {members.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Tier</th>
              <th>Price Paid (₹)</th>
              <th>Assigned Trainer</th>
              <th>Start</th>
              <th>End</th>
              <th>Days Left</th>
              <th>Assign Trainer</th>
            </tr>
          </thead>
          <tbody>
            {members.map((enrollment) => {
              const busy = assignState[enrollment.id];
              return (
                <tr key={enrollment.id}>
                  <td>{enrollment.member_name}</td>
                  <td>{enrollment.member_email}</td>
                  <td>{enrollment.tier_name}</td>
                  <td>{enrollment.price_paid}</td>
                  <td>{enrollment.trainer_name}</td>
                  <td>{enrollment.start_date}</td>
                  <td>{enrollment.end_date}</td>
                  <td>{enrollment.days_remaining}</td>
                  <td>
                    {trainers.length === 0 ? (
                      <span>No approved trainers</span>
                    ) : (
                      <>
                        <select
                          aria-label={`Select trainer for ${enrollment.member_name}`}
                          value={selectedTrainer[enrollment.id] ?? ""}
                          onChange={(e) =>
                            setSelectedTrainer((prev) => ({
                              ...prev,
                              [enrollment.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="" disabled>
                            Select trainer
                          </option>
                          {trainers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}{t.specialty ? ` — ${t.specialty}` : ""}
                            </option>
                          ))}
                        </select>
                        {" "}
                        <button
                          type="button"
                          onClick={() => handleAssign(enrollment.id)}
                          disabled={!selectedTrainer[enrollment.id] || busy}
                          aria-busy={busy}
                        >
                          {busy ? "Assigning…" : "Assign"}
                        </button>
                      </>
                    )}
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
