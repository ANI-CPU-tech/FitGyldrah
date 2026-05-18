"use client";

import { useEffect, useState, FormEvent } from "react";
import { gymApi, Gym, SubscriptionTier } from "@/utils/api";

function flattenErrors(errors: Record<string, string | string[]>): string {
  return Object.entries(errors)
    .map(([field, messages]) => {
      const msgs = Array.isArray(messages) ? messages.join(" ") : messages;
      return field === "detail" ? msgs : `${field}: ${msgs}`;
    })
    .join(" | ");
}

export default function FacilitiesPage() {
  // ── Gym list ───────────────────────────────────────────────────────────────
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymsError, setGymsError] = useState<string | null>(null);

  // ── Create gym form ────────────────────────────────────────────────────────
  const [gymName, setGymName] = useState("");
  const [gymLocation, setGymLocation] = useState("");
  const [gymFacilities, setGymFacilities] = useState("");
  // operating_hours stored as a raw JSON string for simplicity
  const [gymHours, setGymHours] = useState('{"Mon-Fri": "6am-10pm", "Sat-Sun": "7am-8pm"}');
  const [gymLogoUrl, setGymLogoUrl] = useState("");
  const [gymSubmitting, setGymSubmitting] = useState(false);
  const [gymFormError, setGymFormError] = useState<string | null>(null);

  // ── Tier form ──────────────────────────────────────────────────────────────
  // Which gym the tier form is open for
  const [tierGymId, setTierGymId] = useState<string | null>(null);
  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierDuration, setTierDuration] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [tierDescription, setTierDescription] = useState("");
  const [tierSubmitting, setTierSubmitting] = useState(false);
  const [tierFormError, setTierFormError] = useState<string | null>(null);

  // ── Load gyms ──────────────────────────────────────────────────────────────
  function loadGyms() {
    const token = localStorage.getItem("access_token") ?? "";
    setGymsLoading(true);
    gymApi.mine(token).then(({ data, error: apiError }) => {
      setGymsLoading(false);
      if (apiError) {
        setGymsError(flattenErrors(apiError));
        return;
      }
      setGyms(data ?? []);
    });
  }

  useEffect(() => {
    loadGyms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create gym ─────────────────────────────────────────────────────────────
  async function handleCreateGym(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGymFormError(null);

    let parsedHours: Record<string, string> = {};
    try {
      parsedHours = JSON.parse(gymHours);
    } catch {
      setGymFormError("Operating hours must be valid JSON, e.g. {\"Mon-Fri\": \"6am-10pm\"}");
      return;
    }

    setGymSubmitting(true);
    const token = localStorage.getItem("access_token") ?? "";

    const { error: apiError } = await gymApi.create(
      {
        name: gymName.trim(),
        location: gymLocation.trim(),
        facilities: gymFacilities.trim(),
        operating_hours: parsedHours,
        logo_url: gymLogoUrl.trim() || undefined,
      },
      token
    );

    setGymSubmitting(false);

    if (apiError) {
      setGymFormError(flattenErrors(apiError));
      return;
    }

    // Reset form and reload list
    setGymName("");
    setGymLocation("");
    setGymFacilities("");
    setGymHours('{"Mon-Fri": "6am-10pm", "Sat-Sun": "7am-8pm"}');
    setGymLogoUrl("");
    loadGyms();
  }

  // ── Create tier ────────────────────────────────────────────────────────────
  async function handleCreateTier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tierGymId) return;
    setTierFormError(null);
    setTierSubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";

    const { data: newTier, error: apiError } = await gymApi.createTier(
      tierGymId,
      {
        name: tierName.trim(),
        price: tierPrice,
        duration_type: tierDuration,
        description: tierDescription.trim(),
      },
      token
    );

    setTierSubmitting(false);

    if (apiError) {
      setTierFormError(flattenErrors(apiError));
      return;
    }

    // Optimistically append the new tier to the correct gym in state
    if (newTier) {
      setGyms((prev) =>
        prev.map((g) =>
          g.id === tierGymId ? { ...g, tiers: [...g.tiers, newTier] } : g
        )
      );
    }

    // Reset tier form
    setTierName("");
    setTierPrice("");
    setTierDuration("MONTHLY");
    setTierDescription("");
    setTierGymId(null);
  }

  return (
    <div>
      <h1>My Facilities</h1>

      {/* ── Gym list ── */}
      <section>
        <h2>Your Gyms</h2>

        {gymsLoading && <p>Loading…</p>}
        {gymsError && <p role="alert">{gymsError}</p>}

        {!gymsLoading && gyms.length === 0 && (
          <p>No gyms yet. Register one below.</p>
        )}

        {gyms.map((gym) => (
          <div key={gym.id}>
            <h3>{gym.name}</h3>
            <p>
              <strong>Location:</strong> {gym.location}
            </p>
            <p>
              <strong>Facilities:</strong> {gym.facilities || "—"}
            </p>
            <p>
              <strong>Payment ready:</strong>{" "}
              {gym.is_payment_ready ? "Yes" : "No"}
            </p>

            {/* Tier list */}
            <h4>Subscription Tiers</h4>
            {gym.tiers.length === 0 ? (
              <p>No tiers yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price (₹)</th>
                    <th>Duration</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {gym.tiers.map((tier: SubscriptionTier) => (
                    <tr key={tier.id}>
                      <td>{tier.name}</td>
                      <td>{tier.price}</td>
                      <td>{tier.duration_type}</td>
                      <td>{tier.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Toggle tier form for this gym */}
            {tierGymId === gym.id ? (
              <form onSubmit={handleCreateTier}>
                <h4>Add Subscription Tier to {gym.name}</h4>

                <div>
                  <label htmlFor={`tier-name-${gym.id}`}>Tier Name</label>
                  <input
                    id={`tier-name-${gym.id}`}
                    type="text"
                    value={tierName}
                    onChange={(e) => setTierName(e.target.value)}
                    required
                    placeholder="e.g. Basic, Premium"
                  />
                </div>

                <div>
                  <label htmlFor={`tier-price-${gym.id}`}>Price (₹)</label>
                  <input
                    id={`tier-price-${gym.id}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor={`tier-duration-${gym.id}`}>Duration</label>
                  <select
                    id={`tier-duration-${gym.id}`}
                    value={tierDuration}
                    onChange={(e) =>
                      setTierDuration(e.target.value as "MONTHLY" | "YEARLY")
                    }
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`tier-desc-${gym.id}`}>
                    Description (optional)
                  </label>
                  <input
                    id={`tier-desc-${gym.id}`}
                    type="text"
                    value={tierDescription}
                    onChange={(e) => setTierDescription(e.target.value)}
                  />
                </div>

                {tierFormError && <p role="alert">{tierFormError}</p>}

                <button type="submit" disabled={tierSubmitting}>
                  {tierSubmitting ? "Adding…" : "Add Tier"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTierGymId(null);
                    setTierFormError(null);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setTierGymId(gym.id)}>
                + Add Tier
              </button>
            )}
          </div>
        ))}
      </section>

      {/* ── Register new gym form ── */}
      <section>
        <h2>Register a New Gym</h2>

        <form onSubmit={handleCreateGym}>
          <div>
            <label htmlFor="gymName">Gym Name</label>
            <input
              id="gymName"
              type="text"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              required
              placeholder="At least 3 characters"
            />
          </div>

          <div>
            <label htmlFor="gymLocation">Location</label>
            <input
              id="gymLocation"
              type="text"
              value={gymLocation}
              onChange={(e) => setGymLocation(e.target.value)}
              required
              placeholder="Full address"
            />
          </div>

          <div>
            <label htmlFor="gymFacilities">Facilities</label>
            <input
              id="gymFacilities"
              type="text"
              value={gymFacilities}
              onChange={(e) => setGymFacilities(e.target.value)}
              placeholder="e.g. Pool, Sauna, Free Weights"
            />
          </div>

          <div>
            <label htmlFor="gymHours">
              Operating Hours (JSON)
            </label>
            <input
              id="gymHours"
              type="text"
              value={gymHours}
              onChange={(e) => setGymHours(e.target.value)}
              required
              placeholder='{"Mon-Fri": "6am-10pm"}'
            />
          </div>

          <div>
            <label htmlFor="gymLogoUrl">Logo URL (optional)</label>
            <input
              id="gymLogoUrl"
              type="url"
              value={gymLogoUrl}
              onChange={(e) => setGymLogoUrl(e.target.value)}
            />
          </div>

          {gymFormError && <p role="alert">{gymFormError}</p>}

          <button type="submit" disabled={gymSubmitting}>
            {gymSubmitting ? "Registering…" : "Register Gym"}
          </button>
        </form>
      </section>
    </div>
  );
}
