import uuid
from django.db import models
from django.conf import settings


class Transaction(models.Model):
    """
    Immutable audit trail for every Razorpay payment attempt.

    In the Marketplace model:
      - FitGyldrah collects the full amount via the master account.
      - Razorpay Route auto-transfers 95% to the gym's linked account.
      - We store the transfer split amounts for our own audit trail.

    Lifecycle:
      PENDING → order created, member has not completed checkout yet
      SUCCESS → signature verified, enrollment activated, transfer routed
      FAILED  → verification failed or explicit failure
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    enrollment = models.ForeignKey(
        "members.MemberEnrollment",
        on_delete=models.CASCADE,
        related_name="transactions",
    )

    # Full amount paid by member (in INR, stored as rupees)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Full amount in INR"
    )
    currency = models.CharField(max_length=3, default="INR")

    # Split breakdown — stored for our own accounting records
    platform_fee_pct = models.PositiveIntegerField(
        default=5, help_text="Platform fee % kept by FitGyldrah"
    )
    platform_fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Amount kept by FitGyldrah (INR)",
    )
    gym_transfer_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Amount routed to the gym's linked account (INR)",
    )

    # Razorpay identifiers
    razorpay_order_id = models.CharField(max_length=255, unique=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, default="")
    razorpay_signature = models.CharField(max_length=512, blank=True, default="")

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    failure_reason = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment"],
                condition=models.Q(status="SUCCESS"),
                name="unique_successful_payment_per_enrollment",
            )
        ]

    def __str__(self):
        return (
            f"[{self.status}] ₹{self.amount} "
            f"(platform=₹{self.platform_fee_amount} / gym=₹{self.gym_transfer_amount}) | "
            f"order={self.razorpay_order_id}"
        )

    @property
    def amount_in_paise(self) -> int:
        return int(self.amount * 100)
