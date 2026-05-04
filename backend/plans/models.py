import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class FitnessPlan(models.Model):
    """
    A diet or workout plan created by a trainer for a specific member.
    Can be AI-generated (drafted by Ollama/LangChain) or manually written.
    Goes through a DRAFT → APPROVED flow before the member can see it.
    """

    class PlanType(models.TextChoices):
        DIET = "DIET", "Diet Plan"
        WORKOUT = "WORKOUT", "Workout Plan"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"  # AI-generated or manually written, not yet approved
        APPROVED = "APPROVED", "Approved"  # Trainer approved — visible to member
        ARCHIVED = "ARCHIVED", "Archived"  # Superseded by a newer version

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    trainer = models.ForeignKey(
        "trainers.TrainerProfile",
        on_delete=models.CASCADE,
        related_name="created_plans",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="plans",
        limit_choices_to={"role": "MEMBER"},
    )

    plan_type = models.CharField(
        max_length=10,
        choices=PlanType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    content_json = models.JSONField(
        help_text=(
            "Structured plan content. "
            "Diet: {meals: [{name, time, calories, items:[]}]}. "
            "Workout: {days: [{day, exercises:[{name,sets,reps,rest}]}]}"
        )
    )
    notes = models.TextField(
        blank=True, default="", help_text="Trainer's additional notes or instructions"
    )

    # AI generation metadata
    ai_generated = models.BooleanField(
        default=False,
        help_text="True if this plan was initially drafted by the AI engine",
    )
    ai_task_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Celery task ID for the AI generation job",
    )

    # Approval workflow
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Versioning — each time a plan is superseded, version increments
    version = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fitness_plans"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["member", "plan_type", "status"]),
            models.Index(fields=["trainer", "status"]),
        ]

    def __str__(self):
        ai_flag = " [AI]" if self.ai_generated else ""
        return (
            f"[{self.plan_type}]{ai_flag} v{self.version} — "
            f"{self.title} for {self.member.name} ({self.status})"
        )

    # ── State transitions ──────────────────────────────────────

    def approve(self):
        """
        Trainer approves this plan.
        Any previously APPROVED plan of the same type for this member
        is automatically archived.
        """
        # Archive the old active plan of the same type
        FitnessPlan.objects.filter(
            member=self.member,
            plan_type=self.plan_type,
            status=FitnessPlan.Status.APPROVED,
        ).exclude(pk=self.pk).update(status=FitnessPlan.Status.ARCHIVED)

        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        self.save(update_fields=["status", "approved_at", "updated_at"])

    def archive(self):
        self.status = self.Status.ARCHIVED
        self.save(update_fields=["status", "updated_at"])

    @classmethod
    def next_version(cls, trainer, member, plan_type):
        """Returns the next version number for a trainer-member-type combination."""
        latest = (
            cls.objects.filter(trainer=trainer, member=member, plan_type=plan_type)
            .order_by("-version")
            .first()
        )
        return (latest.version + 1) if latest else 1
