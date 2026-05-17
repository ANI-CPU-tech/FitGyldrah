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
    facilities = models.TextField(blank=True, default="")
    operating_hours = models.JSONField(default=dict)
    logo_url = models.URLField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    # ── Razorpay Marketplace ───────────────────────────────────────────
    # Set when the gym owner completes bank onboarding via ConnectBankView.
    # Format: "acc_XXXXXXXXXXXXXXXXXX" (provided by Razorpay Route API).
    # Until this is set, the gym cannot accept member payments.
    razorpay_linked_account_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        default=None,
        help_text=(
            "Razorpay Route linked account ID (acc_xxx). "
            "Set automatically when owner connects their bank."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gyms"
        ordering = ["-created_at"]

    def __str__(self):
        linked = (
            "✓ Bank linked" if self.razorpay_linked_account_id else "✗ Bank not linked"
        )
        return f"{self.name} ({linked})"

    @property
    def is_payment_ready(self) -> bool:
        """True only when the gym owner has completed bank onboarding."""
        return bool(self.razorpay_linked_account_id)


class SubscriptionTier(models.Model):
    class DurationType(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        YEARLY = "YEARLY", "Yearly"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gym = models.ForeignKey(Gym, on_delete=models.CASCADE, related_name="tiers")
    name = models.CharField(max_length=100)
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
