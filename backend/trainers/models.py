import uuid
from django.db import models
from django.conf import settings


class TrainerProfile(models.Model):
    """
    Created once when a user claims the TRAINER role.
    Holds certifications, experience, and their uploaded CV.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trainer_profile",
        limit_choices_to={"role": "TRAINER"},
    )
    certifications = models.TextField(
        blank=True,
        default="",
        help_text="e.g. 'NASM-CPT, CrossFit L2, Precision Nutrition'",
    )
    years_experience = models.PositiveIntegerField(default=0)
    specialty = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="e.g. 'Strength & Conditioning, Weight Loss'",
    )
    bio = models.TextField(blank=True, default="")
    cv_file = models.FileField(
        upload_to="trainer_cvs/%Y/%m/",
        null=True,
        blank=True,
        help_text="PDF or DOCX — stored in S3",
    )
    profile_picture = models.ImageField(
        upload_to="trainer_pics/%Y/%m/",
        null=True,
        blank=True,
    )
    is_available = models.BooleanField(
        default=True, help_text="Trainer can toggle availability for new clients"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "trainer_profiles"

    def __str__(self):
        return f"Trainer: {self.user.name} ({self.user.email})"


class GymApplication(models.Model):
    """
    A trainer applies to work at a specific gym.
    The gym owner reviews and approves/rejects.
    One trainer can apply to multiple gyms.
    One gym can have multiple applications.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.ForeignKey(
        TrainerProfile,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    gym = models.ForeignKey(
        "gyms.Gym",
        on_delete=models.CASCADE,
        related_name="trainer_applications",
    )
    cover_letter = models.TextField(
        blank=True, default="", help_text="Optional message to the gym owner"
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    owner_note = models.TextField(
        blank=True, default="", help_text="Owner's internal note on approval/rejection"
    )
    applied_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "gym_applications"
        ordering = ["-applied_at"]
        # A trainer can only have ONE active application per gym at a time
        constraints = [
            models.UniqueConstraint(
                fields=["trainer", "gym"],
                condition=models.Q(status="PENDING"),
                name="unique_pending_application_per_gym",
            )
        ]

    def __str__(self):
        return f"{self.trainer.user.name} → {self.gym.name} [{self.status}]"
