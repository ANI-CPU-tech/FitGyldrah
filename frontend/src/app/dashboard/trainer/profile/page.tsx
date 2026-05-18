"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { trainerApi, gymApi, TrainerProfile, GymApplication, Gym } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

export default function TrainerProfilePage() {
  // ── Existing profile ───────────────────────────────────────────────────────
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);

  // ── Profile form fields ────────────────────────────────────────────────────
  const [certifications, setCertifications] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  // ── Profile form UI state ──────────────────────────────────────────────────
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // ── Application form ───────────────────────────────────────────────────────
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [applyGymId, setApplyGymId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // ── Application history ────────────────────────────────────────────────────
  const [applications, setApplications] = useState<GymApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);

  // ── Load profile + applications + public gym list on mount ─────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";

    // Load own profile
    trainerApi.getProfile(token).then(({ data }) => {
      setProfileLoading(false);
      if (data) {
        setProfileExists(true);
        setProfile(data);
        // Pre-fill form with existing values
        setCertifications(data.certifications);
        setYearsExperience(String(data.years_experience));
        setSpecialty(data.specialty);
        setBio(data.bio);
        setIsAvailable(data.is_available);
      }
    });

    // Load application history
    trainerApi.myApplications(token).then(({ data }) => {
      setAppsLoading(false);
      setApplications(data ?? []);
    });

    // Load all public gyms for the apply dropdown
    // We use the public gym list endpoint (no auth required)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`)
      .then((r) => r.json())
      .then((data: Gym[]) => setAllGyms(Array.isArray(data) ? data : []))
      .catch(() => {/* silently ignore */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile submit ─────────────────────────────────────────────────────────
  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setProfileSubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";
    const fd = new FormData();
    fd.append("certifications", certifications);
    fd.append("years_experience", yearsExperience);
    fd.append("specialty", specialty);
    fd.append("bio", bio);
    fd.append("is_available", String(isAvailable));
    if (cvFile) fd.append("cv_file", cvFile);
    if (profilePicture) fd.append("profile_picture", profilePicture);

    const { data, error } = profileExists
      ? await trainerApi.updateProfile(fd, token)
      : await trainerApi.setupProfile(fd, token);

    setProfileSubmitting(false);

    if (error) {
      setProfileError(flattenErrors(error));
      return;
    }

    if (data) {
      setProfile(data);
      setProfileExists(true);
      setProfileSuccess(
        profileExists ? "Profile updated successfully." : "Profile created successfully."
      );
    }
  }

  // ── Apply to gym ───────────────────────────────────────────────────────────
  async function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplyError(null);
    setApplySuccess(null);
    setApplySubmitting(true);

    const token = localStorage.getItem("access_token") ?? "";
    const { data, error } = await trainerApi.apply(
      { gym: applyGymId, cover_letter: coverLetter },
      token
    );

    setApplySubmitting(false);

    if (error) {
      setApplyError(flattenErrors(error));
      return;
    }

    if (data) {
      setApplications((prev) => [data, ...prev]);
      setApplyGymId("");
      setCoverLetter("");
      setApplySuccess("Application submitted successfully.");
    }
  }

  return (
    <div>
      <h1>My Profile &amp; Gyms</h1>

      {/* ── Profile form ── */}
      <section>
        <h2>{profileExists ? "Update Profile" : "Set Up Trainer Profile"}</h2>
        {profileLoading && <p>Loading profile…</p>}

        {!profileLoading && (
          <form onSubmit={handleProfileSubmit}>
            <div>
              <label htmlFor="certifications">Certifications</label>
              <input
                id="certifications"
                type="text"
                value={certifications}
                onChange={(e) => setCertifications(e.target.value)}
                placeholder="e.g. NASM-CPT, CrossFit L2"
              />
            </div>

            <div>
              <label htmlFor="yearsExperience">Years of Experience</label>
              <input
                id="yearsExperience"
                type="number"
                min="0"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="specialty">Specialty</label>
              <input
                id="specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Strength & Conditioning"
              />
            </div>

            <div>
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <label htmlFor="isAvailable">Available for new clients</label>
              <input
                id="isAvailable"
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
              />
            </div>

            <div>
              <label htmlFor="cvFile">
                CV (PDF/DOC/DOCX, max 5 MB)
                {profile?.cv_file && (
                  <span>
                    {" "}— current:{" "}
                    <a href={profile.cv_file} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </span>
                )}
              </label>
              <input
                id="cvFile"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setCvFile(e.target.files?.[0] ?? null)
                }
              />
            </div>

            <div>
              <label htmlFor="profilePicture">
                Profile Picture (JPG/PNG/WEBP, max 2 MB)
                {profile?.profile_picture && (
                  <span>
                    {" "}— current:{" "}
                    <a
                      href={profile.profile_picture}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </span>
                )}
              </label>
              <input
                id="profilePicture"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setProfilePicture(e.target.files?.[0] ?? null)
                }
              />
            </div>

            {profileError && <p role="alert">{profileError}</p>}
            {profileSuccess && <p role="status">{profileSuccess}</p>}

            <button type="submit" disabled={profileSubmitting}>
              {profileSubmitting
                ? "Saving…"
                : profileExists
                ? "Update Profile"
                : "Create Profile"}
            </button>
          </form>
        )}
      </section>

      {/* ── Apply to gym ── */}
      <section>
        <h2>Apply to a Gym</h2>
        {!profileExists && (
          <p>You must create your trainer profile before applying to a gym.</p>
        )}

        {profileExists && (
          <form onSubmit={handleApply}>
            <div>
              <label htmlFor="applyGymId">Select Gym</label>
              <select
                id="applyGymId"
                value={applyGymId}
                onChange={(e) => setApplyGymId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Choose a gym
                </option>
                {allGyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="coverLetter">Cover Letter (optional)</label>
              <textarea
                id="coverLetter"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={4}
                placeholder="Introduce yourself to the gym owner…"
              />
            </div>

            {applyError && <p role="alert">{applyError}</p>}
            {applySuccess && <p role="status">{applySuccess}</p>}

            <button type="submit" disabled={applySubmitting || !applyGymId}>
              {applySubmitting ? "Submitting…" : "Submit Application"}
            </button>
          </form>
        )}
      </section>

      {/* ── Application history ── */}
      <section>
        <h2>My Applications</h2>
        {appsLoading && <p>Loading…</p>}
        {!appsLoading && applications.length === 0 && (
          <p>No applications yet.</p>
        )}
        {applications.length > 0 && (
          <table border={1}>
            <thead>
              <tr>
                <th>Gym</th>
                <th>Status</th>
                <th>Cover Letter</th>
                <th>Owner Note</th>
                <th>Applied</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.gym_name}</td>
                  <td>{app.status}</td>
                  <td>{app.cover_letter || "—"}</td>
                  <td>{app.owner_note || "—"}</td>
                  <td>{new Date(app.applied_at).toLocaleDateString()}</td>
                  <td>
                    {app.reviewed_at
                      ? new Date(app.reviewed_at).toLocaleDateString()
                      : "—"}
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
