"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle, Loader2, UserCheck, UserX, ExternalLink,
} from "lucide-react";
import { gymApi, Gym, GymApplication } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

const selectCls =
  "bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-all focus:border-amber-600/70 focus:ring-2 focus:ring-amber-600/15 appearance-none";

function TrainerRosterContent() {
  const searchParams     = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState(preselectedGymId);
  const [applications, setApplications]   = useState<GymApplication[]>([]);
  const [appsLoading, setAppsLoading]     = useState(false);
  const [appsError, setAppsError]         = useState<string | null>(null);
  const [actionState, setActionState]     = useState<Record<string, "approving" | "rejecting" | null>>({});
  const [actionError, setActionError]     = useState<string | null>(null);

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
    setAppsLoading(true);
    setAppsError(null);
    setApplications([]);
    gymApi.applications(selectedGymId, "PENDING", token).then(({ data, error: apiError }) => {
      setAppsLoading(false);
      if (apiError) { setAppsError(flattenErrors(apiError)); return; }
      setApplications(data ?? []);
    });
  }, [selectedGymId]);

  async function handleReview(appId: string, action: "approve" | "reject") {
    if (!selectedGymId) return;
    setActionError(null);
    setActionState((prev) => ({ ...prev, [appId]: action === "approve" ? "approving" : "rejecting" }));
    const token = localStorage.getItem("access_token") ?? "";
    const { error: apiError } = await gymApi.reviewApplication(selectedGymId, appId, { action }, token);
    setActionState((prev) => ({ ...prev, [appId]: null }));
    if (apiError) { setActionError(flattenErrors(apiError)); return; }
    setApplications((prev) => prev.filter((a) => a.id !== appId));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Trainer Roster</h1>
        <p className="text-sm text-zinc-400 mt-1">Review and approve pending trainer applications.</p>
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

      {actionError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{actionError}</span>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            Pending Applications
          </h2>
          {!appsLoading && (
            <span className="text-xs text-zinc-500">{applications.length} pending</span>
          )}
        </div>

        {appsLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading applications…
          </div>
        ) : appsError ? (
          <div className="flex items-start gap-2.5 m-6 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{appsError}</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <UserCheck className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No pending trainer applications for this gym.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Trainer", "Email", "Specialty", "Exp (yrs)", "Cover Letter", "CV", "Applied", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {applications.map((app) => {
                  const busy = actionState[app.id];
                  return (
                    <tr key={app.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{app.trainer_name}</td>
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{app.trainer_email}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{app.trainer_specialty || "—"}</td>
                      <td className="px-5 py-3.5 text-zinc-400 text-center">{app.trainer_experience}</td>
                      <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate">{app.cover_letter || "—"}</td>
                      <td className="px-5 py-3.5">
                        {app.trainer_cv ? (
                          <a href={app.trainer_cv} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors">
                            <ExternalLink className="w-3 h-3" /> View CV
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(app.id, "approve")}
                            disabled={busy !== null && busy !== undefined}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/40 disabled:opacity-50 transition-colors"
                          >
                            {busy === "approving"
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <UserCheck className="w-3 h-3" />}
                            {busy === "approving" ? "Approving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(app.id, "reject")}
                            disabled={busy !== null && busy !== undefined}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/60 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                          >
                            {busy === "rejecting"
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <UserX className="w-3 h-3" />}
                            {busy === "rejecting" ? "Rejecting…" : "Reject"}
                          </button>
                        </div>
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

export default function TrainerRosterPage() {
  return (
    <Suspense>
      <TrainerRosterContent />
    </Suspense>
  );
}
