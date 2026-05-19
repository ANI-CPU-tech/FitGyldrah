"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Save,
  BadgeCheck,
  Terminal,
} from "lucide-react";
import { planApi, FitnessPlan, PlanType } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40;

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20";

const labelCls = "block text-sm font-medium text-zinc-300 mb-1.5";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    "bg-amber-950/60  text-amber-400  border-amber-900/40",
    APPROVED: "bg-emerald-950/60 text-emerald-400 border-emerald-900/40",
    ARCHIVED: "bg-zinc-800      text-zinc-400   border-zinc-700",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

export default function PlansPage() {
  const [plans, setPlans]           = useState<FitnessPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [genMemberId, setGenMemberId]       = useState("");
  const [genPlanType, setGenPlanType]       = useState<PlanType>("WORKOUT");
  const [genInstructions, setGenInstructions] = useState("");
  const [genSubmitting, setGenSubmitting]   = useState(false);
  const [genError, setGenError]             = useState<string | null>(null);

  const [pollingTaskId, setPollingTaskId]   = useState<string | null>(null);
  const [pollState, setPollState]           = useState<string | null>(null);
  const [pollError, setPollError]           = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [editingPlan, setEditingPlan]       = useState<FitnessPlan | null>(null);
  const [editContent, setEditContent]       = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]           = useState<string | null>(null);
  const [editSuccess, setEditSuccess]       = useState<string | null>(null);

  const [approvingId, setApprovingId]       = useState<string | null>(null);
  const [approveError, setApproveError]     = useState<string | null>(null);

  function loadPlans() {
    const token = localStorage.getItem("access_token") ?? "";
    planApi.list("", token).then(({ data }) => {
      setPlansLoading(false);
      setPlans(data ?? []);
    });
  }

  useEffect(() => {
    loadPlans();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startPolling(taskId: string) {
    pollCountRef.current = 0;
    setPollState("PENDING");
    setPollError(null);
    const token = localStorage.getItem("access_token") ?? "";

    intervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(intervalRef.current!);
        setPollingTaskId(null);
        setPollError("Timed out waiting for AI generation. Please try again.");
        return;
      }
      const { data, error } = await planApi.pollStatus(taskId, token);
      if (error) {
        clearInterval(intervalRef.current!);
        setPollingTaskId(null);
        setPollError(flattenErrors(error));
        return;
      }
      if (!data) return;
      setPollState(data.state);
      if (data.state === "SUCCESS") {
        clearInterval(intervalRef.current!);
        setPollingTaskId(null);
        setGenSubmitting(false);
        if (data.plan) { setPlans((prev) => [data.plan!, ...prev]); openForEditing(data.plan); }
      } else if (data.state === "FAILURE") {
        clearInterval(intervalRef.current!);
        setPollingTaskId(null);
        setGenSubmitting(false);
        setPollError(data.detail ?? "AI generation failed.");
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenError(null);
    setPollError(null);
    setPollState(null);
    setGenSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await planApi.generate(
      { member_id: genMemberId.trim(), plan_type: genPlanType, extra_instructions: genInstructions.trim() },
      token
    );
    if (error) { setGenError(flattenErrors(error)); setGenSubmitting(false); return; }
    if (data) { setPollingTaskId(data.task_id); startPolling(data.task_id); }
  }

  function openForEditing(plan: FitnessPlan) {
    setEditingPlan(plan);
    setEditContent(JSON.stringify(plan.content_json, null, 2));
    setEditError(null);
    setEditSuccess(null);
  }

  async function handleSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPlan) return;
    setEditError(null);
    setEditSuccess(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(editContent); }
    catch { setEditError("Invalid JSON. Fix the syntax before saving."); return; }
    setEditSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await planApi.update(editingPlan.id, { content_json: parsed }, token);
    setEditSubmitting(false);
    if (error) { setEditError(flattenErrors(error)); return; }
    if (data) {
      setEditingPlan(data);
      setEditContent(JSON.stringify(data.content_json, null, 2));
      setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      setEditSuccess("Plan saved.");
    }
  }

  async function handleApprove(planId: string) {
    setApproveError(null);
    setApprovingId(planId);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await planApi.approve(planId, token);
    setApprovingId(null);
    if (error) { setApproveError(flattenErrors(error)); return; }
    if (data) {
      setPlans((prev) => prev.map((p) => (p.id === planId ? data.plan : p)));
      if (editingPlan?.id === planId) setEditingPlan(data.plan);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Plan Builder &amp; AI Automation</h1>
        <p className="text-sm text-zinc-400 mt-1">Generate, review, and publish training plans for your clients.</p>
      </div>

      {/* AI Generate form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Generate AI Plan</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Enter the member UUID and plan type. The AI will use their biometric data and your instructions to draft a plan.
        </p>

        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="genMemberId" className={labelCls}>Member UUID</label>
              <input id="genMemberId" type="text" value={genMemberId}
                onChange={(e) => setGenMemberId(e.target.value)} required
                placeholder="Member's user UUID" className={inputCls} />
            </div>
            <div>
              <label htmlFor="genPlanType" className={labelCls}>Plan Type</label>
              <select id="genPlanType" value={genPlanType}
                onChange={(e) => setGenPlanType(e.target.value as PlanType)}
                className={`${inputCls} appearance-none`}>
                <option value="WORKOUT">Workout Plan</option>
                <option value="DIET">Diet Plan</option>
              </select>
            </div>
          </div>

          {/* Command-style instructions input */}
          <div>
            <label htmlFor="genInstructions" className={labelCls}>
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                Extra Instructions (optional)
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-zinc-600 font-mono text-sm select-none">$</span>
              <textarea
                id="genInstructions"
                value={genInstructions}
                onChange={(e) => setGenInstructions(e.target.value)}
                rows={3}
                placeholder="avoid dairy, focus on upper body, high protein…"
                className="w-full bg-black/40 border border-zinc-700 rounded-lg pl-8 pr-3.5 py-2.5 font-mono text-sm text-zinc-300 placeholder-zinc-600 outline-none transition-all focus:border-amber-600/60 focus:ring-2 focus:ring-amber-600/10 resize-none"
              />
            </div>
          </div>

          {genError && (
            <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{genError}</span>
            </div>
          )}

          <button type="submit" disabled={genSubmitting}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
            {genSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {genSubmitting ? "Generating…" : "Generate Plan"}
          </button>
        </form>

        {/* Polling status */}
        {pollingTaskId && (
          <div role="status" aria-live="polite"
            className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <div>
              <p className="text-zinc-300 font-medium">
                {pollState === "PENDING" ? "Waiting in queue…" : "AI is generating the plan…"}
              </p>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">task: {pollingTaskId}</p>
            </div>
          </div>
        )}
        {pollError && (
          <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{pollError}</span>
          </div>
        )}
      </div>

      {/* Edit generated plan */}
      {editingPlan && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">
                {editingPlan.title} — {editingPlan.plan_type_label}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Member: {editingPlan.member_name} · AI: {editingPlan.ai_generated ? "Yes" : "No"}
              </p>
            </div>
            <StatusBadge status={editingPlan.status} />
          </div>

          <div className="p-6 space-y-4">
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label htmlFor="editContent" className={labelCls}>
                  Plan Content (JSON — edit before approving)
                </label>
                <div className="relative rounded-xl overflow-hidden border border-zinc-700 focus-within:border-zinc-600">
                  {/* Editor header bar */}
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800/80 border-b border-zinc-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    <span className="ml-2 text-xs text-zinc-500 font-mono">plan.json</span>
                  </div>
                  <textarea
                    id="editContent"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={20}
                    spellCheck={false}
                    className="w-full bg-black/40 px-5 py-4 font-mono text-sm text-zinc-300 outline-none resize-y leading-relaxed"
                  />
                </div>
              </div>

              {editError && (
                <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{editSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={editSubmitting}
                  className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editSubmitting ? "Saving…" : "Save Changes"}
                </button>

                {editingPlan.status === "DRAFT" && (
                  <>
                    {approveError && (
                      <span className="text-xs text-red-400">{approveError}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApprove(editingPlan.id)}
                      disabled={approvingId === editingPlan.id}
                      className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
                      {approvingId === editingPlan.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <BadgeCheck className="w-4 h-4" />}
                      {approvingId === editingPlan.id ? "Approving…" : "Approve & Publish"}
                    </button>
                  </>
                )}
              </div>

              {editingPlan.status === "APPROVED" && (
                <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Approved and visible to {editingPlan.member_name}.</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Plan list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">All Plans</h2>
        </div>

        {plansLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
          </div>
        ) : plans.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No plans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Title", "Type", "Member", "Status", "AI", "Version", "Created", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-zinc-200 font-medium">{p.title}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{p.plan_type_label}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{p.member_name}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3.5">
                      {p.ai_generated
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-900/40">AI</span>
                        : <span className="text-zinc-600 text-xs">Manual</span>}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">v{p.version}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openForEditing(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${editingPlan?.id === p.id ? "bg-red-700/20 text-red-400 border border-red-800/40" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"}`}>
                          {editingPlan?.id === p.id ? "Editing" : "Edit"}
                        </button>
                        {p.status === "DRAFT" && (
                          <button type="button" onClick={() => handleApprove(p.id)}
                            disabled={approvingId === p.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-900/40 disabled:opacity-50 transition-colors">
                            {approvingId === p.id ? "…" : "Approve"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
