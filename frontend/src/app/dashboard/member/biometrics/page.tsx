"use client";

import { useEffect, useState, FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trash2, Activity } from "lucide-react";
import { memberBiometricsApi, BiometricEntry, BiometricTrendRow, BiometricWritePayload } from "@/utils/api";

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

function parseOptionalFloat(val: string): number | null {
  const n = parseFloat(val); return isNaN(n) ? null : n;
}
function parseOptionalInt(val: string): number | null {
  const n = parseInt(val, 10); return isNaN(n) ? null : n;
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20";

function UnitInput({
  id, label, unit, value, onChange, step = "0.1", type = "number",
}: {
  id: string; label: string; unit: string; value: string;
  onChange: (v: string) => void; step?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <input id={id} type={type} step={step} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} pr-10`} />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none font-medium">
          {unit}
        </span>
      </div>
    </div>
  );
}

export default function BiometricsLabPage() {
  const [weight, setWeight]       = useState("");
  const [height, setHeight]       = useState("");
  const [bodyFat, setBodyFat]     = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist]         = useState("");
  const [chest, setChest]         = useState("");
  const [hip, setHip]             = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [notes, setNotes]         = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const [history, setHistory]         = useState<BiometricEntry[]>([]);
  const [trends, setTrends]           = useState<BiometricTrendRow[]>([]);
  const [granularity, setGranularity] = useState("weekly");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingTrends, setLoadingTrends]   = useState(true);
  const [deleteError, setDeleteError]       = useState<string | null>(null);

  function loadHistory() {
    const token = getToken(); setLoadingHistory(true);
    memberBiometricsApi.history(token).then(({ data }) => { setHistory(data ?? []); setLoadingHistory(false); });
  }
  function loadTrends(gran: string) {
    const token = getToken(); setLoadingTrends(true);
    memberBiometricsApi.trends(gran, token).then(({ data }) => { setTrends(data?.results ?? []); setLoadingTrends(false); });
  }

  useEffect(() => { loadHistory(); loadTrends(granularity); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormError(null); setFormSuccess(null); setSubmitting(true);
    const payload: BiometricWritePayload = {
      weight: parseOptionalFloat(weight), height: parseOptionalFloat(height),
      body_fat_pct: parseOptionalFloat(bodyFat), muscle_mass: parseOptionalFloat(muscleMass),
      waist_cm: parseOptionalFloat(waist), chest_cm: parseOptionalFloat(chest),
      hip_cm: parseOptionalFloat(hip), resting_hr: parseOptionalInt(restingHr),
      notes: notes || undefined,
    };
    const token = getToken();
    const { error: err } = await memberBiometricsApi.log(payload, token);
    setSubmitting(false);
    if (err) { setFormError(Object.values(err).flat().join(" ")); return; }
    setFormSuccess("Entry logged successfully.");
    setWeight(""); setHeight(""); setBodyFat(""); setMuscleMass("");
    setWaist(""); setChest(""); setHip(""); setRestingHr(""); setNotes("");
    loadHistory(); loadTrends(granularity);
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const token = getToken();
    const { error: err } = await memberBiometricsApi.delete(id, token);
    if (err) { setDeleteError((err.detail as string) ?? "Delete failed."); return; }
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }

  function handleGranularityChange(gran: string) { setGranularity(gran); loadTrends(gran); }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Biometrics Lab</h1>
        <p className="text-sm text-zinc-400 mt-1">Track your physical metrics over time.</p>
      </div>

      {/* Log form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Log New Reading</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <UnitInput id="weight"    label="Weight"      unit="kg"  value={weight}    onChange={setWeight} />
            <UnitInput id="height"    label="Height"      unit="cm"  value={height}    onChange={setHeight} />
            <UnitInput id="bodyFat"   label="Body Fat"    unit="%"   value={bodyFat}   onChange={setBodyFat} />
            <UnitInput id="muscleMass" label="Muscle Mass" unit="kg" value={muscleMass} onChange={setMuscleMass} />
            <UnitInput id="waist"     label="Waist"       unit="cm"  value={waist}     onChange={setWaist} />
            <UnitInput id="chest"     label="Chest"       unit="cm"  value={chest}     onChange={setChest} />
            <UnitInput id="hip"       label="Hip"         unit="cm"  value={hip}       onChange={setHip} />
            <UnitInput id="restingHr" label="Resting HR"  unit="bpm" value={restingHr} onChange={setRestingHr} step="1" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-xs font-medium text-zinc-400">Notes</label>
            <input id="notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…" className={inputCls} />
          </div>
          {formError && (
            <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{formSuccess}</span>
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 bg-sky-700 hover:bg-sky-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {submitting ? "Logging…" : "Log Entry"}
          </button>
        </form>
      </div>

      {/* Trends ledger */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Trends</h2>
          <div className="flex items-center gap-1">
            {["weekly", "monthly"].map((g) => (
              <button key={g} type="button" onClick={() => handleGranularityChange(g)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  granularity === g
                    ? "bg-sky-700/30 text-sky-400 border border-sky-800/50"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent",
                ].join(" ")}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loadingTrends ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading trends…
          </div>
        ) : trends.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No trend data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Period", "Avg Weight", "Avg Body Fat", "Avg BMI", "Avg Muscle", "Avg HR", "Readings"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trends.map((row, i) => (
                  <tr key={row.period}
                    className={[
                      "border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors",
                      i % 2 === 0 ? "bg-zinc-900/40" : "bg-transparent",
                    ].join(" ")}>
                    <td className="px-5 py-3 font-mono text-xs text-sky-400 font-semibold">{row.period}</td>
                    <td className="px-5 py-3 text-zinc-300">{row.avg_weight != null ? `${row.avg_weight} kg` : "—"}</td>
                    <td className="px-5 py-3 text-zinc-300">{row.avg_body_fat != null ? `${row.avg_body_fat}%` : "—"}</td>
                    <td className="px-5 py-3 text-zinc-300">{row.avg_bmi ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-300">{row.avg_muscle_mass != null ? `${row.avg_muscle_mass} kg` : "—"}</td>
                    <td className="px-5 py-3 text-zinc-300">{row.avg_resting_hr != null ? `${row.avg_resting_hr} bpm` : "—"}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">{row.reading_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">History</h2>
        </div>
        {deleteError && (
          <div className="flex items-start gap-2.5 mx-6 mt-4 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{deleteError}</span>
          </div>
        )}
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
          </div>
        ) : history.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Date", "Weight", "Body Fat", "BMI", "Muscle", "HR", "Notes", ""].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">{new Date(entry.recorded_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-200 font-medium">{entry.weight != null ? `${entry.weight} kg` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{entry.body_fat_pct != null ? `${entry.body_fat_pct}%` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {entry.bmi ?? "—"}
                      {entry.bmi_category && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-500 border border-zinc-700">{entry.bmi_category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{entry.muscle_mass != null ? `${entry.muscle_mass} kg` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{entry.resting_hr != null ? `${entry.resting_hr} bpm` : "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{entry.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(entry.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/40 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
