"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  Building2, Plus, X, AlertCircle, CheckCircle2,
  Loader2, MapPin, Clock, Tag,
} from "lucide-react";
import { gymApi, Gym, SubscriptionTier } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-amber-600/70 focus:ring-2 focus:ring-amber-600/15";

const labelCls = "block text-sm font-medium text-zinc-300 mb-1.5";

export default function FacilitiesPage() {
  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError]     = useState<string | null>(null);

  const [gymName, setGymName]             = useState("");
  const [gymLocation, setGymLocation]     = useState("");
  const [gymFacilities, setGymFacilities] = useState("");
  const [gymHours, setGymHours]           = useState('{"Mon-Fri": "6am-10pm", "Sat-Sun": "7am-8pm"}');
  const [gymLogoUrl, setGymLogoUrl]       = useState("");
  const [gymSubmitting, setGymSubmitting] = useState(false);
  const [gymFormError, setGymFormError]   = useState<string | null>(null);
  const [gymFormSuccess, setGymFormSuccess] = useState(false);

  const [tierGymId, setTierGymId]             = useState<string | null>(null);
  const [tierName, setTierName]               = useState("");
  const [tierPrice, setTierPrice]             = useState("");
  const [tierDuration, setTierDuration]       = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [tierDescription, setTierDescription] = useState("");
  const [tierSubmitting, setTierSubmitting]   = useState(false);
  const [tierFormError, setTierFormError]     = useState<string | null>(null);

  function loadGyms() {
    const token = localStorage.getItem("access_token") ?? "";
    setGymsLoading(true);
    gymApi.mine(token).then(({ data, error: apiError }) => {
      setGymsLoading(false);
      if (apiError) { setGymsError(flattenErrors(apiError)); return; }
      setGyms(data ?? []);
    });
  }

  useEffect(() => { loadGyms(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateGym(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGymFormError(null);
    setGymFormSuccess(false);
    let parsedHours: Record<string, string> = {};
    try { parsedHours = JSON.parse(gymHours); }
    catch { setGymFormError('Operating hours must be valid JSON, e.g. {"Mon-Fri": "6am-10pm"}'); return; }
    setGymSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { error: apiError } = await gymApi.create(
      { name: gymName.trim(), location: gymLocation.trim(), facilities: gymFacilities.trim(), operating_hours: parsedHours, logo_url: gymLogoUrl.trim() || undefined },
      token
    );
    setGymSubmitting(false);
    if (apiError) { setGymFormError(flattenErrors(apiError)); return; }
    setGymName(""); setGymLocation(""); setGymFacilities("");
    setGymHours('{"Mon-Fri": "6am-10pm", "Sat-Sun": "7am-8pm"}'); setGymLogoUrl("");
    setGymFormSuccess(true);
    loadGyms();
  }

  async function handleCreateTier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tierGymId) return;
    setTierFormError(null);
    setTierSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data: newTier, error: apiError } = await gymApi.createTier(
      tierGymId,
      { name: tierName.trim(), price: tierPrice, duration_type: tierDuration, description: tierDescription.trim() },
      token
    );
    setTierSubmitting(false);
    if (apiError) { setTierFormError(flattenErrors(apiError)); return; }
    if (newTier) {
      setGyms((prev) => prev.map((g) => g.id === tierGymId ? { ...g, tiers: [...g.tiers, newTier] } : g));
    }
    setTierName(""); setTierPrice(""); setTierDuration("MONTHLY"); setTierDescription(""); setTierGymId(null);
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Facilities &amp; Tiers</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your gyms and their subscription tiers.</p>
      </div>

      {gymsError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{gymsError}</span>
        </div>
      )}

      {gymsLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : gyms.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-8 text-center">
          <Building2 className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">No gyms yet. Register one below.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {gyms.map((gym) => (
            <div key={gym.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-100">{gym.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{gym.location}</span>
                    {gym.facilities && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{gym.facilities}</span>}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${gym.is_payment_ready ? "bg-emerald-950/60 text-emerald-400 border-emerald-900/40" : "bg-amber-950/60 text-amber-400 border-amber-900/40"}`}>
                  {gym.is_payment_ready ? "Payment Ready" : "No Bank"}
                </span>
              </div>

              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Subscription Tiers</p>
                  {tierGymId !== gym.id && (
                    <button type="button" onClick={() => setTierGymId(gym.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-950/40 border border-amber-900/30 transition-colors">
                      <Plus className="w-3 h-3" /> Add Tier
                    </button>
                  )}
                </div>

                {gym.tiers.length === 0 ? (
                  <p className="text-xs text-zinc-600">No tiers yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {["Name", "Price (₹)", "Duration", "Description"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {gym.tiers.map((tier: SubscriptionTier) => (
                          <tr key={tier.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-3 py-2.5 text-zinc-200 font-medium">{tier.name}</td>
                            <td className="px-3 py-2.5 text-zinc-300">₹{tier.price}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">{tier.duration_type}</span>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-500">{tier.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tierGymId === gym.id && (
                  <div className="mt-3 bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New Tier</p>
                      <button type="button" onClick={() => { setTierGymId(null); setTierFormError(null); }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <form onSubmit={handleCreateTier} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor={`tier-name-${gym.id}`} className={labelCls}>Tier Name</label>
                          <input id={`tier-name-${gym.id}`} type="text" value={tierName}
                            onChange={(e) => setTierName(e.target.value)} required
                            placeholder="e.g. Basic, Premium" className={inputCls} />
                        </div>
                        <div>
                          <label htmlFor={`tier-price-${gym.id}`} className={labelCls}>Price (₹)</label>
                          <input id={`tier-price-${gym.id}`} type="number" step="0.01" min="0.01"
                            value={tierPrice} onChange={(e) => setTierPrice(e.target.value)}
                            required className={inputCls} />
                        </div>
                        <div>
                          <label htmlFor={`tier-duration-${gym.id}`} className={labelCls}>Duration</label>
                          <select id={`tier-duration-${gym.id}`} value={tierDuration}
                            onChange={(e) => setTierDuration(e.target.value as "MONTHLY" | "YEARLY")}
                            className={`${inputCls} appearance-none`}>
                            <option value="MONTHLY">Monthly</option>
                            <option value="YEARLY">Yearly</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`tier-desc-${gym.id}`} className={labelCls}>Description</label>
                          <input id={`tier-desc-${gym.id}`} type="text" value={tierDescription}
                            onChange={(e) => setTierDescription(e.target.value)}
                            placeholder="Optional" className={inputCls} />
                        </div>
                      </div>
                      {tierFormError && (
                        <div className="flex items-start gap-2 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2.5 text-xs text-red-400">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{tierFormError}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={tierSubmitting}
                          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-4 py-2 text-xs transition-colors cursor-pointer disabled:cursor-not-allowed">
                          {tierSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {tierSubmitting ? "Adding…" : "Add Tier"}
                        </button>
                        <button type="button" onClick={() => { setTierGymId(null); setTierFormError(null); }}
                          className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register new gym */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Register a New Gym</h2>
        </div>
        <form onSubmit={handleCreateGym} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="gymName" className={labelCls}>Gym Name</label>
              <input id="gymName" type="text" value={gymName}
                onChange={(e) => setGymName(e.target.value)} required
                placeholder="At least 3 characters" className={inputCls} />
            </div>
            <div>
              <label htmlFor="gymLocation" className={labelCls}>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-500" />Location</span>
              </label>
              <input id="gymLocation" type="text" value={gymLocation}
                onChange={(e) => setGymLocation(e.target.value)} required
                placeholder="Full address" className={inputCls} />
            </div>
            <div>
              <label htmlFor="gymFacilities" className={labelCls}>
                <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-zinc-500" />Facilities</span>
              </label>
              <input id="gymFacilities" type="text" value={gymFacilities}
                onChange={(e) => setGymFacilities(e.target.value)}
                placeholder="e.g. Pool, Sauna, Free Weights" className={inputCls} />
            </div>
            <div>
              <label htmlFor="gymHours" className={labelCls}>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-zinc-500" />Operating Hours (JSON)</span>
              </label>
              <input id="gymHours" type="text" value={gymHours}
                onChange={(e) => setGymHours(e.target.value)} required
                placeholder='{"Mon-Fri": "6am-10pm"}' className={`${inputCls} font-mono text-xs`} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gymLogoUrl" className={labelCls}>Logo URL (optional)</label>
              <input id="gymLogoUrl" type="url" value={gymLogoUrl}
                onChange={(e) => setGymLogoUrl(e.target.value)}
                placeholder="https://…" className={inputCls} />
            </div>
          </div>
          {gymFormError && (
            <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{gymFormError}</span>
            </div>
          )}
          {gymFormSuccess && (
            <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>Gym registered successfully.</span>
            </div>
          )}
          <button type="submit" disabled={gymSubmitting}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
            {gymSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {gymSubmitting ? "Registering…" : "Register Gym"}
          </button>
        </form>
      </div>
    </div>
  );
}
