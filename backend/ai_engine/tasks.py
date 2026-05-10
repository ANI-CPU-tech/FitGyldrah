"""
tasks.py
────────
Celery task for async AI plan generation via Groq.

Flow per task:
  1. Fetch trainer + member from DB
  2. Create a PENDING AIPromptLog immediately
  3. Build the prompt from member biodata
  4. Call Groq via LangChain
  5. Persist raw response + token counts to the log
  6. Create a DRAFT FitnessPlan in the DB
  7. Mark log as SUCCESS, attach plan FK
  8. Return { "plan_id": "<uuid>" } for the polling view

Retry policy:
  - RuntimeError (Groq API outage) → retry up to 3 times, 10s apart
  - ValueError (bad JSON response)  → fail immediately, no retry
"""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="ai_engine.generate_fitness_plan",
    max_retries=3,
    default_retry_delay=10,
    acks_late=True,
)
def generate_fitness_plan_task(
    self,
    trainer_id: str,
    member_id: str,
    plan_type: str,
    extra_instructions: str = "",
):
    from django.contrib.auth import get_user_model
    from trainers.models import TrainerProfile
    from plans.models import FitnessPlan
    from .models import AIPromptLog
    from .prompt_builder import build_prompt
    from .groq_client import call_groq

    User = get_user_model()
    task_id = self.request.id or "unknown"

    # ── 1. Fetch entities ──────────────────────────────────────────────
    try:
        trainer = TrainerProfile.objects.select_related("user").get(pk=trainer_id)
        member = User.objects.get(pk=member_id)
    except (TrainerProfile.DoesNotExist, User.DoesNotExist) as exc:
        logger.error(f"[AI Task] Entity not found: {exc}")
        raise  # Bad input — don't retry

    # ── 2. Create PENDING log ──────────────────────────────────────────
    log = AIPromptLog.objects.create(
        trainer=trainer,
        member=member,
        plan_type=plan_type,
        celery_task_id=task_id,
        extra_instructions=extra_instructions,
        gen_status=AIPromptLog.GenerationStatus.PENDING,
    )

    # ── 3. Build prompt ────────────────────────────────────────────────
    try:
        system_prompt, user_prompt = build_prompt(member, plan_type, extra_instructions)
        log.system_prompt = system_prompt
        log.user_prompt = user_prompt
        log.save(update_fields=["system_prompt", "user_prompt"])
    except Exception as exc:
        _fail_log(log, str(exc))
        raise

    # ── 4. Call Groq ───────────────────────────────────────────────────
    try:
        result = call_groq(system_prompt, user_prompt)
    except RuntimeError as exc:
        # API error — worth retrying
        _fail_log(log, str(exc))
        logger.warning(f"[AI Task] Groq error, retrying... ({exc})")
        raise self.retry(exc=exc)
    except ValueError as exc:
        # Bad JSON — not worth retrying
        _fail_log(log, str(exc))
        logger.error(f"[AI Task] JSON parse failed: {exc}")
        raise

    # ── 5. Persist response + tokens ───────────────────────────────────
    log.raw_response = result["raw_text"]
    log.model_used = result["model"]
    log.prompt_tokens = result["prompt_tokens"]
    log.completion_tokens = result["completion_tokens"]
    log.total_tokens = result["total_tokens"]
    log.save(
        update_fields=[
            "raw_response",
            "model_used",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
        ]
    )

    # ── 6. Create DRAFT FitnessPlan ────────────────────────────────────
    try:
        version = FitnessPlan.next_version(trainer, member, plan_type)
        plan = FitnessPlan.objects.create(
            trainer=trainer,
            member=member,
            plan_type=plan_type,
            title=_auto_title(member, plan_type, version),
            content_json=result["content"],
            ai_generated=True,
            ai_task_id=task_id,
            status=FitnessPlan.Status.DRAFT,
            version=version,
            notes=(
                f"AI-generated via Groq ({result['model']}). "
                "Review and modify before approving."
            ),
        )
    except Exception as exc:
        _fail_log(log, f"FitnessPlan DB write failed: {exc}")
        logger.error(f"[AI Task] DB write failed: {exc}")
        raise

    # ── 7. Finalise log ────────────────────────────────────────────────
    log.plan = plan
    log.gen_status = AIPromptLog.GenerationStatus.SUCCESS
    log.completed_at = timezone.now()
    log.save(update_fields=["plan", "gen_status", "completed_at"])

    logger.info(
        f"[AI Task] SUCCESS plan_id={plan.id} "
        f"type={plan_type} tokens={result['total_tokens']}"
    )

    return {"plan_id": str(plan.id)}


# ── Helpers ────────────────────────────────────────────────────────────────


def _fail_log(log, error_message: str):
    log.gen_status = log.GenerationStatus.FAILED
    log.error_message = error_message
    log.completed_at = timezone.now()
    log.save(update_fields=["gen_status", "error_message", "completed_at"])


def _auto_title(member, plan_type: str, version: int) -> str:
    label = "Diet Plan" if plan_type == "DIET" else "Workout Plan"
    return f"AI {label} for {member.name} — v{version}"
