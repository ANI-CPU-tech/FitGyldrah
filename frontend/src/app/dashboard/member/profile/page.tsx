"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  AlertCircle, CheckCircle2, Loader2, User, Mail,
  Calendar, Shield, Save, Target, Ruler, Weight,
} from "lucide-react";
import { memberProfileApi, UserProfile } from "@/utils/api";

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20";

const labelCls = "block text-sm font-medium text-zinc-300 mb-1.5";

export default function ProfilePage() {
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName]         = useState("");
  const [height, setHeight]     = useState("");
  const [weight, setWeight]     = useState("");
  const [bodyFat, setBodyFat]   = useState("");
  const [goals, setGoals]       = useState("");

  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    memberProfileApi.get(token).then(({ data, error: err }) => {
      setLoading(false);
      if (err) { setLoadError((err.detail as string) ?? "Failed to load profile."); return; }
      if (data) {
        setProfile(data);
        setName(data.name ?? "");
        setHeight(data.height != null ? String(data.height) : "");
        setWeight(data.weight != null ? String(data.weight) : "");
        setBodyFat(data.body_fat_pct != null ? String(data.body_fat_pct) : "");
        setGoals(data.goals ?? "");
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null); setSaveSuccess(null); setSaving(true);
    const token = getToken();
    const { data, error: err } = await memberProfileApi.update(
      {
        name: name || undefined,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
        goals: goals || undefined,
      },
      token
    );
    setSaving(false);
    if (err) { setSaveError(Object.values(err).flat().join(" ")); return; }
    if (data) {
      setProfile(data);
      const raw = localStorage.getItem("user");
      if (raw) {
        try { localStorage.setItem("user", JSON.stringify({ ...JSON.parse(raw), ...data })); } catch { /* ignore */ }
      }
    }
    setSaveSuccess("Profile updated successfully.");
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 py-12">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
    </div>
  );

  if (loadError) return (
    <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400 max-w-lg">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{loadError}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">My Profile</h1>
        <p className="text-sm text-zinc-400 mt-1">View your account details and update your biodata.</p>
      </div>

      {/* Account info card */}
      {profile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Account</p>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={1.5} />
              <span className="text-zinc-400 w-24 shrink-0">Name</span>
              <span className="text-zinc-200 font-medium">{profile.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={1.5} />
              <span className="text-zinc-400 w-24 shrink-0">Email</span>
              <span className="text-zinc-200">{profile.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={1.5} />
              <span className="text-zinc-400 w-24 shrink-0">Role</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-950/60 text-sky-400 border border-sky-900/40">
                {profile.role}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-zinc-600 shrink-0" strokeWidth={1.5} />
              <span className="text-zinc-400 w-24 shrink-0">Member Since</span>
              <span className="text-zinc-400">{new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Biodata form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Update Biodata</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className={labelCls}>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-zinc-500" />Full Name</span>
            </label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="height" className={labelCls}>
                <span className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5 text-zinc-500" />Height (cm)</span>
              </label>
              <input id="height" type="number" step="0.1" value={height}
                onChange={(e) => setHeight(e.target.value)} placeholder="175" className={inputCls} />
            </div>
            <div>
              <label htmlFor="weight" className={labelCls}>
                <span className="flex items-center gap-1.5"><Weight className="w-3.5 h-3.5 text-zinc-500" />Weight (kg)</span>
              </label>
              <input id="weight" type="number" step="0.1" value={weight}
                onChange={(e) => setWeight(e.target.value)} placeholder="75" className={inputCls} />
            </div>
          </div>

          <div>
            <label htmlFor="bodyFat" className={labelCls}>Body Fat (%)</label>
            <input id="bodyFat" type="number" step="0.1" value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)} placeholder="18" className={inputCls} />
          </div>

          <div>
            <label htmlFor="goals" className={labelCls}>
              <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-zinc-500" />Goals</span>
            </label>
            <textarea id="goals" value={goals} onChange={(e) => setGoals(e.target.value)}
              rows={3} placeholder="Lose fat, build muscle, improve endurance…"
              className={`${inputCls} resize-none`} />
          </div>

          {saveError && (
            <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{saveError}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{saveSuccess}</span>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-sky-700 hover:bg-sky-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
