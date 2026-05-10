import uuid
from django.db import models
from django.conf import settings


class Transaction(models.Model):
    """
    Immutable audit trail for every Razorpay payment attempt.

    Lifecycle:
      PENDING  → order created on Razorpay, awaiting frontend checkout
      SUCCESS  → signature verified, enrollment activated
      FAILED   → verification failed or explicit failure from Razorpay webhook

    One enrollment can have multiple Transaction rows (user retried payment),
    but only ONE can ever be SUCCESS. The UniqueConstraint enforces this.
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

    # Amount in paise (Razorpay uses smallest currency unit — ₹1 = 100 paise)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Amount in INR (stored as rupees, sent to Razorpay as paise)",
    )
    currency = models.CharField(max_length=3, default="INR")

    # Razorpay identifiers
    razorpay_order_id = models.CharField(
        max_length=255, unique=True, help_text="order_XXXXXXXXXX from Razorpay"
    )
    razorpay_payment_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="pay_XXXXXXXXXX — set after frontend checkout",
    )
    razorpay_signature = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="HMAC signature from Razorpay — set after verification",
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    failure_reason = models.TextField(
        blank=True, default="", help_text="Error detail if status=FAILED"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]
        constraints = [
            # A given enrollment can only have ONE successful payment
            models.UniqueConstraint(
                fields=["enrollment"],
                condition=models.Q(status="SUCCESS"),
                name="unique_successful_payment_per_enrollment",
            )
        ]

    def __str__(self):
        return (
            f"[{self.status}] ₹{self.amount} | "
            f"order={self.razorpay_order_id} | "
            f"user={self.user.email}"
        )

    @property
    def amount_in_paise(self) -> int:
        """Razorpay requires amounts in the smallest currency unit."""
        return int(self.amount * 100)
