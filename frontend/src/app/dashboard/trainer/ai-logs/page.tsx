"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { aiApi, AIPromptLog, AIPromptLogDetail } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-emerald-950/60 text-emerald-400 border-emerald-900/40",
    PENDING: "bg-amber-950/60  text-amber-400  border-amber-900/40",
    FAILED:  "bg-red-950/60    text-red-400    border-red-900/40",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

function PromptBlock({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-700/60 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-800 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <pre className="px-4 py-3 bg-black/40 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {content || "—"}
        </pre>
      )}
    </div>
  );
}

export default function AILogsPage() {
  const [logs, setLogs]           = useState<AIPromptLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [planTypeFilter, setPlanTypeFilter] = useState("");
  const [statusFilter, setStatusFilter]     = useState("");

  const [details, setDetails]           = useState<Record<string, AIPromptLogDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailError, setDetailError]   = useState<string | null>(null);

  // Track which rows are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function loadLogs() {
    const token = localStorage.getItem("access_token") ?? "";
    const params = new URLSearchParams();
    if (planTypeFilter) params.set("plan_type", planTypeFilter);
    if (statusFilter) params.set("status", statusFilter);
    setLoading(true);
    setLoadError(null);
    aiApi.logs(params.toString(), token).then(({ data, error }) => {
      setLoading(false);
      if (error) { setLoadError(flattenErrors(error)); return; }
      setLogs(data ?? []);
    });
  }

  useEffect(() => { loadLogs(); }, [planTypeFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(logId: string) {
    const next = new Set(expandedIds);
    if (next.has(logId)) {
      next.delete(logId);
      setExpandedIds(next);
      return;
    }
    next.add(logId);
    setExpandedIds(next);

    if (details[logId]) return;
    setLoadingDetail(logId);
    setDetailError(null);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await aiApi.logDetail(logId, token);
    setLoadingDetail(null);
    if (error) { setDetailError(flattenErrors(error)); return; }
    if (data) setDetails((prev) => ({ ...prev, [logId]: data }));
  }

  const selectCls =
    "bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 appearance-none";

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">AI Audit Logs</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Full history of every AI plan generation request. Expand a row to audit prompts, responses, and token usage.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="planTypeFilter" className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Type</label>
          <select id="planTypeFilter" value={planTypeFilter}
            onChange={(e) => setPlanTypeFilter(e.target.value)} className={selectCls}>
            <option value="">All</option>
            <option value="DIET">Diet</option>
            <option value="WORKOUT">Workout</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="statusFilter" className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</label>
          <select id="statusFilter" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {detailError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{detailError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading logs…
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{loadError}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">No AI generation logs found.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Type", "Member", "Model", "Tokens", "Status", "Created", "Completed", "Plan ID", ""].map((h, i) => (
                    <th key={i} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  const detail = details[log.id];
                  const isLoadingThis = loadingDetail === log.id;

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`border-b border-zinc-800/60 transition-colors ${isExpanded ? "bg-zinc-800/30" : "hover:bg-zinc-800/40"}`}
                      >
                        <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{log.plan_type}</td>
                        <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{log.member_name}</td>
                        <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs whitespace-nowrap">{log.model_used || "—"}</td>
                        <td className="px-5 py-3.5 text-zinc-400 font-mono text-xs">{log.total_tokens}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={log.gen_status} /></td>
                        <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">
                          {log.completed_at ? new Date(log.completed_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">
                          {log.plan_id ? log.plan_id.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggle(log.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                          >
                            {isLoadingThis
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />}
                            {isExpanded ? "Collapse" : "Expand"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${log.id}-detail`} className="border-b border-zinc-800/60">
                          <td colSpan={9} className="px-6 py-5 bg-zinc-950/60">
                            {isLoadingThis ? (
                              <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading detail…
                              </div>
                            ) : detail ? (
                              <div className="space-y-4">
                                {/* Meta row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="text-zinc-600 mb-0.5">Trainer</p>
                                    <p className="text-zinc-300 font-medium">{detail.trainer_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-zinc-600 mb-0.5">Celery Task</p>
                                    <p className="text-zinc-400 font-mono truncate">{detail.celery_task_id}</p>
                                  </div>
                                  <div>
                                    <p className="text-zinc-600 mb-0.5">Prompt Tokens</p>
                                    <p className="text-zinc-300 font-medium">{detail.prompt_tokens}</p>
                                  </div>
                                  <div>
                                    <p className="text-zinc-600 mb-0.5">Completion Tokens</p>
                                    <p className="text-zinc-300 font-medium">{detail.completion_tokens}</p>
                                  </div>
                                </div>

                                {detail.extra_instructions && (
                                  <div className="text-xs">
                                    <p className="text-zinc-600 mb-1">Extra Instructions</p>
                                    <p className="text-zinc-400 font-mono bg-black/30 rounded px-3 py-2">{detail.extra_instructions}</p>
                                  </div>
                                )}

                                {detail.error_message && (
                                  <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-lg px-3.5 py-3 text-xs text-red-400">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{detail.error_message}</span>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <PromptBlock title="System Prompt" content={detail.system_prompt} />
                                  <PromptBlock title="User Prompt" content={detail.user_prompt} />
                                  <PromptBlock title="Raw AI Response" content={detail.raw_response} />
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-zinc-500">No detail loaded yet.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
