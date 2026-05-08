from rest_framework import serializers
from django.utils import timezone
from .models import Biometric


# ─────────────────────────────────────────────
# Create — member logs a new reading
# ─────────────────────────────────────────────
class BiometricCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Biometric
        fields = [
            "weight_kg",
            "body_fat_pct",
            "muscle_mass_kg",
            "bmi",
            "resting_hr_bpm",
            "systolic_bp",
            "diastolic_bp",
            "notes",
            "recorded_at",
        ]

    def validate_recorded_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError("recorded_at cannot be in the future.")
        return value

    def validate_weight_kg(self, value):
        if value is not None and not (20.0 <= value <= 300.0):
            raise serializers.ValidationError("Weight must be between 20 and 300 kg.")
        return value

    def validate_body_fat_pct(self, value):
        if value is not None and not (1.0 <= value <= 60.0):
            raise serializers.ValidationError("Body fat % must be between 1 and 60.")
        return value

    def validate_resting_hr_bpm(self, value):
        if value is not None and not (30 <= value <= 220):
            raise serializers.ValidationError(
                "Heart rate must be between 30 and 220 bpm."
            )
        return value

    def validate(self, attrs):
        # At least one measurement field must have a value
        measurement_fields = [
            "weight_kg",
            "body_fat_pct",
            "muscle_mass_kg",
            "resting_hr_bpm",
            "systolic_bp",
            "diastolic_bp",
        ]
        if not any(attrs.get(f) is not None for f in measurement_fields):
            raise serializers.ValidationError(
                "Provide at least one measurement (weight, body fat, heart rate, etc.)."
            )
        return attrs


# ─────────────────────────────────────────────
# Read — single entry detail
# ─────────────────────────────────────────────
class BiometricReadSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)
    bmi_category = serializers.SerializerMethodField()

    class Meta:
        model = Biometric
        fields = [
            "id",
            "member_name",
            "weight_kg",
            "body_fat_pct",
            "muscle_mass_kg",
            "bmi",
            "bmi_category",
            "resting_hr_bpm",
            "systolic_bp",
            "diastolic_bp",
            "notes",
            "recorded_at",
            "created_at",
        ]

    def get_bmi_category(self, obj):
        return Biometric.bmi_category(obj.bmi)


# ─────────────────────────────────────────────
# Latest snapshot — most recent non-null value
# per field across all entries
# ─────────────────────────────────────────────
class BiometricLatestSerializer(serializers.Serializer):
    """
    Returns the member's most recent non-null value for each field.
    Different fields may come from different log entries
    (e.g. weight logged daily, body fat logged weekly).
    """

    weight_kg = serializers.FloatField(allow_null=True)
    body_fat_pct = serializers.FloatField(allow_null=True)
    muscle_mass_kg = serializers.FloatField(allow_null=True)
    bmi = serializers.FloatField(allow_null=True)
    bmi_category = serializers.CharField(allow_null=True)
    resting_hr_bpm = serializers.IntegerField(allow_null=True)
    systolic_bp = serializers.IntegerField(allow_null=True)
    diastolic_bp = serializers.IntegerField(allow_null=True)
    last_entry_at = serializers.DateTimeField(allow_null=True)


# ─────────────────────────────────────────────
# Trend point — one bucket in the trend response
# ─────────────────────────────────────────────
class BiometricTrendPointSerializer(serializers.Serializer):
    period = serializers.CharField()  # "2026-W18" or "2026-05"
    avg_weight_kg = serializers.FloatField(allow_null=True)
    avg_body_fat = serializers.FloatField(allow_null=True)
    avg_bmi = serializers.FloatField(allow_null=True)
    avg_hr_bpm = serializers.FloatField(allow_null=True)
    reading_count = serializers.IntegerField()
