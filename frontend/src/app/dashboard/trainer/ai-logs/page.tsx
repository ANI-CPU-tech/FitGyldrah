"use client";

import { useEffect, useState } from "react";
import { aiApi, AIPromptLog, AIPromptLogDetail } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

export default function AILogsPage() {
  const [logs, setLogs] = useState<AIPromptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [planTypeFilter, setPlanTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Expanded detail: maps log id → full detail (loaded on demand)
  const [details, setDetails] = useState<Record<string, AIPromptLogDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Load logs ──────────────────────────────────────────────────────────────
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

  useEffect(() => {
    loadLogs();
  }, [planTypeFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load detail on expand ──────────────────────────────────────────────────
  async function handleExpand(logId: string) {
    // Already loaded
    if (details[logId]) return;

    setLoadingDetail(logId);
    setDetailError(null);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await aiApi.logDetail(logId, token);

    setLoadingDetail(null);

    if (error) { setDetailError(flattenErrors(error)); return; }
    if (data) setDetails((prev) => ({ ...prev, [logId]: data }));
  }

  return (
    <div>
      <h1>AI Audit Logs</h1>
      <p>
        Full history of every AI plan generation request. Expand a row to see
        the system prompt, user prompt, raw response, and token usage.
      </p>

      {/* Filters */}
      <div>
        <label htmlFor="planTypeFilter">Plan Type</label>
        <select
          id="planTypeFilter"
          value={planTypeFilter}
          onChange={(e) => setPlanTypeFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="DIET">Diet</option>
          <option value="WORKOUT">Workout</option>
        </select>

        <label htmlFor="statusFilter">Status</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {loading && <p>Loading logs…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {detailError && <p role="alert">{detailError}</p>}

      {!loading && logs.length === 0 && (
        <p>No AI generation logs found.</p>
      )}

      {logs.length > 0 && (
        <table border={1}>
          <thead>
            <tr>
              <th>Plan Type</th>
              <th>Member</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Plan ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const detail = details[log.id];
              return (
                <tr key={log.id}>
                  <td>{log.plan_type}</td>
                  <td>{log.member_name}</td>
                  <td>{log.model_used || "—"}</td>
                  <td>{log.total_tokens}</td>
                  <td>{log.status_label}</td>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>
                    {log.completed_at
                      ? new Date(log.completed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{log.plan_id ?? "—"}</td>
                  <td>
                    <details onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) {
                        handleExpand(log.id);
                      }
                    }}>
                      <summary>
                        {loadingDetail === log.id ? "Loading…" : "Expand"}
                      </summary>

                      {detail ? (
                        <div>
                          <p>
                            <strong>Trainer:</strong> {detail.trainer_name}
                          </p>
                          <p>
                            <strong>Celery Task ID:</strong>{" "}
                            <code>{detail.celery_task_id}</code>
                          </p>
                          <p>
                            <strong>Tokens:</strong> prompt={detail.prompt_tokens}{" "}
                            + completion={detail.completion_tokens} ={" "}
                            {detail.total_tokens} total
                          </p>
                          <p>
                            <strong>Extra Instructions:</strong>{" "}
                            {detail.extra_instructions || "—"}
                          </p>

                          {detail.error_message && (
                            <p>
                              <strong>Error:</strong> {detail.error_message}
                            </p>
                          )}

                          <details>
                            <summary>System Prompt</summary>
                            <pre>{detail.system_prompt || "—"}</pre>
                          </details>

                          <details>
                            <summary>User Prompt</summary>
                            <pre>{detail.user_prompt || "—"}</pre>
                          </details>

                          <details>
                            <summary>Raw AI Response</summary>
                            <pre>{detail.raw_response || "—"}</pre>
                          </details>
                        </div>
                      ) : (
                        !loadingDetail && <p>No detail loaded yet.</p>
                      )}
                    </details>
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
