import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Schedule(models.Model):
    """
    A trainer proposes a workout/consultation slot to a specific member.
    The member then accepts or rejects it.
    Both parties must share an active enrollment at the same gym.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Member Response"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"

    class SessionType(models.TextChoices):
        WORKOUT = "WORKOUT", "Workout Session"
        CONSULTATION = "CONSULTATION", "Consultation"
        ASSESSMENT = "ASSESSMENT", "Fitness Assessment"
        DIET_REVIEW = "DIET_REVIEW", "Diet Plan Review"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    trainer = models.ForeignKey(
        "trainers.TrainerProfile",
        on_delete=models.CASCADE,
        related_name="proposed_schedules",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="schedules",
        limit_choices_to={"role": "MEMBER"},
    )
    gym = models.ForeignKey(
        "gyms.Gym",
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    session_type = models.CharField(
        max_length=20,
        choices=SessionType.choices,
        default=SessionType.WORKOUT,
    )
    proposed_time = models.DateTimeField(
        help_text="The datetime the trainer is proposing for the session"
    )
    duration_minutes = models.PositiveIntegerField(
        default=60, help_text="Expected session length in minutes"
    )
    location = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="e.g. 'Main Floor', 'Studio B', 'Online'",
    )
    notes = models.TextField(
        blank=True, default="", help_text="Trainer's notes for this session"
    )

    # Response from member
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    member_note = models.TextField(
        blank=True,
        default="",
        help_text="Optional note from the member on accept/reject",
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.CharField(
        max_length=10, blank=True, default="", help_text="TRAINER or MEMBER"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "schedules"
        ordering = ["proposed_time"]
        indexes = [
            models.Index(fields=["trainer", "proposed_time"]),
            models.Index(fields=["member", "proposed_time"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return (
            f"[{self.session_type}] {self.trainer.user.name} → "
            f"{self.member.name} @ {self.proposed_time:%Y-%m-%d %H:%M} [{self.status}]"
        )

    @property
    def is_upcoming(self):
        return (
            self.proposed_time > timezone.now() and self.status == self.Status.ACCEPTED
        )

    @property
    def end_time(self):
        from datetime import timedelta

        return self.proposed_time + timedelta(minutes=self.duration_minutes)

    def accept(self, member_note=""):
        self.status = self.Status.ACCEPTED
        self.member_note = member_note
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "member_note", "responded_at", "updated_at"])

    def reject(self, member_note=""):
        self.status = self.Status.REJECTED
        self.member_note = member_note
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "member_note", "responded_at", "updated_at"])

    def cancel(self, cancelled_by):
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.cancelled_by = cancelled_by
        self.save(
            update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"]
        )

    def complete(self):
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "updated_at"])
