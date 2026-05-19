"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ChevronRight, User } from "lucide-react";
import {
  trainerApi,
  gymApi,
  biometricsApi,
  GymApplication,
  MemberEnrollment,
  BiometricEntry,
} from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

interface ClientRow extends MemberEnrollment {
  gym_id: string;
  gym_name_display: string;
  member_id_hint: string;
}

export default function ClientsPage() {
  const [clients, setClients]     = useState<ClientRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [biometrics, setBiometrics] = useState<BiometricEntry[]>([]);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError]     = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    const user = (() => {
      try { return JSON.parse(localStorage.getItem("user") ?? "{}"); } catch { return {}; }
    })();
    const trainerName: string = user.name ?? "";

    trainerApi.myApplications(token).then(async ({ data: apps, error }) => {
      if (error) { setLoadError(flattenErrors(error)); setLoading(false); return; }

      const approvedApps: GymApplication[] = (apps ?? []).filter((a) => a.status === "APPROVED");
      if (approvedApps.length === 0) { setLoading(false); return; }

      const gymsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`
      );
      const allGyms = gymsRes.ok ? await gymsRes.json() : [];
      const gymNameToId: Record<string, string> = {};
      for (const g of allGyms) gymNameToId[g.name] = g.id;

      const clientRows: ClientRow[] = [];
      await Promise.all(
        approvedApps.map(async (app) => {
          const gymId = gymNameToId[app.gym_name];
          if (!gymId) return;
          const { data: members } = await gymApi.members(gymId, "ACTIVE", token);
          if (!members) return;
          for (const m of members) {
            if (m.trainer_name === trainerName) {
              clientRows.push({
                ...m,
                gym_id: gymId,
                gym_name_display: app.gym_name,
                member_id_hint: m.id,
              });
            }
          }
        })
      );

      setClients(clientRows);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelectClient(client: ClientRow) {
    setSelectedClient(client);
    setBiometrics([]);
    setBioError(null);
    setBioLoading(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await biometricsApi.memberHistory(client.member_id_hint, token);
    setBioLoading(false);
    if (error) { setBioError(flattenErrors(error)); return; }
    setBiometrics(data ?? []);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">My Clients</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Members actively assigned to you across your approved gyms.
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading clients…
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
          <User className="w-8 h-8 text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">
            No assigned clients found. You need to be approved at a gym and have members assigned by the owner.
          </p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">

          {/* Client list panel */}
          <div className="w-72 shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {clients.length} Client{clients.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ul className="divide-y divide-zinc-800/60">
              {clients.map((c) => {
                const isSelected = selectedClient?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className={[
                        "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors border-l-2",
                        isSelected
                          ? "bg-red-700/10 border-red-600"
                          : "hover:bg-zinc-800/50 border-transparent",
                      ].join(" ")}
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? "text-red-400" : "text-zinc-200"}`}>
                          {c.member_name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">{c.gym_name_display}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail panel */}
          <div className="flex-1 min-w-0">
            {!selectedClient ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-16 text-center">
                <p className="text-sm text-zinc-500">Select a client to view their biometric history.</p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-200">{selectedClient.member_name}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {selectedClient.gym_name_display} · {selectedClient.tier_name} · {selectedClient.days_remaining} days remaining
                  </p>
                </div>

                {bioLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-8">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading biometrics…
                  </div>
                ) : bioError ? (
                  <div className="flex items-start gap-2.5 m-6 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{bioError}</span>
                  </div>
                ) : biometrics.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-zinc-500 text-center">No biometric readings found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {["Date", "Weight", "Height", "Body Fat %", "Muscle", "BMI", "Category", "Waist", "HR", "Notes"].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {biometrics.map((b, i) => (
                          <tr
                            key={b.id}
                            className={[
                              "border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors",
                              i % 2 === 0 ? "bg-zinc-900/50" : "bg-zinc-900",
                            ].join(" ")}
                          >
                            <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{new Date(b.recorded_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-zinc-200 font-medium">{b.weight ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-400">{b.height ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-400">{b.body_fat_pct ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-400">{b.muscle_mass ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-400">{b.bmi ?? "—"}</td>
                            <td className="px-4 py-3">
                              {b.bmi_category
                                ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">{b.bmi_category}</span>
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{b.waist_cm ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-400">{b.resting_hr ?? "—"}</td>
                            <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{b.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
