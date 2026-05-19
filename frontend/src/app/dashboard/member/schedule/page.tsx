"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, XCircle, Loader2, CalendarDays, MapPin, Clock } from "lucide-react";
import { memberScheduleApi, Schedule } from "@/utils/api";

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

function SessionCard({
  session,
  actions,
}: {
  session: Schedule;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{session.session_type_label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Trainer: <span className="text-zinc-300">{session.trainer_name}</span>
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
          {session.gym_name}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {new Date(session.proposed_time).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {session.duration_minutes} min
        </span>
        {session.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{session.location}
          </span>
        )}
      </div>
      {session.notes && (
        <p className="text-xs text-zinc-500 italic border-t border-zinc-700/50 pt-2">{session.notes}</p>
      )}
      <div className="flex items-center gap-2 pt-1">{actions}</div>
    </div>
  );
}

export default function SchedulePage() {
  const [pending, setPending]   = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);

  async function load() {
    const token = getToken();
    const [pendingRes, upcomingRes] = await Promise.all([
      memberScheduleApi.list("status=PENDING", token),
      memberScheduleApi.list("upcoming=true", token),
    ]);
    setPending(pendingRes.data ?? []);
    setUpcoming(upcomingRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRespond(id: string, action: "accept" | "reject") {
    setActionError(null); setBusyId(id);
    const token = getToken();
    const { error: err } = await memberScheduleApi.respond(id, { action }, token);
    setBusyId(null);
    if (err) { setActionError(Object.values(err).flat().join(" ")); return; }
    await load();
  }

  async function handleCancel(id: string) {
    setActionError(null); setBusyId(id);
    const token = getToken();
    const { error: err } = await memberScheduleApi.cancel(id, token);
    setBusyId(null);
    if (err) { setActionError(Object.values(err).flat().join(" ")); return; }
    await load();
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 py-12">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading schedule…
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">My Schedule</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage session proposals and upcoming appointments.</p>
      </div>

      {actionError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{actionError}</span>
        </div>
      )}

      {/* Pending proposals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Pending Proposals
          </h2>
          <span className="text-xs text-zinc-600">{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-8 text-center">
            <CalendarDays className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No pending session proposals.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <SessionCard key={s.id} session={s} actions={
                <>
                  <button onClick={() => handleRespond(s.id, "accept")} disabled={busyId === s.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors">
                    {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Accept
                  </button>
                  <button onClick={() => handleRespond(s.id, "reject")} disabled={busyId === s.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 transition-colors">
                    {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    Reject
                  </button>
                </>
              } />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Upcoming Sessions
          </h2>
          <span className="text-xs text-zinc-600">{upcoming.length}</span>
        </div>

        {upcoming.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-8 text-center">
            <CalendarDays className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No upcoming sessions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} actions={
                <button onClick={() => handleCancel(s.id)} disabled={busyId === s.id}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-950/60 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-50 transition-colors">
                  {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  Cancel Session
                </button>
              } />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
