from rest_framework import serializers
from .models import FitnessPlan


# ─────────────────────────────────────────────────────────
# Shared content_json validators
# ─────────────────────────────────────────────────────────


def validate_diet_content(data):
    """
    Expected shape:
    {
      "meals": [
        {
          "name": "Breakfast",
          "time": "08:00",
          "calories": 600,
          "items": ["Oats", "Banana", "Milk"]
        }
      ],
      "daily_calories": 2200,
      "macros": { "protein": 150, "carbs": 220, "fat": 70 }
    }
    """
    if not isinstance(data, dict):
        raise serializers.ValidationError("Diet content must be a JSON object.")
    if "meals" not in data or not isinstance(data["meals"], list):
        raise serializers.ValidationError("Diet plan must include a 'meals' list.")
    for i, meal in enumerate(data["meals"]):
        if not isinstance(meal, dict) or "name" not in meal:
            raise serializers.ValidationError(
                f"Meal at index {i} must be an object with a 'name'."
            )
    return data


def validate_workout_content(data):
    """
    Expected shape:
    {
      "days": [
        {
          "day": "Monday",
          "focus": "Chest & Triceps",
          "exercises": [
            { "name": "Bench Press", "sets": 4, "reps": "8-10", "rest": "90s" }
          ]
        }
      ]
    }
    """
    if not isinstance(data, dict):
        raise serializers.ValidationError("Workout content must be a JSON object.")
    if "days" not in data or not isinstance(data["days"], list):
        raise serializers.ValidationError("Workout plan must include a 'days' list.")
    for i, day in enumerate(data["days"]):
        if not isinstance(day, dict) or "day" not in day:
            raise serializers.ValidationError(
                f"Day at index {i} must have a 'day' field."
            )
        if "exercises" not in day or not isinstance(day["exercises"], list):
            raise serializers.ValidationError(
                f"Day '{day.get('day', i)}' must have an 'exercises' list."
            )
    return data


# ─────────────────────────────────────────────────────────
# Read
# ─────────────────────────────────────────────────────────


class FitnessPlanReadSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source="trainer.user.name", read_only=True)
    trainer_email = serializers.EmailField(source="trainer.user.email", read_only=True)
    member_name = serializers.CharField(source="member.name", read_only=True)
    plan_type_label = serializers.CharField(
        source="get_plan_type_display", read_only=True
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = FitnessPlan
        fields = [
            "id",
            "title",
            "plan_type",
            "plan_type_label",
            "trainer_name",
            "trainer_email",
            "member_name",
            "content_json",
            "notes",
            "ai_generated",
            "ai_task_id",
            "status",
            "status_label",
            "version",
            "approved_at",
            "created_at",
            "updated_at",
        ]


# ─────────────────────────────────────────────────────────
# Create — trainer manually writes a plan
# ─────────────────────────────────────────────────────────


class FitnessPlanCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FitnessPlan
        fields = ["member", "plan_type", "title", "content_json", "notes"]

    def validate_content_json(self, value):
        # Will be re-called per plan_type in validate()
        return value

    def validate(self, attrs):
        request = self.context["request"]
        trainer = request.user.trainer_profile
        member = attrs["member"]
        plan_type = attrs["plan_type"]

        # Validate content structure matches plan type
        content = attrs["content_json"]
        if plan_type == FitnessPlan.PlanType.DIET:
            validate_diet_content(content)
        elif plan_type == FitnessPlan.PlanType.WORKOUT:
            validate_workout_content(content)

        # Trainer must have this member assigned (active enrollment with them)
        from members.models import MemberEnrollment

        if not MemberEnrollment.objects.filter(
            member=member,
            trainer=trainer,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise serializers.ValidationError(
                {"member": "This member is not assigned to you."}
            )

        attrs["trainer"] = trainer
        attrs["version"] = FitnessPlan.next_version(trainer, member, plan_type)
        return attrs

    def create(self, validated_data):
        return FitnessPlan.objects.create(**validated_data)


# ─────────────────────────────────────────────────────────
# Update — trainer edits a DRAFT plan
# ─────────────────────────────────────────────────────────


class FitnessPlanUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FitnessPlan
        fields = ["title", "content_json", "notes"]

    def validate(self, attrs):
        plan = self.instance
        if plan.status != FitnessPlan.Status.DRAFT:
            raise serializers.ValidationError(
                f"Only DRAFT plans can be edited. This plan is {plan.status}."
            )
        # Re-validate content shape if being updated
        if "content_json" in attrs:
            if plan.plan_type == FitnessPlan.PlanType.DIET:
                validate_diet_content(attrs["content_json"])
            elif plan.plan_type == FitnessPlan.PlanType.WORKOUT:
                validate_workout_content(attrs["content_json"])
        return attrs


# ─────────────────────────────────────────────────────────
# AI Generation trigger
# ─────────────────────────────────────────────────────────


class AIGeneratePlanSerializer(serializers.Serializer):
    member_id = serializers.UUIDField()
    plan_type = serializers.ChoiceField(choices=FitnessPlan.PlanType.choices)
    extra_instructions = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Additional context for the AI e.g. 'avoid dairy', 'focus on upper body'",
    )

    def validate_member_id(self, value):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            member = User.objects.get(pk=value, role="MEMBER")
        except User.DoesNotExist:
            raise serializers.ValidationError("Member not found.")
        self._member = member
        return value

    def validate(self, attrs):
        request = self.context["request"]
        trainer = request.user.trainer_profile
        member = self._member

        from members.models import MemberEnrollment

        if not MemberEnrollment.objects.filter(
            member=member,
            trainer=trainer,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise serializers.ValidationError(
                {"member_id": "This member is not assigned to you."}
            )

        attrs["member"] = member
        attrs["trainer"] = trainer
        return attrs
