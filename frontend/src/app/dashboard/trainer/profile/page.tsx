"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Image,
  Send,
} from "lucide-react";
import { trainerApi, gymApi, TrainerProfile, GymApplication, Gym } from "@/utils/api";

function flattenErrors(e: Record<string, string | string[]>): string {
  return Object.entries(e)
    .map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(" ") : v;
      return k === "detail" ? msg : `${k}: ${msg}`;
    })
    .join(" | ");
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-600/20";

const labelCls = "block text-sm font-medium text-zinc-300 mb-1.5";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-950/60 text-emerald-400 border-emerald-900/40",
    PENDING:  "bg-amber-950/60  text-amber-400  border-amber-900/40",
    REJECTED: "bg-red-950/60    text-red-400    border-red-900/40",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

function FileUploadZone({
  id,
  label,
  accept,
  icon: Icon,
  currentUrl,
  fileName,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  icon: React.ElementType;
  currentUrl?: string | null;
  fileName?: string;
  onChange: (f: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <label
        htmlFor={id}
        className="flex flex-col items-center gap-2 border-2 border-dashed border-zinc-700 hover:border-red-700/60 rounded-xl px-4 py-6 cursor-pointer transition-colors group"
      >
        <Icon className="w-7 h-7 text-zinc-600 group-hover:text-red-500 transition-colors" strokeWidth={1.5} />
        <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
          {fileName ? (
            <span className="text-zinc-300 font-medium">{fileName}</span>
          ) : (
            <>Click to upload or drag &amp; drop</>
          )}
        </span>
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-red-500 hover:text-red-400 underline underline-offset-2"
          >
            View current file
          </a>
        )}
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

export default function TrainerProfilePage() {
  const [profile, setProfile]           = useState<TrainerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileExists, setProfileExists]   = useState(false);

  const [certifications, setCertifications] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [specialty, setSpecialty]       = useState("");
  const [bio, setBio]                   = useState("");
  const [isAvailable, setIsAvailable]   = useState(true);
  const [cvFile, setCvFile]             = useState<File | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError]   = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [allGyms, setAllGyms]           = useState<Gym[]>([]);
  const [applyGymId, setApplyGymId]     = useState("");
  const [coverLetter, setCoverLetter]   = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError]     = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const [applications, setApplications] = useState<GymApplication[]>([]);
  const [appsLoading, setAppsLoading]   = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token") ?? "";

    trainerApi.getProfile(token).then(({ data }) => {
      setProfileLoading(false);
      if (data) {
        setProfileExists(true);
        setProfile(data);
        setCertifications(data.certifications);
        setYearsExperience(String(data.years_experience));
        setSpecialty(data.specialty);
        setBio(data.bio);
        setIsAvailable(data.is_available);
      }
    });

    trainerApi.myApplications(token).then(({ data }) => {
      setAppsLoading(false);
      setApplications(data ?? []);
    });

    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/gyms/`)
      .then((r) => r.json())
      .then((data: Gym[]) => setAllGyms(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (error) { setProfileError(flattenErrors(error)); return; }
    if (data) {
      setProfile(data);
      setProfileExists(true);
      setProfileSuccess(profileExists ? "Profile updated." : "Profile created.");
    }
  }

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

    if (error) { setApplyError(flattenErrors(error)); return; }
    if (data) {
      setApplications((prev) => [data, ...prev]);
      setApplyGymId("");
      setCoverLetter("");
      setApplySuccess("Application submitted.");
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Profile &amp; Gyms</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your trainer profile and apply to gyms.
        </p>
      </div>

      {/* ── Profile form ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
          {profileExists ? "Update Profile" : "Set Up Trainer Profile"}
        </h2>

        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
          </div>
        ) : (
          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="certifications" className={labelCls}>Certifications</label>
                <input id="certifications" type="text" value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="e.g. NASM-CPT, CrossFit L2" className={inputCls} />
              </div>
              <div>
                <label htmlFor="yearsExperience" className={labelCls}>Years of Experience</label>
                <input id="yearsExperience" type="number" min="0" value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  required className={inputCls} />
              </div>
            </div>

            <div>
              <label htmlFor="specialty" className={labelCls}>Specialty</label>
              <input id="specialty" type="text" value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Strength & Conditioning" className={inputCls} />
            </div>

            <div>
              <label htmlFor="bio" className={labelCls}>Bio</label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)}
                rows={4} className={`${inputCls} resize-none`} />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isAvailable}
                onClick={() => setIsAvailable((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isAvailable ? "bg-emerald-600" : "bg-zinc-700"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isAvailable ? "translate-x-4" : "translate-x-1"}`} />
              </button>
              <label className="text-sm text-zinc-300 cursor-pointer select-none" onClick={() => setIsAvailable((v) => !v)}>
                Available for new clients
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FileUploadZone
                id="cvFile" label="CV (PDF/DOC/DOCX, max 5 MB)"
                accept=".pdf,.doc,.docx" icon={FileText}
                currentUrl={profile?.cv_file}
                fileName={cvFile?.name}
                onChange={setCvFile}
              />
              <FileUploadZone
                id="profilePicture" label="Profile Picture (JPG/PNG/WEBP, max 2 MB)"
                accept=".jpg,.jpeg,.png,.webp" icon={Image}
                currentUrl={profile?.profile_picture}
                fileName={profilePicture?.name}
                onChange={setProfilePicture}
              />
            </div>

            {profileError && (
              <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <button type="submit" disabled={profileSubmitting}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
              {profileSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {profileSubmitting ? "Saving…" : profileExists ? "Update Profile" : "Create Profile"}
            </button>
          </form>
        )}
      </div>

      {/* ── Apply to gym ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
          Apply to a Gym
        </h2>

        {!profileExists ? (
          <div className="flex items-start gap-2.5 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3.5 py-3 text-sm text-amber-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Create your trainer profile before applying to a gym.</span>
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-5">
            <div>
              <label htmlFor="applyGymId" className={labelCls}>Select Gym</label>
              <select id="applyGymId" value={applyGymId}
                onChange={(e) => setApplyGymId(e.target.value)} required
                className={`${inputCls} appearance-none`}>
                <option value="" disabled>Choose a gym</option>
                {allGyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} — {g.location}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="coverLetter" className={labelCls}>Cover Letter (optional)</label>
              <textarea id="coverLetter" value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={4} placeholder="Introduce yourself to the gym owner…"
                className={`${inputCls} resize-none`} />
            </div>

            {applyError && (
              <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900/60 rounded-lg px-3.5 py-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{applyError}</span>
              </div>
            )}
            {applySuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3.5 py-3 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{applySuccess}</span>
              </div>
            )}

            <button type="submit" disabled={applySubmitting || !applyGymId}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed">
              {applySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {applySubmitting ? "Submitting…" : "Submit Application"}
            </button>
          </form>
        )}
      </div>

      {/* ── Application history ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            My Applications
          </h2>
        </div>

        {appsLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 px-6 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : applications.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500 text-center">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Gym", "Status", "Cover Letter", "Owner Note", "Applied", "Reviewed"].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-3.5 text-zinc-200 font-medium whitespace-nowrap">{app.gym_name}</td>
                    <td className="px-6 py-3.5"><StatusPill status={app.status} /></td>
                    <td className="px-6 py-3.5 text-zinc-400 max-w-xs truncate">{app.cover_letter || "—"}</td>
                    <td className="px-6 py-3.5 text-zinc-400 max-w-xs truncate">{app.owner_note || "—"}</td>
                    <td className="px-6 py-3.5 text-zinc-400 whitespace-nowrap">{new Date(app.applied_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3.5 text-zinc-400 whitespace-nowrap">{app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : "—"}</td>
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
