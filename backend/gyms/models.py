import uuid
from django.db import models
from django.conf import settings


class Gym(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gyms",
        limit_choices_to={"role": "OWNER"},
    )
    name = models.CharField(max_length=100)
    location = models.TextField()
    facilities = models.TextField(
        blank=True,
        default="",
        help_text="Comma-separated list e.g. 'Pool, Sauna, Free Weights'",
    )
    operating_hours = models.JSONField(
        default=dict, help_text='e.g. {"mon-fri": "6am-10pm", "sat-sun": "8am-8pm"}'
    )
    logo_url = models.URLField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gyms"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} (owned by {self.owner.name})"


class SubscriptionTier(models.Model):
    class DurationType(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        YEARLY = "YEARLY", "Yearly"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="tiers",
    )
    name = models.CharField(max_length=100, help_text="e.g. 'Knight Tier', 'Lord Tier'")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_type = models.CharField(max_length=10, choices=DurationType.choices)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscription_tiers"
        ordering = ["price"]

    def __str__(self):
        return f"{self.name} — {self.gym.name} ({self.duration_type})"
