"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
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
const MAX_POLLS = 40; // 2 minutes max

export default function PlansPage() {
  // ── Plan list ──────────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<FitnessPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // ── Generate form ──────────────────────────────────────────────────────────
  const [genMemberId, setGenMemberId] = useState("");
  const [genPlanType, setGenPlanType] = useState<PlanType>("WORKOUT");
  const [genInstructions, setGenInstructions] = useState("");
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Polling state ──────────────────────────────────────────────────────────
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);
  const [pollState, setPollState] = useState<string | null>(null); // PENDING | STARTED | SUCCESS | FAILURE
  const [pollError, setPollError] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Editing a generated plan ───────────────────────────────────────────────
  const [editingPlan, setEditingPlan] = useState<FitnessPlan | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // ── Approve state ──────────────────────────────────────────────────────────
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  // ── Load plans ─────────────────────────────────────────────────────────────
  function loadPlans() {
    const token = localStorage.getItem("access_token") ?? "";
    planApi.list("", token).then(({ data }) => {
      setPlansLoading(false);
      setPlans(data ?? []);
    });
  }

  useEffect(() => {
    loadPlans();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start polling ──────────────────────────────────────────────────────────
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

        if (data.plan) {
          // Add the new plan to the list and open it for editing
          setPlans((prev) => [data.plan!, ...prev]);
          openForEditing(data.plan);
        }
      } else if (data.state === "FAILURE") {
        clearInterval(intervalRef.current!);
        setPollingTaskId(null);
        setGenSubmitting(false);
        setPollError(data.detail ?? "AI generation failed.");
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Trigger AI generation ──────────────────────────────────────────────────
  async function handleGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenError(null);
    setPollError(null);
    setPollState(null);
    setGenSubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await planApi.generate(
      {
        member_id: genMemberId.trim(),
        plan_type: genPlanType,
        extra_instructions: genInstructions.trim(),
      },
      token
    );

    if (error) {
      setGenError(flattenErrors(error));
      setGenSubmitting(false);
      return;
    }

    if (data) {
      setPollingTaskId(data.task_id);
      startPolling(data.task_id);
    }
  }

  // ── Open plan for editing ──────────────────────────────────────────────────
  function openForEditing(plan: FitnessPlan) {
    setEditingPlan(plan);
    setEditContent(JSON.stringify(plan.content_json, null, 2));
    setEditError(null);
    setEditSuccess(null);
  }

  // ── Save edited content ────────────────────────────────────────────────────
  async function handleSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPlan) return;
    setEditError(null);
    setEditSuccess(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editContent);
    } catch {
      setEditError("Invalid JSON. Please fix the syntax before saving.");
      return;
    }

    setEditSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await planApi.update(
      editingPlan.id,
      { content_json: parsed },
      token
    );

    setEditSubmitting(false);

    if (error) { setEditError(flattenErrors(error)); return; }

    if (data) {
      setEditingPlan(data);
      setEditContent(JSON.stringify(data.content_json, null, 2));
      setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      setEditSuccess("Plan saved.");
    }
  }

  // ── Approve plan ───────────────────────────────────────────────────────────
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
    <div>
      <h1>Plan Builder &amp; AI Automation</h1>

      {/* ── AI Generate form ── */}
      <section>
        <h2>Generate AI Plan</h2>
        <p>
          Enter the member&apos;s UUID and plan type. The AI will use their
          biometric data and your instructions to draft a plan.
        </p>

        <form onSubmit={handleGenerate}>
          <div>
            <label htmlFor="genMemberId">Member UUID</label>
            <input
              id="genMemberId"
              type="text"
              value={genMemberId}
              onChange={(e) => setGenMemberId(e.target.value)}
              required
              placeholder="Member's user UUID"
            />
          </div>

          <div>
            <label htmlFor="genPlanType">Plan Type</label>
            <select
              id="genPlanType"
              value={genPlanType}
              onChange={(e) => setGenPlanType(e.target.value as PlanType)}
            >
              <option value="WORKOUT">Workout Plan</option>
              <option value="DIET">Diet Plan</option>
            </select>
          </div>

          <div>
            <label htmlFor="genInstructions">
              Extra Instructions (optional)
            </label>
            <textarea
              id="genInstructions"
              value={genInstructions}
              onChange={(e) => setGenInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. avoid dairy, focus on upper body, high protein"
            />
          </div>

          {genError && <p role="alert">{genError}</p>}

          <button type="submit" disabled={genSubmitting}>
            {genSubmitting ? "Generating…" : "Generate Plan"}
          </button>
        </form>

        {/* Polling status */}
        {pollingTaskId && (
          <div role="status" aria-live="polite">
            <p>
              Task ID: <code>{pollingTaskId}</code>
            </p>
            <p>
              Status: <strong>{pollState ?? "…"}</strong>
            </p>
            {pollState === "PENDING" && <p>Waiting in queue…</p>}
            {pollState === "STARTED" && <p>AI is generating the plan…</p>}
          </div>
        )}
        {pollError && <p role="alert">{pollError}</p>}
      </section>

      {/* ── Edit generated plan ── */}
      {editingPlan && (
        <section>
          <h2>
            Review &amp; Edit Plan — {editingPlan.title} ({editingPlan.plan_type_label})
          </h2>
          <p>
            Status: <strong>{editingPlan.status_label}</strong> | Member:{" "}
            {editingPlan.member_name} | AI Generated:{" "}
            {editingPlan.ai_generated ? "Yes" : "No"}
          </p>

          <form onSubmit={handleSaveEdit}>
            <div>
              <label htmlFor="editContent">
                Plan Content (JSON — edit before approving)
              </label>
              <textarea
                id="editContent"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
                cols={80}
                spellCheck={false}
              />
            </div>

            {editError && <p role="alert">{editError}</p>}
            {editSuccess && <p role="status">{editSuccess}</p>}

            <button type="submit" disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </form>

          {editingPlan.status === "DRAFT" && (
            <div>
              {approveError && <p role="alert">{approveError}</p>}
              <button
                type="button"
                onClick={() => handleApprove(editingPlan.id)}
                disabled={approvingId === editingPlan.id}
                aria-busy={approvingId === editingPlan.id}
              >
                {approvingId === editingPlan.id
                  ? "Approving…"
                  : "Approve Plan (publish to member)"}
              </button>
            </div>
          )}

          {editingPlan.status === "APPROVED" && (
            <p role="status">
              ✓ This plan is approved and visible to {editingPlan.member_name}.
            </p>
          )}
        </section>
      )}

      {/* ── Plan list ── */}
      <section>
        <h2>All Plans</h2>
        {plansLoading && <p>Loading plans…</p>}
        {!plansLoading && plans.length === 0 && <p>No plans yet.</p>}

        {plans.length > 0 && (
          <table border={1}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Member</th>
                <th>Status</th>
                <th>AI</th>
                <th>Version</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.plan_type_label}</td>
                  <td>{p.member_name}</td>
                  <td>{p.status_label}</td>
                  <td>{p.ai_generated ? "Yes" : "No"}</td>
                  <td>v{p.version}</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <button type="button" onClick={() => openForEditing(p)}>
                      {editingPlan?.id === p.id ? "Editing" : "Edit / Review"}
                    </button>
                    {" "}
                    {p.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handleApprove(p.id)}
                        disabled={approvingId === p.id}
                      >
                        {approvingId === p.id ? "Approving…" : "Approve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
