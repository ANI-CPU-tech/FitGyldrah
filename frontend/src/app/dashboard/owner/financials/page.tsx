"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { gymApi, paymentApi, Gym, ConnectBankResponse } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function FinancialsPage() {
  const searchParams = useSearchParams();
  const preselectedGymId = searchParams.get("gym") ?? "";

  // ── Gym list ───────────────────────────────────────────────────────────────
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [gymId, setGymId] = useState(preselectedGymId);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ConnectBankResponse | null>(null);

  // ── Load owner's gyms for the dropdown ────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";
    gymApi.mine(token).then(({ data }) => {
      setGymsLoading(false);
      if (data) {
        setGyms(data);
        // Auto-select the first gym if none pre-selected
        if (!gymId && data.length > 0) {
          setGymId(data[0].id);
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive selected gym object ─────────────────────────────────────────────
  const selectedGym = gyms.find((g) => g.id === gymId) ?? null;

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error: apiError } = await paymentApi.connectBank(
      {
        gym_id: gymId,
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
      },
      token
    );

    setSubmitting(false);

    if (apiError) {
      setError(flattenErrors(apiError));
      return;
    }

    setSuccess(data);
  }

  return (
    <div>
      <h1>Financials — Connect Bank Account</h1>
      <p>
        Link your gym&apos;s bank account to the FitGyldrah payment marketplace.
        This must be done once before your gym can accept member payments.
      </p>

      {gymsLoading && <p>Loading your gyms…</p>}

      {/* ── Success state: hide form, show confirmation ── */}
      {success ? (
        <div role="status">
          <p>{success.detail}</p>
          <p>
            Linked account: <strong>{success.linked_account_hint}</strong>
          </p>
          <p>Payment ready: {success.is_payment_ready ? "Yes" : "No"}</p>
        </div>
      ) : (
        /* ── Already linked: show hint, no form ── */
        selectedGym?.is_payment_ready ? (
          <div role="status">
            <p>
              This gym already has a linked bank account. No action needed.
            </p>
          </div>
        ) : (
          /* ── Connect bank form ── */
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="gymId">Gym</label>
              <select
                id="gymId"
                value={gymId}
                onChange={(e) => setGymId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a gym
                </option>
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="accountNumber">Account Number</label>
              <input
                id="accountNumber"
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
                placeholder="9–18 digit bank account number"
              />
            </div>

            <div>
              <label htmlFor="ifscCode">IFSC Code</label>
              <input
                id="ifscCode"
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                required
                placeholder="e.g. SBIN0001234"
                maxLength={11}
              />
            </div>

            <button type="submit" disabled={submitting || !gymId}>
              {submitting ? "Connecting…" : "Connect Bank Account"}
            </button>
          </form>
        )
      )}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
