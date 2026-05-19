"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { gymApi, paymentApi, Gym, ConnectBankResponse } from "@/utils/api";

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

function FinancialsContent() {
  const searchParams     = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  const [gyms, setGyms]           = useState<Gym[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymId, setGymId]         = useState(preselectedGymId);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<ConnectBankResponse | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data }) => {
      setGymsLoading(false);
      if (data) {
        setGyms(data);
        if (!gymId && data.length > 0) setGymId(data[0].id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGym = gyms.find((g) => g.id === gymId) ?? null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";
    const { data, error: apiError } = await paymentApi.connectBank(
      { gym_id: gymId, account_number: accountNumber.trim(), ifsc_code: ifscCode.trim().toUpperCase() },
      token
    );
    setSubmitting(false);
    if (apiError) { setError(flattenErrors(apiError)); return; }
    setSuccess(data);
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Financials</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Link your gym&apos;s bank account to the FitGyldrah payment marketplace.
          This must be done once before your gym can accept member payments.
        </p>
      </div>

      {gymsLoading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your gyms…
        </div>
      )}

      {/* Success card */}
      {success ? (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-900/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-base font-semibold text-emerald-300">Bank Account Connected</h2>
          </div>
          <p className="text-sm text-zinc-300">{success.detail}</p>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Linked account</span>
              <span className="font-mono text-zinc-200 font-medium">{success.linked_account_hint}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Payment ready</span>
              <span className={success.is_payment_ready ? "text-emerald-400 font-medium" : "text-red-400"}>
                {success.is_payment_ready ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      ) : selectedGym?.is_payment_ready ? (
        /* Already linked */
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-6 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Already connected</p>
            <p className="text-sm text-zinc-400 mt-0.5">
              This gym already has a linked bank account. No action needed.
            </p>
          </div>
        </div>
      ) : (
        /* Connect bank form */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
              Connect Bank Account
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="gymId" className={labelCls}>Gym</label>
              <select id="gymId" value={gymId} onChange={(e) => setGymId(e.target.value)}
                required className={`${inputCls} appearance-none`}>
                <option value="" disabled>Select a gym</option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="accountNumber" className={labelCls}>Account Number</label>
              <input id="accountNumber" type="text" value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)} required
                placeholder="9–18 digit bank account number" className={inputCls} />
            </div>

            <div>
              <label htmlFor="ifscCode" className={labelCls}>IFSC Code</label>
              <input id="ifscCode" type="text" value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)} required
                placeholder="e.g. SBIN0001234" maxLength={11}
                className={`${inputCls} uppercase`} />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting || !gymId}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
              {submitting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LinkIcon className="w-4 h-4" />}
              {submitting ? "Connecting…" : "Connect Bank Account"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function FinancialsPage() {
  return (
    <Suspense>
      <FinancialsContent />
    </Suspense>
  );
}
