from rest_framework import serializers
from .models import Gym, SubscriptionTier


# ─────────────────────────────────────────────
# Subscription Tier
# ─────────────────────────────────────────────
class SubscriptionTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionTier
        fields = [
            "id",
            "gym",
            "name",
            "price",
            "duration_type",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "gym", "created_at", "updated_at"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value


class SubscriptionTierCreateSerializer(serializers.ModelSerializer):
    """Used for creation — gym is injected from the URL, not the body."""

    class Meta:
        model = SubscriptionTier
        fields = ["id", "name", "price", "duration_type", "description"]
        read_only_fields = ["id"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value


# ─────────────────────────────────────────────
# Gym — nested tiers on read, flat on write
# ─────────────────────────────────────────────
class GymReadSerializer(serializers.ModelSerializer):
    tiers = SubscriptionTierSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Gym
        fields = [
            "id",
            "name",
            "location",
            "facilities",
            "operating_hours",
            "logo_url",
            "is_active",
            "owner_name",
            "owner_email",
            "tiers",
            "created_at",
            "updated_at",
        ]


class GymWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gym
        fields = [
            "name",
            "location",
            "facilities",
            "operating_hours",
            "logo_url",
        ]

    def validate_name(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Gym name must be at least 3 characters.")
        return value
