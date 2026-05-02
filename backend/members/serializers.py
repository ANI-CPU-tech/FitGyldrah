from rest_framework import serializers
from django.utils import timezone

from gyms.models import Gym, SubscriptionTier
from gyms.serializers import GymReadSerializer, SubscriptionTierSerializer
from trainers.models import TrainerProfile, GymApplication

from .models import MemberEnrollment


# ─────────────────────────────────────────────
# Gym Discovery (enriched read for members)
# ─────────────────────────────────────────────
class GymDiscoverySerializer(serializers.ModelSerializer):
    """
    Public gym card for discovery/search.
    Shows tiers, approved trainer count, and whether the
    requesting member is already enrolled.
    """

    tiers = SubscriptionTierSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    trainer_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Gym
        fields = [
            "id",
            "name",
            "location",
            "facilities",
            "operating_hours",
            "logo_url",
            "owner_name",
            "trainer_count",
            "tiers",
            "is_enrolled",
        ]

    def get_trainer_count(self, obj):
        return GymApplication.objects.filter(
            gym=obj, status=GymApplication.Status.APPROVED
        ).count()

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return MemberEnrollment.objects.filter(
            member=request.user, gym=obj, status=MemberEnrollment.Status.ACTIVE
        ).exists()


# ─────────────────────────────────────────────
# Enrollment — Read
# ─────────────────────────────────────────────
class EnrollmentReadSerializer(serializers.ModelSerializer):
    gym_name = serializers.CharField(source="gym.name", read_only=True)
    gym_location = serializers.CharField(source="gym.location", read_only=True)
    tier_name = serializers.CharField(source="tier.name", read_only=True)
    tier_duration = serializers.CharField(source="tier.duration_type", read_only=True)
    trainer_name = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = MemberEnrollment
        fields = [
            "id",
            "gym_name",
            "gym_location",
            "tier_name",
            "tier_duration",
            "price_paid",
            "trainer_name",
            "start_date",
            "end_date",
            "days_remaining",
            "is_expired",
            "status",
            "cancelled_at",
            "created_at",
        ]

    def get_trainer_name(self, obj):
        if obj.trainer:
            return obj.trainer.user.name
        return None

    def get_days_remaining(self, obj):
        if obj.status != MemberEnrollment.Status.ACTIVE:
            return 0
        delta = obj.end_date - timezone.now().date()
        return max(delta.days, 0)


# ─────────────────────────────────────────────
# Enrollment — Create (join a gym)
# ─────────────────────────────────────────────
class EnrollmentCreateSerializer(serializers.Serializer):
    gym_id = serializers.UUIDField()
    tier_id = serializers.UUIDField()

    def validate(self, attrs):
        request = self.context["request"]
        member = request.user

        # Validate gym exists and is active
        try:
            gym = Gym.objects.get(pk=attrs["gym_id"], is_active=True)
        except Gym.DoesNotExist:
            raise serializers.ValidationError(
                {"gym_id": "Gym not found or is inactive."}
            )

        # Validate tier belongs to this gym and is active
        try:
            tier = SubscriptionTier.objects.get(
                pk=attrs["tier_id"], gym=gym, is_active=True
            )
        except SubscriptionTier.DoesNotExist:
            raise serializers.ValidationError(
                {"tier_id": "Tier not found, inactive, or does not belong to this gym."}
            )

        # Block duplicate active enrollment
        if MemberEnrollment.objects.filter(
            member=member, gym=gym, status=MemberEnrollment.Status.ACTIVE
        ).exists():
            raise serializers.ValidationError(
                {"gym_id": "You already have an active enrollment at this gym."}
            )

        attrs["gym"] = gym
        attrs["tier"] = tier
        return attrs

    def save(self):
        request = self.context["request"]
        gym = self.validated_data["gym"]
        tier = self.validated_data["tier"]
        start_date = timezone.now().date()
        end_date = MemberEnrollment.compute_end_date(start_date, tier.duration_type)

        return MemberEnrollment.objects.create(
            member=request.user,
            gym=gym,
            tier=tier,
            start_date=start_date,
            end_date=end_date,
            price_paid=tier.price,  # snapshot price at time of joining
            status=MemberEnrollment.Status.ACTIVE,
        )


# ─────────────────────────────────────────────
# Trainer Assignment (owner assigns trainer to member)
# ─────────────────────────────────────────────
class AssignTrainerSerializer(serializers.Serializer):
    trainer_id = serializers.UUIDField()

    def validate_trainer_id(self, value):
        try:
            trainer = TrainerProfile.objects.get(pk=value)
        except TrainerProfile.DoesNotExist:
            raise serializers.ValidationError("Trainer not found.")
        self._trainer = trainer
        return value

    def validate(self, attrs):
        enrollment = self.context["enrollment"]
        trainer = self._trainer

        # Trainer must be approved at the same gym as the enrollment
        is_at_gym = GymApplication.objects.filter(
            trainer=trainer,
            gym=enrollment.gym,
            status=GymApplication.Status.APPROVED,
        ).exists()

        if not is_at_gym:
            raise serializers.ValidationError(
                {"trainer_id": "This trainer is not approved at the member's gym."}
            )
        return attrs

    def save(self):
        enrollment = self.context["enrollment"]
        enrollment.trainer = self._trainer
        enrollment.save(update_fields=["trainer", "updated_at"])
        return enrollment


# ─────────────────────────────────────────────
# Owner — member list view
# ─────────────────────────────────────────────
class GymMemberListSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.name", read_only=True)
    member_email = serializers.EmailField(source="member.email", read_only=True)
    tier_name = serializers.CharField(source="tier.name", read_only=True)
    trainer_name = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = MemberEnrollment
        fields = [
            "id",
            "member_name",
            "member_email",
            "tier_name",
            "price_paid",
            "trainer_name",
            "start_date",
            "end_date",
            "days_remaining",
            "status",
        ]

    def get_trainer_name(self, obj):
        return obj.trainer.user.name if obj.trainer else "Unassigned"

    def get_days_remaining(self, obj):
        delta = obj.end_date - timezone.now().date()
        return max(delta.days, 0)
