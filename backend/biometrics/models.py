import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Biometric(models.Model):
    """
    One row = one measurement snapshot for a member.

    This table is converted into a TimescaleDB hypertable in migration 0001.
    TimescaleDB partitions rows by `recorded_at` into weekly chunks,
    making time-range queries (trends, history) fast at any scale.

    Query rules:
      - ALWAYS filter by member + recorded_at range first
      - ALWAYS order by recorded_at — never by id
      - Use the TimescaleDB helper views in views.py for aggregation
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="biometrics",
        limit_choices_to={"role": "MEMBER"},
    )

    # ── Core body composition ─────────────────────────────────────────
    weight_kg = models.FloatField(null=True, blank=True, help_text="Body weight in kg")
    body_fat_pct = models.FloatField(
        null=True, blank=True, help_text="Body fat percentage (1–60)"
    )
    muscle_mass_kg = models.FloatField(
        null=True, blank=True, help_text="Lean muscle mass in kg"
    )
    bmi = models.FloatField(
        null=True,
        blank=True,
        help_text="Auto-computed from weight + member height if blank",
    )

    # ── Optional vitals ───────────────────────────────────────────────
    resting_hr_bpm = models.PositiveIntegerField(
        null=True, blank=True, help_text="Resting heart rate (bpm)"
    )
    systolic_bp = models.PositiveIntegerField(
        null=True, blank=True, help_text="Systolic blood pressure (mmHg)"
    )
    diastolic_bp = models.PositiveIntegerField(
        null=True, blank=True, help_text="Diastolic blood pressure (mmHg)"
    )

    notes = models.TextField(blank=True, default="")

    # ── Hypertable dimension column ───────────────────────────────────
    # TimescaleDB partitions on this column — must always be indexed.
    recorded_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="When the measurement was actually taken",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "biometrics"
        ordering = ["-recorded_at"]
        indexes = [
            # Covers the most common query: member X's data between date A and B
            models.Index(fields=["member", "-recorded_at"], name="bio_member_time_idx"),
        ]

    def __str__(self):
        parts = []
        if self.weight_kg:
            parts.append(f"{self.weight_kg}kg")
        if self.body_fat_pct:
            parts.append(f"{self.body_fat_pct}%bf")
        if self.bmi:
            parts.append(f"BMI {self.bmi}")
        reading = ", ".join(parts) or "no measurements"
        return f"{self.member.name} @ {self.recorded_at:%Y-%m-%d %H:%M} — {reading}"

    def save(self, *args, **kwargs):
        # Auto-compute BMI from weight + member's stored height if not supplied
        if self.weight_kg and not self.bmi:
            try:
                h_cm = self.member.height
                if h_cm:
                    self.bmi = round(self.weight_kg / ((h_cm / 100) ** 2), 1)
            except Exception:
                pass
        super().save(*args, **kwargs)

    @staticmethod
    def bmi_category(bmi: float | None) -> str | None:
        if bmi is None:
            return None
        if bmi < 18.5:
            return "Underweight"
        if bmi < 25.0:
            return "Normal"
        if bmi < 30.0:
            return "Overweight"
        return "Obese"
