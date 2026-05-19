"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Users, UserCheck } from "lucide-react";
import { gymApi, Gym, MemberEnrollment, TrainerProfile } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

const selectCls =
  "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-amber-600/70 focus:ring-2 focus:ring-amber-600/15 appearance-none";

function MemberDirectoryContent() {
  const searchParams     = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState(preselectedGymId);
  const [members, setMembers]         = useState<MemberEnrollment[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError]     = useState<string | null>(null);
  const [trainers, setTrainers]       = useState<TrainerProfile[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<Record<string, string>>({});
  const [assignState, setAssignState] = useState<Record<string, boolean>>({});
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data }) => {
      if (data) {
        setGyms(data);
        if (!selectedGymId && data.length > 0) setSelectedGymId(data[0].id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedGymId) return;
    const token = localStorage.getItem("access_token") ?? "";
    setMembersLoading(true);
    setMembersError(null);
    setMembers([]);
    setTrainers([]);
    Promise.all([
      gymApi.members(selectedGymId, "ACTIVE", token),
      gymApi.trainers(selectedGymId, token),
    ]).then(([membersRes, trainersRes]) => {
      setMembersLoading(false);
      if (membersRes.error) { setMembersError(flattenErrors(membersRes.error)); }
      else { setMembers(membersRes.data ?? []); }
      if (trainersRes.data) setTrainers(trainersRes.data);
    });
  }, [selectedGymId]);

  async function handleAssign(enrollmentId: string) {
    const trainerId = selectedTrainer[enrollmentId];
    if (!trainerId || !selectedGymId) return;
    setAssignError(null);
    setAssignSuccess(null);
    setAssignState((prev) => ({ ...prev, [enrollmentId]: true }));
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error: apiError } = await gymApi.assignTrainer(selectedGymId, enrollmentId, trainerId, token);
    setAssignState((prev) => ({ ...prev, [enrollmentId]: false }));
    if (apiError) { setAssignError(flattenErrors(apiError)); return; }
    if (data) {
      setMembers((prev) => prev.map((m) => m.id === enrollmentId ? data.enrollment : m));
      setAssignSuccess("Trainer assigned successfully.");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Member Directory</h1>
        <p className="text-sm text-zinc-400 mt-1">View active enrollments and assign trainers.</p>
      </div>

      {/* Gym selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="gymSelect" className="text-xs font-semibold uppercase tracking-widest text-zinc-500 shrink-0">
          Gym
        </label>
        <select id="gymSelect" value={selectedGymId}
          onChange={(e) => setSelectedGymId(e.target.value)}
          className={selectCls}>
          <option value="" disabled>Choose a gym</option>
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {membersError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{membersError}</span>
        </div>
      )}
      {assignError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{assignError}</span>
        </div>
      )}
      {assignSuccess && (
        <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-xl px-4 py-3.5 text-sm text-emerald-400">
          <UserCheck className="w-4 h-4 shrink-0" /><span>{assignSuccess}</span>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            Active Enrollments
          </h2>
          {!membersLoading && (
            <span className="text-xs text-zinc-500">{members.length} member{members.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {membersLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading members…
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Users className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No active members at this gym.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Member", "Email", "Tier", "Price Paid", "Trainer", "Start", "End", "Days Left", "Assign Trainer"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {members.map((enrollment) => {
                  const busy = assignState[enrollment.id];
                  return (
                    <tr key={enrollment.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{enrollment.member_name}</td>
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{enrollment.member_email}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{enrollment.tier_name}</td>
                      <td className="px-5 py-3.5 text-zinc-400">₹{enrollment.price_paid}</td>
                      <td className="px-5 py-3.5">
                        {enrollment.trainer_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-900/40">
                            <UserCheck className="w-3 h-3" />{enrollment.trainer_name}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{enrollment.start_date}</td>
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{enrollment.end_date}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium ${enrollment.days_remaining <= 7 ? "text-red-400" : enrollment.days_remaining <= 30 ? "text-amber-400" : "text-zinc-400"}`}>
                          {enrollment.days_remaining}d
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {trainers.length === 0 ? (
                          <span className="text-xs text-zinc-600">No approved trainers</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Select trainer for ${enrollment.member_name}`}
                              value={selectedTrainer[enrollment.id] ?? ""}
                              onChange={(e) => setSelectedTrainer((prev) => ({ ...prev, [enrollment.id]: e.target.value }))}
                              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-amber-600/70 appearance-none min-w-32"
                            >
                              <option value="" disabled>Select trainer</option>
                              {trainers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}{t.specialty ? ` — ${t.specialty}` : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAssign(enrollment.id)}
                              disabled={!selectedTrainer[enrollment.id] || busy}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              {busy
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <UserCheck className="w-3 h-3" />}
                              {busy ? "…" : "Assign"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemberDirectoryPage() {
  return (
    <Suspense>
      <MemberDirectoryContent />
    </Suspense>
  );
}
