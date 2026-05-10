import uuid
from django.db import models
from django.conf import settings


class AIPromptLog(models.Model):
    """
    Full audit log for every Groq AI generation request.
    One entry is created per Celery task — stores the complete prompt,
    raw response, token usage, and links to the resulting FitnessPlan.

    gen_status lifecycle:  PENDING → SUCCESS | FAILED
    """

    class GenerationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    trainer = models.ForeignKey(
        "trainers.TrainerProfile",
        on_delete=models.SET_NULL,
        null=True,
        related_name="ai_logs",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="ai_logs",
        limit_choices_to={"role": "MEMBER"},
    )
    plan = models.ForeignKey(
        "plans.FitnessPlan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_logs",
        help_text="The plan produced (null if generation failed)",
    )

    plan_type = models.CharField(max_length=10, help_text="DIET or WORKOUT")
    celery_task_id = models.CharField(max_length=255, db_index=True)
    model_used = models.CharField(
        max_length=100, default="", help_text="e.g. llama3-70b-8192"
    )

    # Full prompts — stored for debugging and future fine-tuning
    system_prompt = models.TextField(default="")
    user_prompt = models.TextField(default="")

    # Raw Groq response + any error message
    raw_response = models.TextField(blank=True, default="")
    error_message = models.TextField(blank=True, default="")

    # Groq token tracking
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)

    gen_status = models.CharField(
        max_length=10,
        choices=GenerationStatus.choices,
        default=GenerationStatus.PENDING,
        db_index=True,
    )
    extra_instructions = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_prompt_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"[{self.plan_type}] {self.gen_status} | "
            f"trainer={self.trainer} | "
            f"{self.total_tokens} tokens"
        )
