"""
prompt_builder.py
─────────────────
Builds system + user prompts from member biodata for Groq.
Completely isolated — no Django ORM calls, no Celery, no HTTP.
This makes it easy to unit-test prompts without any infrastructure.
"""


# ── System prompts ─────────────────────────────────────────────────────────

DIET_SYSTEM_PROMPT = """You are FitGyldrah's expert AI nutritionist.
Generate a highly personalised, structured daily diet plan based on the
member's biometric data and goals.

STRICT RULES:
- Respond ONLY with a valid JSON object. No markdown, no preamble, no explanation.
- Follow the exact schema in the user message.
- All calorie and macro values must be realistic numbers — no placeholders.
- Account for the member's goal: fat loss = caloric deficit, muscle gain = surplus.
"""

WORKOUT_SYSTEM_PROMPT = """You are FitGyldrah's expert AI strength and conditioning coach.
Generate a personalised weekly workout plan based on the member's
biometric data, fitness goals, and trainer instructions.

STRICT RULES:
- Respond ONLY with a valid JSON object. No markdown, no preamble, no explanation.
- Follow the exact schema in the user message.
- All sets, reps, and rest periods must be realistic numbers.
- Structure the week logically (PPL, Upper/Lower, or Full Body).
- Vary exercises across days to avoid overtraining the same muscle groups.
"""

# ── JSON schema templates embedded in the user prompt ─────────────────────

DIET_SCHEMA = """
{
  "daily_calories": <integer>,
  "macros": {
    "protein_g": <integer>,
    "carbs_g":   <integer>,
    "fat_g":     <integer>
  },
  "meals": [
    {
      "name":     "<meal name>",
      "time":     "<HH:MM>",
      "calories": <integer>,
      "items":    ["<food item>", "<food item>"]
    }
  ],
  "hydration_ml": <integer>,
  "notes": "<nutritionist notes>"
}
"""

WORKOUT_SCHEMA = """
{
  "split_type":        "<e.g. PPL / Upper-Lower / Full Body>",
  "sessions_per_week": <integer>,
  "days": [
    {
      "day":     "<e.g. Monday>",
      "focus":   "<e.g. Push / Chest and Triceps>",
      "warmup":  "<brief warmup description>",
      "exercises": [
        {
          "name":  "<exercise name>",
          "sets":  <integer>,
          "reps":  "<e.g. 8-10>",
          "rest":  "<e.g. 90s>",
          "notes": "<form tip or variation>"
        }
      ],
      "cooldown": "<brief cooldown description>"
    }
  ],
  "general_notes": "<overall programme notes>"
}
"""


# ── Helpers ────────────────────────────────────────────────────────────────


def _compute_bmi(weight_kg, height_cm):
    if not weight_kg or not height_cm:
        return None
    return round(weight_kg / ((height_cm / 100) ** 2), 1)


def _goal_label(bmi, goals_text):
    """Enrich the goal text with BMI context so the LLM calibrates macros correctly."""
    goals_text = goals_text or "general fitness"
    if not bmi:
        return goals_text
    if bmi > 27:
        return f"fat loss (current BMI {bmi}) — {goals_text}"
    if bmi < 20:
        return f"muscle gain (current BMI {bmi}) — {goals_text}"
    return f"body recomposition (current BMI {bmi}) — {goals_text}"


# ── Public builders ────────────────────────────────────────────────────────


def build_diet_prompt(member, extra_instructions: str = "") -> tuple[str, str]:
    bmi = _compute_bmi(member.weight, member.height)
    goal = _goal_label(bmi, member.goals)

    user_prompt = f"""Generate a personalised daily diet plan for this member.

MEMBER BIODATA:
- Name:         {member.name}
- Height:       {member.height or "unknown"} cm
- Weight:       {member.weight or "unknown"} kg
- Body Fat %:   {member.body_fat_pct or "unknown"} %
- BMI:          {bmi or "unknown"}
- Primary Goal: {goal}

TRAINER INSTRUCTIONS:
{extra_instructions.strip() if extra_instructions else "None — use best judgement based on the member profile."}

OUTPUT SCHEMA (respond with ONLY this JSON, no extra text):
{DIET_SCHEMA}
"""
    return DIET_SYSTEM_PROMPT.strip(), user_prompt.strip()


def build_workout_prompt(member, extra_instructions: str = "") -> tuple[str, str]:
    bmi = _compute_bmi(member.weight, member.height)
    goal = _goal_label(bmi, member.goals)

    user_prompt = f"""Generate a personalised weekly workout plan for this member.

MEMBER BIODATA:
- Name:         {member.name}
- Height:       {member.height or "unknown"} cm
- Weight:       {member.weight or "unknown"} kg
- Body Fat %:   {member.body_fat_pct or "unknown"} %
- BMI:          {bmi or "unknown"}
- Primary Goal: {goal}

TRAINER INSTRUCTIONS:
{extra_instructions.strip() if extra_instructions else "None — use best judgement based on the member profile."}

OUTPUT SCHEMA (respond with ONLY this JSON, no extra text):
{WORKOUT_SCHEMA}
"""
    return WORKOUT_SYSTEM_PROMPT.strip(), user_prompt.strip()


def build_prompt(
    member, plan_type: str, extra_instructions: str = ""
) -> tuple[str, str]:
    """
    Dispatch to the correct builder.
    plan_type: 'DIET' | 'WORKOUT'
    Returns: (system_prompt, user_prompt)
    """
    if plan_type == "DIET":
        return build_diet_prompt(member, extra_instructions)
    if plan_type == "WORKOUT":
        return build_workout_prompt(member, extra_instructions)
    raise ValueError(f"Unknown plan_type: '{plan_type}'. Must be DIET or WORKOUT.")
