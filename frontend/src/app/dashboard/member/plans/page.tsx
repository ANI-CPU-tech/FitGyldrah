"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Utensils, Dumbbell, Clock, Flame, ChevronRight } from "lucide-react";
import { memberPlanApi, FitnessPlan } from "@/utils/api";

function getToken(): string {
  return typeof window !== "undefined" ? (localStorage.getItem("access_token") ?? "") : "";
}

interface DietMeal { name: string; time?: string; calories?: number; items?: string[]; }
interface DietContent { meals?: DietMeal[]; daily_calories?: number; macros?: { protein?: number; carbs?: number; fat?: number }; }
interface WorkoutExercise { name: string; sets?: number; reps?: string; rest?: string; }
interface WorkoutDay { day: string; focus?: string; exercises?: WorkoutExercise[]; }
interface WorkoutContent { days?: WorkoutDay[]; }

function MacroBadge({ label, value, unit, color }: { label: string; value?: number; unit: string; color: string }) {
  if (value == null) return null;
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${color}`}>
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-base font-bold text-zinc-100 mt-0.5">
        {value}<span className="text-xs font-normal text-zinc-400 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

function SetRepBadge({ sets, reps }: { sets?: number; reps?: string }) {
  if (!sets && !reps) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-900/40 text-xs font-semibold text-sky-400">
      {sets && `${sets} Sets`}{sets && reps && " x "}{reps && `${reps} Reps`}
    </span>
  );
}

function DietPlanView({ plan }: { plan: FitnessPlan }) {
  const content = plan.content_json as unknown as DietContent;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-zinc-100">
          {plan.title} <span className="text-xs text-zinc-500 font-normal">v{plan.version}</span>
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Trainer: {plan.trainer_name} · Approved: {plan.approved_at ? new Date(plan.approved_at).toLocaleDateString() : "—"}
        </p>
      </div>

      {(content.daily_calories || content.macros) && (
        <div className="flex flex-wrap gap-2">
          {content.daily_calories && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-900/40">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">{content.daily_calories}</span>
              <span className="text-xs text-zinc-500">kcal/day</span>
            </div>
          )}
          <MacroBadge label="Protein" value={content.macros?.protein} unit="g" color="bg-sky-950/40 border-sky-900/40" />
          <MacroBadge label="Carbs"   value={content.macros?.carbs}   unit="g" color="bg-emerald-950/40 border-emerald-900/40" />
          <MacroBadge label="Fat"     value={content.macros?.fat}     unit="g" color="bg-red-950/40 border-red-900/40" />
        </div>
      )}

      {content.meals && content.meals.length > 0 && (
        <div className="space-y-2">
          {content.meals.map((meal, i) => (
            <div key={i} className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-zinc-200">{meal.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {meal.time && (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />{meal.time}
                    </span>
                  )}
                  {meal.calories && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-900/40">
                      {meal.calories} kcal
                    </span>
                  )}
                </div>
              </div>
              {meal.items && meal.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {meal.items.map((item, j) => (
                    <span key={j} className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {plan.notes && (
        <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">Notes: {plan.notes}</p>
      )}
    </div>
  );
}

function WorkoutPlanView({ plan }: { plan: FitnessPlan }) {
  const content = plan.content_json as unknown as WorkoutContent;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-zinc-100">
          {plan.title} <span className="text-xs text-zinc-500 font-normal">v{plan.version}</span>
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Trainer: {plan.trainer_name} · Approved: {plan.approved_at ? new Date(plan.approved_at).toLocaleDateString() : "—"}
        </p>
      </div>

      {content.days && content.days.map((day, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">{day.day}</span>
            {day.focus && <span className="text-xs text-zinc-500">— {day.focus}</span>}
          </div>
          {day.exercises && day.exercises.length > 0 && (
            <div className="space-y-1.5">
              {day.exercises.map((ex, j) => (
                <div key={j} className="flex items-center justify-between gap-3 bg-zinc-800/40 border border-zinc-700/50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span className="text-sm text-zinc-200">{ex.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SetRepBadge sets={ex.sets} reps={ex.reps} />
                    {ex.rest && <span className="text-xs text-zinc-500">{ex.rest} rest</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {plan.notes && (
        <p className="text-xs text-zinc-500 italic border-t border-zinc-800 pt-3">Notes: {plan.notes}</p>
      )}
    </div>
  );
}

function EmptyPanel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-8 h-8 text-zinc-700 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-xs text-zinc-600 mt-1">Ask your trainer to create one.</p>
    </div>
  );
}

export default function TrainingPlansPage() {
  const [plans, setPlans]     = useState<FitnessPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    memberPlanApi.active(token).then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError((err.detail as string) ?? "Failed to load plans.");
      else setPlans(data ?? []);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 py-12">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
    </div>
  );

  if (error) return (
    <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3.5 text-sm text-red-400 max-w-lg">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
    </div>
  );

  const dietPlan    = plans.find((p) => p.plan_type === "DIET");
  const workoutPlan = plans.find((p) => p.plan_type === "WORKOUT");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">My Training Plans</h1>
        <p className="text-sm text-zinc-400 mt-1">Your active diet and workout regimens from your trainer.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
            <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-900/40">
              <Utensils className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Diet Plan</h2>
          </div>
          <div className="p-5">
            {dietPlan ? <DietPlanView plan={dietPlan} /> : <EmptyPanel icon={Utensils} label="No active diet plan." />}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
            <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-900/40">
              <Dumbbell className="w-4 h-4 text-sky-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Workout Plan</h2>
          </div>
          <div className="p-5">
            {workoutPlan ? <WorkoutPlanView plan={workoutPlan} /> : <EmptyPanel icon={Dumbbell} label="No active workout plan." />}
          </div>
        </div>
      </div>
    </div>
  );
}
