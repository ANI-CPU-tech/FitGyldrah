"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  scheduleApi,
  gymApi,
  trainerApi,
  Schedule,
  Gym,
  GymApplication,
  SessionType,
} from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "WORKOUT", label: "Workout Session" },
  { value: "CONSULTATION", label: "Consultation" },
  { value: "ASSESSMENT", label: "Fitness Assessment" },
  { value: "DIET_REVIEW", label: "Diet Plan Review" },
];

export default function SchedulePage() {
  // ── Schedule list ──────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  // ── Gyms & members for the create form ────────────────────────────────────
  const [approvedApps, setApprovedApps] = useState<GymApplication[]>([]);
  const [allGyms, setAllGyms] = useState<Gym[]>([]);

  // ── Create form state ──────────────────────────────────────────────────────
  const [formMemberId, setFormMemberId] = useState("");
  const [formGymId, setFormGymId] = useState("");
  const [formSessionType, setFormSessionType] = useState<SessionType>("WORKOUT");
  const [formProposedTime, setFormProposedTime] = useState("");
  const [formDuration, setFormDuration] = useState("60");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // ── Mark complete state ────────────────────────────────────────────────────
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ── Load schedules ─────────────────────────────────────────────────────────
  function loadSchedules(filter: string) {
    const token = localStorage.getItem("access_token") ?? "";
    setListLoading(true);
    setListError(null);
    scheduleApi.list(`status=${filter}`, token).then(({ data, error }) => {
      setListLoading(false);
      if (error) { setListError(flattenErrors(error)); return; }
      setSchedules(data ?? []);
    });
  }

  useEffect(() => {
    loadSchedules(statusFilter);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load approved gyms for the form ───────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";

    trainerApi.myApplications(token).then(({ data }) => {
      const approved = (data ?? []).filter((a) => a.status === "APPROVED");
      setApprovedApps(approved);
    });

    // Public gym list to resolve gym names → ids
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`)
      .then((r) => r.json())
      .then((data: Gym[]) => setAllGyms(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gyms where trainer is approved (resolved from applications)
  const gymNameToId: Record<string, string> = {};
  for (const g of allGyms) gymNameToId[g.name] = g.id;
  const approvedGyms = approvedApps
    .map((a) => ({ id: gymNameToId[a.gym_name] ?? "", name: a.gym_name }))
    .filter((g) => g.id);

  // ── Create schedule ────────────────────────────────────────────────────────
  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreateSubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await scheduleApi.create(
      {
        member: formMemberId.trim(),
        gym: formGymId,
        session_type: formSessionType,
        proposed_time: new Date(formProposedTime).toISOString(),
        duration_minutes: parseInt(formDuration, 10),
        location: formLocation.trim(),
        notes: formNotes.trim(),
      },
      token
    );

    setCreateSubmitting(false);

    if (error) { setCreateError(flattenErrors(error)); return; }

    if (data) {
      setSchedules((prev) => [data, ...prev]);
      setFormMemberId("");
      setFormProposedTime("");
      setFormLocation("");
      setFormNotes("");
      setCreateSuccess("Session proposed successfully.");
    }
  }

  // ── Mark complete ──────────────────────────────────────────────────────────
  async function handleMarkComplete(scheduleId: string) {
    setCompleteError(null);
    setCompletingId(scheduleId);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await scheduleApi.markComplete(scheduleId, token);

    setCompletingId(null);

    if (error) { setCompleteError(flattenErrors(error)); return; }

    if (data) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === scheduleId ? data.schedule : s))
      );
    }
  }

  return (
    <div>
      <h1>Calendar &amp; Sessions</h1>

      {/* ── Schedule list ── */}
      <section>
        <h2>My Sessions</h2>

        <div>
          <label htmlFor="statusFilter">Filter by status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {listLoading && <p>Loading sessions…</p>}
        {listError && <p role="alert">{listError}</p>}
        {completeError && <p role="alert">{completeError}</p>}

        {!listLoading && schedules.length === 0 && (
          <p>No sessions with status {statusFilter}.</p>
        )}

        {schedules.length > 0 && (
          <table border={1}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Gym</th>
                <th>Type</th>
                <th>Proposed Time</th>
                <th>Duration</th>
                <th>Location</th>
                <th>Status</th>
                <th>Member Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.member_name}</td>
                  <td>{s.gym_name}</td>
                  <td>{s.session_type_label}</td>
                  <td>{new Date(s.proposed_time).toLocaleString()}</td>
                  <td>{s.duration_minutes} min</td>
                  <td>{s.location || "—"}</td>
                  <td>{s.status_label}</td>
                  <td>{s.member_note || "—"}</td>
                  <td>
                    {s.status === "ACCEPTED" && (
                      <button
                        type="button"
                        onClick={() => handleMarkComplete(s.id)}
                        disabled={completingId === s.id}
                        aria-busy={completingId === s.id}
                      >
                        {completingId === s.id ? "Marking…" : "Mark Complete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Propose new session ── */}
      <section>
        <h2>Propose a New Session</h2>
        <p>
          The member UUID and gym must match an active enrollment. The trainer
          must be approved at the chosen gym.
        </p>

        <form onSubmit={handleCreate}>
          <div>
            <label htmlFor="formMemberId">Member UUID</label>
            <input
              id="formMemberId"
              type="text"
              value={formMemberId}
              onChange={(e) => setFormMemberId(e.target.value)}
              required
              placeholder="Member's user UUID"
            />
          </div>

          <div>
            <label htmlFor="formGymId">Gym (approved only)</label>
            <select
              id="formGymId"
              value={formGymId}
              onChange={(e) => setFormGymId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a gym
              </option>
              {approvedGyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="formSessionType">Session Type</label>
            <select
              id="formSessionType"
              value={formSessionType}
              onChange={(e) => setFormSessionType(e.target.value as SessionType)}
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="formProposedTime">Proposed Date &amp; Time</label>
            <input
              id="formProposedTime"
              type="datetime-local"
              value={formProposedTime}
              onChange={(e) => setFormProposedTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="formDuration">Duration (minutes, 15–240)</label>
            <input
              id="formDuration"
              type="number"
              min="15"
              max="240"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="formLocation">Location (optional)</label>
            <input
              id="formLocation"
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder="e.g. Main Floor, Studio B"
            />
          </div>

          <div>
            <label htmlFor="formNotes">Notes (optional)</label>
            <textarea
              id="formNotes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
            />
          </div>

          {createError && <p role="alert">{createError}</p>}
          {createSuccess && <p role="status">{createSuccess}</p>}

          <button type="submit" disabled={createSubmitting}>
            {createSubmitting ? "Proposing…" : "Propose Session"}
          </button>
        </form>
      </section>
    </div>
  );
}
