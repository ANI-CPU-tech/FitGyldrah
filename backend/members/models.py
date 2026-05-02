import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class MemberEnrollment(models.Model):
    """
    Represents a member's active or historical subscription to a gym.
    One member can be enrolled in multiple gyms simultaneously.
    One gym can have many enrolled members.
    Billing cycle is derived from the chosen SubscriptionTier duration.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "MEMBER"},
    )
    gym = models.ForeignKey(
        "gyms.Gym",
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    tier = models.ForeignKey(
        "gyms.SubscriptionTier",
        on_delete=models.PROTECT,  # Never delete a tier that has active members
        related_name="enrollments",
    )

    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    # Snapshot the price at time of enrollment — tier price may change later
    price_paid = models.DecimalField(max_digits=10, decimal_places=2)

    # Optional: assigned trainer at this gym
    trainer = models.ForeignKey(
        "trainers.TrainerProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_members",
    )

    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "member_enrollments"
        ordering = ["-created_at"]
        constraints = [
            # A member can only have ONE active enrollment per gym at a time
            models.UniqueConstraint(
                fields=["member", "gym"],
                condition=models.Q(status="ACTIVE"),
                name="unique_active_enrollment_per_gym",
            )
        ]

    def __str__(self):
        return f"{self.member.name} @ {self.gym.name} [{self.status}] until {self.end_date}"

    @property
    def is_expired(self):
        return self.end_date < timezone.now().date()

    def cancel(self):
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])

    @classmethod
    def compute_end_date(cls, start_date, duration_type):
        """Compute end date based on tier duration type."""
        from dateutil.relativedelta import relativedelta
        from gyms.models import SubscriptionTier

        if duration_type == SubscriptionTier.DurationType.MONTHLY:
            return start_date + relativedelta(months=1)
        elif duration_type == SubscriptionTier.DurationType.YEARLY:
            return start_date + relativedelta(years=1)
        return start_date
