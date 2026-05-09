import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Biometric(models.Model):
    """
    A single biometric reading logged by a member.
    This table is converted to a TimescaleDB hypertable after the initial
    Django migration — see migrations/0002_create_hypertable.py.

    TimescaleDB automatically partitions this table by `recorded_at`
    for ultra-fast time-range queries (weekly trends, monthly averages).

    Cardinality: One User → Many Biometric readings (time-series).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="biometrics"
    )

    # Core measurements — all nullable so partial entries are allowed
    weight = models.FloatField(null=True, blank=True, help_text="kg")
    height = models.FloatField(
        null=True, blank=True, help_text="cm — rarely changes but tracked"
    )
    body_fat_pct = models.FloatField(
        null=True, blank=True, help_text="Body fat percentage"
    )
    muscle_mass = models.FloatField(null=True, blank=True, help_text="kg")
    bmi = models.FloatField(
        null=True, blank=True, help_text="Auto-calculated if not provided"
    )

    # Additional optional metrics
    waist_cm = models.FloatField(
        null=True, blank=True, help_text="Waist circumference in cm"
    )
    chest_cm = models.FloatField(
        null=True, blank=True, help_text="Chest circumference in cm"
    )
    hip_cm = models.FloatField(
        null=True, blank=True, help_text="Hip circumference in cm"
    )
    resting_hr = models.PositiveIntegerField(
        null=True, blank=True, help_text="Resting heart rate (bpm)"
    )

    notes = models.TextField(blank=True, default="")

    # TIME DIMENSION — this is the hypertable partition key
    # TimescaleDB chunks the table by this column automatically
    recorded_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="When the measurement was taken. Hypertable partition key.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "biometrics"
        ordering = ["-recorded_at"]
        indexes = [
            # Composite index for the most common query: one user's data over a time range
            models.Index(
                fields=["user", "recorded_at"], name="idx_biometrics_user_time"
            ),
        ]

    def __str__(self):
        return f"{self.user.name} @ {self.recorded_at:%Y-%m-%d %H:%M} | weight={self.weight}kg"

    def save(self, *args, **kwargs):
        # Auto-calculate BMI if weight and height are both present and BMI not manually set
        if self.weight and self.height and not self.bmi:
            height_m = self.height / 100
            self.bmi = round(self.weight / (height_m**2), 2)
        super().save(*args, **kwargs)
