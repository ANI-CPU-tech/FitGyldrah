"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, CheckCircle2, Loader2, CreditCard,
  RefreshCw, XCircle, Building2,
} from "lucide-react";
import { memberApi, memberPaymentApi, MyEnrollment, Transaction, OrderCreateResponse } from "@/utils/api";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function EnrollmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:          "bg-emerald-950/60 text-emerald-400 border-emerald-900/40",
    PENDING_PAYMENT: "bg-amber-950/60  text-amber-400  border-amber-900/40",
    EXPIRED:         "bg-zinc-800      text-zinc-400   border-zinc-700",
    CANCELLED:       "bg-red-950/60    text-red-400    border-red-900/40",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function TxnStatusBadge({ status }: { status: string }) {
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

export default function BillingPage() {
  const router = useRouter();
  const [enrollments, setEnrollments]   = useState<MyEnrollment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionError, setActionError]   = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyId, setBusyId]             = useState<string | null>(null);

  async function load() {
    const token = getToken();
    const [enrollRes, txnRes] = await Promise.all([
      memberApi.enrollments("", token),
      memberPaymentApi.history(token),
    ]);
    setEnrollments(enrollRes.data ?? []);
    setTransactions(txnRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id: string) {
    setActionError(null); setActionSuccess(null); setBusyId(id);
    const token = getToken();
    const { data, error: err } = await memberApi.cancelEnrollment(id, token);
    setBusyId(null);
    if (err) { setActionError(Object.values(err).flat().join(" ")); return; }
    setActionSuccess(data?.detail ?? "Enrollment cancelled.");
    await load();
  }

  async function handleRenew(id: string) {
    setActionError(null); setActionSuccess(null); setBusyId(id);
    const token = getToken();
    const { data, error: err } = await memberApi.renewEnrollment(id, token);
    setBusyId(null);
    if (err) { setActionError(Object.values(err).flat().join(" ")); return; }
    if (data) await handlePayNow(data.id);
  }

  async function handlePayNow(enrollmentId: string) {
    setActionError(null); setBusyId(enrollmentId);
    const token = getToken();
    const { data: order, error: orderErr } = await memberPaymentApi.createOrder(enrollmentId, token);
    setBusyId(null);
    if (orderErr || !order) { setActionError((orderErr?.detail as string) ?? "Failed to create order."); return; }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) { setActionError("Failed to load Razorpay checkout."); return; }
    openRazorpay(order, token);
  }

  function openRazorpay(order: OrderCreateResponse, token: string) {
    const rzp = new window.Razorpay({
      key: order.razorpay_key_id, amount: order.amount, currency: order.currency,
      name: "FitGyldrah", description: order.description,
      order_id: order.razorpay_order_id, prefill: order.prefill,
      handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
        const { error: verifyErr } = await memberPaymentApi.verify(
          { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature },
          token
        );
        if (verifyErr) { setActionError((verifyErr.detail as string) ?? "Payment verification failed."); return; }
        setActionSuccess("Payment successful. Membership activated.");
        router.refresh();
        await load();
      },
    });
    rzp.open();
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 py-12">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading billing…
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Billing &amp; Memberships</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your gym memberships and payment history.</p>
      </div>

      {actionError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-xl px-4 py-3.5 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{actionSuccess}</span>
        </div>
      )}

      {/* Enrollments */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">My Enrollments</h2>
          <span className="text-xs text-zinc-500">{enrollments.length}</span>
        </div>

        {enrollments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Building2 className="w-7 h-7 text-zinc-700 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No enrollments yet.</p>
            <a href="/dashboard/member/explore" className="inline-block mt-2 text-xs text-sky-500 hover:text-sky-400 transition-colors">
              Explore gyms
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Gym", "Tier", "Price", "Trainer", "Start", "End", "Days Left", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{e.gym_name}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{e.tier_name} <span className="text-zinc-600 text-xs">({e.tier_duration})</span></td>
                    <td className="px-5 py-3.5 text-zinc-300 font-medium">₹{e.price_paid}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{e.trainer_name ?? <span className="text-zinc-600">Unassigned</span>}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{e.start_date}</td>
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">{e.end_date}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium ${e.days_remaining <= 7 ? "text-red-400" : e.days_remaining <= 30 ? "text-amber-400" : "text-zinc-400"}`}>
                        {e.days_remaining}d
                      </span>
                    </td>
                    <td className="px-5 py-3.5"><EnrollmentStatusBadge status={e.status} /></td>
                    <td className="px-5 py-3.5">
                      {e.status === "PENDING_PAYMENT" && (
                        <button onClick={() => handlePayNow(e.id)} disabled={busyId === e.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors">
                          {busyId === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                          Pay Now
                        </button>
                      )}
                      {e.status === "ACTIVE" && (
                        <button onClick={() => handleCancel(e.id)} disabled={busyId === e.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/60 text-red-400 border border-red-900/40 hover:bg-red-900/40 disabled:opacity-50 transition-colors">
                          {busyId === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Cancel
                        </button>
                      )}
                      {(e.status === "EXPIRED" || e.status === "CANCELLED") && (
                        <button onClick={() => handleRenew(e.id)} disabled={busyId === e.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-950/60 text-sky-400 border border-sky-900/40 hover:bg-sky-900/40 disabled:opacity-50 transition-colors">
                          {busyId === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Renew
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Payment History</h2>
          <span className="text-xs text-zinc-500">{transactions.length} transactions</span>
        </div>

        {transactions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Date", "Gym", "Tier", "Amount", "Status", "Order ID", "Payment ID"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap text-xs">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{t.gym_name}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{t.tier_name}</td>
                    <td className="px-5 py-3.5 text-zinc-300 font-semibold">₹{t.amount} <span className="text-zinc-600 text-xs font-normal">{t.currency}</span></td>
                    <td className="px-5 py-3.5"><TxnStatusBadge status={t.status} /></td>
                    <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">{t.razorpay_order_id || "—"}</td>
                    <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">{t.razorpay_payment_id || "—"}</td>
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
