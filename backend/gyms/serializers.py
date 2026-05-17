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
    class Meta:
        model = SubscriptionTier
        fields = ["id", "name", "price", "duration_type", "description"]
        read_only_fields = ["id"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value


# ─────────────────────────────────────────────
# Gym — Read
# ─────────────────────────────────────────────
class GymReadSerializer(serializers.ModelSerializer):
    tiers = SubscriptionTierSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    # Expose only whether the bank is linked — never the raw account ID to clients
    is_payment_ready = serializers.BooleanField(read_only=True)

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
            "is_payment_ready",  # True once bank is connected
            "tiers",
            "created_at",
            "updated_at",
        ]


# ─────────────────────────────────────────────
# Gym — Write (create / update by owner)
# ─────────────────────────────────────────────
class GymWriteSerializer(serializers.ModelSerializer):
    """
    Used for POST (create gym) and PUT/PATCH (update gym details).
    razorpay_linked_account_id is intentionally excluded here —
    it is set exclusively through ConnectBankView, not by the owner directly.
    """

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


# ─────────────────────────────────────────────
# Owner-only read — includes linked account status
# Used in the owner's own gym management panel
# ─────────────────────────────────────────────
class GymOwnerDetailSerializer(serializers.ModelSerializer):
    """
    Extended read serializer for the gym owner's own dashboard.
    Shows bank connection status more explicitly.
    """

    tiers = SubscriptionTierSerializer(many=True, read_only=True)
    is_payment_ready = serializers.BooleanField(read_only=True)
    # Show partial account ID for confirmation (last 6 chars) — never the full ID
    linked_account_hint = serializers.SerializerMethodField()

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
            "is_payment_ready",
            "linked_account_hint",
            "tiers",
            "created_at",
            "updated_at",
        ]

    def get_linked_account_hint(self, obj):
        if obj.razorpay_linked_account_id:
            # e.g. "acc_••••••XyZ123"
            acct = obj.razorpay_linked_account_id
            return f"acc_••••••{acct[-6:]}"
        return None
