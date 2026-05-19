"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Search, MapPin, Users, Tag, AlertCircle, Loader2,
  CheckCircle2, X, CreditCard, Building2,
} from "lucide-react";
import {
  memberApi, memberPaymentApi,
  GymDiscovery, SubscriptionTier, OrderCreateResponse,
} from "@/utils/api";

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

export default function GymExplorerPage() {
  const router = useRouter();
  const [gyms, setGyms]     = useState<GymDiscovery[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [enrollingGym, setEnrollingGym]   = useState<GymDiscovery | null>(null);
  const [selectedTier, setSelectedTier]   = useState<SubscriptionTier | null>(null);
  const [enrollError, setEnrollError]     = useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const [payingEnrollmentId, setPayingEnrollmentId] = useState<string | null>(null);
  const [payError, setPayError]   = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  async function fetchGyms(q: string) {
    setLoading(true); setError(null);
    const token = getToken();
    const { data, error: err } = await memberApi.discoverGyms(q, token);
    setLoading(false);
    if (err) { setError((err.detail as string) ?? "Failed to load gyms."); }
    else { setGyms(data ?? []); }
  }

  useEffect(() => { fetchGyms(""); }, []);

  function handleSearch(e: FormEvent) { e.preventDefault(); fetchGyms(search); }

  async function handleEnroll() {
    if (!enrollingGym || !selectedTier) return;
    setEnrollLoading(true); setEnrollError(null);
    const token = getToken();
    const { data, error: err } = await memberApi.enroll(
      { gym_id: enrollingGym.id, tier_id: selectedTier.id }, token
    );
    if (err) { setEnrollError(Object.values(err).flat().join(" ")); setEnrollLoading(false); return; }
    if (data) { setPayingEnrollmentId(data.id); setEnrollingGym(null); setSelectedTier(null); }
    setEnrollLoading(false);
  }

  async function handlePayNow(enrollmentId: string) {
    setPayError(null); setPayLoading(true);
    const token = getToken();
    const { data: order, error: orderErr } = await memberPaymentApi.createOrder(enrollmentId, token);
    if (orderErr || !order) {
      setPayError((orderErr?.detail as string) ?? "Failed to create payment order.");
      setPayLoading(false); return;
    }
    const loaded = await loadRazorpayScript();
    setPayLoading(false);
    if (!loaded || !window.Razorpay) { setPayError("Failed to load Razorpay checkout."); return; }
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
        if (verifyErr) { setPayError((verifyErr.detail as string) ?? "Payment verification failed."); return; }
        router.push("/dashboard/member/billing");
      },
    });
    rzp.open();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Gym Explorer</h1>
        <p className="text-sm text-zinc-400 mt-1">Discover and join gyms near you.</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" placeholder="Search by name or location…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 transition-all" />
        </div>
        <button type="submit"
          className="flex items-center gap-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
          <Search className="w-4 h-4" /> Search
        </button>
      </form>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {payError && (
        <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{payError}</span>
        </div>
      )}

      {/* Pending payment CTA */}
      {payingEnrollmentId && (
        <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/60 rounded-xl px-4 py-4">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="flex-1 text-sm text-amber-200">
            Enrollment created. Complete your payment to activate membership.
          </p>
          <button onClick={() => handlePayNow(payingEnrollmentId)} disabled={payLoading}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
            {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {payLoading ? "Processing…" : "Pay Now"}
          </button>
        </div>
      )}

      {/* Enroll modal overlay */}
      {enrollingGym && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-50">Enroll at {enrollingGym.name}</h2>
                <p className="text-sm text-zinc-400 mt-0.5">Select a subscription tier to continue.</p>
              </div>
              <button onClick={() => { setEnrollingGym(null); setSelectedTier(null); setEnrollError(null); }}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {enrollingGym.tiers.map((tier) => (
                <label key={tier.id}
                  className={[
                    "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                    selectedTier?.id === tier.id
                      ? "border-sky-600 bg-sky-950/30"
                      : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/40",
                  ].join(" ")}>
                  <input type="radio" name="tier" value={tier.id}
                    checked={selectedTier?.id === tier.id}
                    onChange={() => setSelectedTier(tier)}
                    className="accent-sky-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-100">{tier.name}</p>
                    {tier.description && <p className="text-xs text-zinc-500 mt-0.5">{tier.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-sky-400">₹{tier.price}</p>
                    <p className="text-xs text-zinc-500">{tier.duration_type}</p>
                  </div>
                </label>
              ))}
            </div>

            {enrollError && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-900/60 rounded-lg px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{enrollError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleEnroll} disabled={!selectedTier || enrollLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
                {enrollLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {enrollLoading ? "Enrolling…" : "Confirm Enrollment"}
              </button>
              <button onClick={() => { setEnrollingGym(null); setSelectedTier(null); setEnrollError(null); }}
                className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gym cards grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading gyms…
        </div>
      ) : gyms.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
          <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">No gyms found. Try a different search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gyms.map((gym) => (
            <div key={gym.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-zinc-100">{gym.name}</h3>
                  {gym.is_enrolled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Enrolled
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{gym.location}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{gym.trainer_count} trainers</span>
                  {gym.facilities && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{gym.facilities}</span>}
                </div>
              </div>

              <div className="px-5 py-3 flex-1 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Tiers</p>
                {gym.tiers.length === 0 ? (
                  <p className="text-xs text-zinc-600">No tiers available.</p>
                ) : (
                  gym.tiers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{t.name}</span>
                      <span className="text-sky-400 font-semibold">₹{t.price} / {t.duration_type}</span>
                    </div>
                  ))
                )}
              </div>

              {!gym.is_enrolled && gym.tiers.length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-800">
                  <button onClick={() => setEnrollingGym(gym)}
                    className="w-full flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
                    Enroll
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
