"use client";

import { useEffect, useState, FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, CalendarPlus } from "lucide-react";
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
  { value: "WORKOUT",      label: "Workout Session" },
  { value: "CONSULTATION", label: "Consultation" },
  { value: "ASSESSMENT",   label: "Fitness Assessment" },
  { value: "DIET_REVIEW",  label: "Diet Plan Review" },
];

const STATUS_FILTERS = ["PENDING", "ACCEPTED", "COMPLETED", "REJECTED", "CANCELLED"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   "bg-amber-950/60  text-amber-400  border-amber-900/40",
    ACCEPTED:  "bg-emerald-950/60 text-emerald-400 border-emerald-900/40",
    COMPLETED: "bg-sky-950/60    text-sky-400    border-sky-900/40",
    REJECTED:  "bg-red-950/60    text-red-400    border-red-900/40",
    CANCELLED: "bg-zinc-800      text-zinc-400   border-zinc-700",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20";

const labelCls = "block text-sm font-medium text-zinc-300 mb-1.5";

export default function SchedulePage() {
  const [schedules, setSchedules]     = useState<Schedule[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const [approvedApps, setApprovedApps] = useState<GymApplication[]>([]);
  const [allGyms, setAllGyms]           = useState<Gym[]>([]);

  const [formMemberId, setFormMemberId]         = useState("");
  const [formGymId, setFormGymId]               = useState("");
  const [formSessionType, setFormSessionType]   = useState<SessionType>("WORKOUT");
  const [formProposedTime, setFormProposedTime] = useState("");
  const [formDuration, setFormDuration]         = useState("60");
  const [formLocation, setFormLocation]         = useState("");
  const [formNotes, setFormNotes]               = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError]           = useState<string | null>(null);
  const [createSuccess, setCreateSuccess]       = useState<string | null>(null);

  const [completingId, setCompletingId]   = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

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

  useEffect(() => { loadSchedules(statusFilter); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    trainerApi.myApplications(token).then(({ data }) => {
      setApprovedApps((data ?? []).filter((a) => a.status === "APPROVED"));
    });
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`)
      .then((r) => r.json())
      .then((data: Gym[]) => setAllGyms(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gymNameToId: Record<string, string> = {};
  for (const g of allGyms) gymNameToId[g.name] = g.id;
  const approvedGyms = approvedApps
    .map((a) => ({ id: gymNameToId[a.gym_name] ?? "", name: a.gym_name }))
    .filter((g) => g.id);

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
      setFormMemberId(""); setFormProposedTime(""); setFormLocation(""); setFormNotes("");
      setCreateSuccess("Session proposed successfully.");
    }
  }

  async function handleMarkComplete(scheduleId: string) {
    setCompleteError(null);
    setCompletingId(scheduleId);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await scheduleApi.markComplete(scheduleId, token);
    setCompletingId(null);
    if (error) { setCompleteError(flattenErrors(error)); return; }
    if (data) {
      setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? data.schedule : s)));
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Calendar &amp; Sessions</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your session proposals and track their status.</p>
      </div>

      {/* Sessions table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest flex-1">My Sessions</h2>
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  statusFilter === s
                    ? "bg-red-700/30 text-red-400 border border-red-800/50"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {completeError && (
          <div className="flex items-start gap-2.5 mx-6 mt-4 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{completeError}</span>
          </div>
        )}

        {listLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
          </div>
        ) : listError ? (
          <div className="flex items-start gap-2.5 m-6 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{listError}</span>
          </div>
        ) : schedules.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No sessions with status {statusFilter}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Member", "Gym", "Type", "Proposed Time", "Duration", "Location", "Status", "Member Note", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{s.member_name}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{s.gym_name}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{s.session_type_label}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{new Date(s.proposed_time).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{s.duration_minutes} min</td>
                    <td className="px-5 py-3.5 text-zinc-400">{s.location || "—"}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate">{s.member_note || "—"}</td>
                    <td className="px-5 py-3.5">
                      {s.status === "ACCEPTED" && (
                        <button
                          type="button"
                          onClick={() => handleMarkComplete(s.id)}
                          disabled={completingId === s.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/40 disabled:opacity-50 transition-colors"
                        >
                          {completingId === s.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle2 className="w-3 h-3" />}
                          {completingId === s.id ? "Marking…" : "Complete"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Propose new session */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-red-500" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Propose a New Session</h2>
        </div>
        <p className="text-xs text-zinc-500">
          The member UUID and gym must match an active enrollment. You must be approved at the chosen gym.
        </p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="formMemberId" className={labelCls}>Member UUID</label>
              <input id="formMemberId" type="text" value={formMemberId}
                onChange={(e) => setFormMemberId(e.target.value)} required
                placeholder="Member's user UUID" className={inputCls} />
            </div>
            <div>
              <label htmlFor="formGymId" className={labelCls}>Gym (approved only)</label>
              <select id="formGymId" value={formGymId}
                onChange={(e) => setFormGymId(e.target.value)} required
                className={`${inputCls} appearance-none`}>
                <option value="" disabled>Select a gym</option>
                {approvedGyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="formSessionType" className={labelCls}>Session Type</label>
              <select id="formSessionType" value={formSessionType}
                onChange={(e) => setFormSessionType(e.target.value as SessionType)}
                className={`${inputCls} appearance-none`}>
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="formProposedTime" className={labelCls}>Proposed Date &amp; Time</label>
              <input id="formProposedTime" type="datetime-local" value={formProposedTime}
                onChange={(e) => setFormProposedTime(e.target.value)} required
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="formDuration" className={labelCls}>Duration (minutes, 15–240)</label>
              <input id="formDuration" type="number" min="15" max="240" value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label htmlFor="formLocation" className={labelCls}>Location (optional)</label>
              <input id="formLocation" type="text" value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. Main Floor, Studio B" className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="formNotes" className={labelCls}>Notes (optional)</label>
            <textarea id="formNotes" value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3} className={`${inputCls} resize-none`} />
          </div>

          {createError && (
            <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{createError}</span>
            </div>
          )}
          {createSuccess && (
            <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{createSuccess}</span>
            </div>
          )}

          <button type="submit" disabled={createSubmitting}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
            {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            {createSubmitting ? "Proposing…" : "Propose Session"}
          </button>
        </form>
      </div>
    </div>
  );
}
