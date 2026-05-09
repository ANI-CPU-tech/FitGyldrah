from rest_framework import serializers
from django.utils import timezone

from .models import Biometric


# ─────────────────────────────────────────────
# Read
# ─────────────────────────────────────────────
class BiometricReadSerializer(serializers.ModelSerializer):
    bmi_category = serializers.SerializerMethodField()

    class Meta:
        model = Biometric
        fields = [
            "id",
            "weight",
            "height",
            "body_fat_pct",
            "muscle_mass",
            "bmi",
            "bmi_category",
            "waist_cm",
            "chest_cm",
            "hip_cm",
            "resting_hr",
            "notes",
            "recorded_at",
            "created_at",
        ]

    def get_bmi_category(self, obj):
        if not obj.bmi:
            return None
        if obj.bmi < 18.5:
            return "Underweight"
        if obj.bmi < 25.0:
            return "Normal"
        if obj.bmi < 30.0:
            return "Overweight"
        return "Obese"


# ─────────────────────────────────────────────
# Write — log a new reading
# ─────────────────────────────────────────────
class BiometricWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Biometric
        fields = [
            "weight",
            "height",
            "body_fat_pct",
            "muscle_mass",
            "bmi",
            "waist_cm",
            "chest_cm",
            "hip_cm",
            "resting_hr",
            "notes",
            "recorded_at",
        ]

    def validate_weight(self, value):
        if value is not None and not (10 <= value <= 500):
            raise serializers.ValidationError("Weight must be between 10kg and 500kg.")
        return value

    def validate_height(self, value):
        if value is not None and not (50 <= value <= 280):
            raise serializers.ValidationError("Height must be between 50cm and 280cm.")
        return value

    def validate_body_fat_pct(self, value):
        if value is not None and not (1 <= value <= 70):
            raise serializers.ValidationError("Body fat % must be between 1 and 70.")
        return value

    def validate_resting_hr(self, value):
        if value is not None and not (30 <= value <= 220):
            raise serializers.ValidationError(
                "Resting heart rate must be between 30 and 220 bpm."
            )
        return value

    def validate_recorded_at(self, value):
        if value and value > timezone.now():
            raise serializers.ValidationError("recorded_at cannot be in the future.")
        return value

    def validate(self, attrs):
        # At least one measurement must be provided
        measurement_fields = [
            "weight",
            "height",
            "body_fat_pct",
            "muscle_mass",
            "waist_cm",
            "chest_cm",
            "hip_cm",
            "resting_hr",
        ]
        if not any(attrs.get(f) is not None for f in measurement_fields):
            raise serializers.ValidationError(
                "At least one measurement field must be provided."
            )
        return attrs


# ─────────────────────────────────────────────
# Trend summary (aggregated — not a model serializer)
# ─────────────────────────────────────────────
class BiometricTrendSerializer(serializers.Serializer):
    """Serializes the aggregated trend data returned by the trends view."""

    period = serializers.CharField()  # e.g. "2026-W18" or "2026-05"
    avg_weight = serializers.FloatField(allow_null=True)
    avg_body_fat = serializers.FloatField(allow_null=True)
    avg_bmi = serializers.FloatField(allow_null=True)
    avg_muscle_mass = serializers.FloatField(allow_null=True)
    avg_resting_hr = serializers.FloatField(allow_null=True)
    reading_count = serializers.IntegerField()


# ─────────────────────────────────────────────
# Latest snapshot (single-record summary)
# ─────────────────────────────────────────────
class BiometricLatestSerializer(serializers.Serializer):
    """The most recent value for each metric — one record per field."""

    latest_weight = serializers.FloatField(allow_null=True)
    latest_height = serializers.FloatField(allow_null=True)
    latest_body_fat = serializers.FloatField(allow_null=True)
    latest_muscle_mass = serializers.FloatField(allow_null=True)
    latest_bmi = serializers.FloatField(allow_null=True)
    latest_bmi_category = serializers.CharField(allow_null=True)
    latest_waist = serializers.FloatField(allow_null=True)
    latest_resting_hr = serializers.IntegerField(allow_null=True)
    last_recorded_at = serializers.DateTimeField(allow_null=True)

    # Delta since previous reading
    weight_delta = serializers.FloatField(allow_null=True)
    body_fat_delta = serializers.FloatField(allow_null=True)
