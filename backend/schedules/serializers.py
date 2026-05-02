from rest_framework import serializers
from django.utils import timezone

from .models import Schedule


# ─────────────────────────────────────────────
# Read
# ─────────────────────────────────────────────
class ScheduleReadSerializer(serializers.ModelSerializer):
    trainer_name = serializers.CharField(source="trainer.user.name", read_only=True)
    trainer_email = serializers.EmailField(source="trainer.user.email", read_only=True)
    member_name = serializers.CharField(source="member.name", read_only=True)
    member_email = serializers.EmailField(source="member.email", read_only=True)
    gym_name = serializers.CharField(source="gym.name", read_only=True)
    end_time = serializers.DateTimeField(read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    session_type_label = serializers.CharField(
        source="get_session_type_display", read_only=True
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Schedule
        fields = [
            "id",
            "trainer_name",
            "trainer_email",
            "member_name",
            "member_email",
            "gym_name",
            "session_type",
            "session_type_label",
            "proposed_time",
            "duration_minutes",
            "end_time",
            "location",
            "notes",
            "status",
            "status_label",
            "member_note",
            "is_upcoming",
            "responded_at",
            "completed_at",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        ]


# ─────────────────────────────────────────────
# Create — trainer proposes a slot
# ─────────────────────────────────────────────
class ScheduleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            "member",
            "gym",
            "session_type",
            "proposed_time",
            "duration_minutes",
            "location",
            "notes",
        ]

    def validate_proposed_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Proposed time must be in the future.")
        return value

    def validate_duration_minutes(self, value):
        if not (15 <= value <= 240):
            raise serializers.ValidationError(
                "Duration must be between 15 and 240 minutes."
            )
        return value

    def validate(self, attrs):
        trainer = self.context["request"].user.trainer_profile
        member = attrs["member"]
        gym = attrs["gym"]

        # ── Trainer must be approved at the chosen gym ──────────────
        from trainers.models import GymApplication

        if not GymApplication.objects.filter(
            trainer=trainer,
            gym=gym,
            status=GymApplication.Status.APPROVED,
        ).exists():
            raise serializers.ValidationError(
                {"gym": "You are not an approved trainer at this gym."}
            )

        # ── Member must be actively enrolled at the same gym ────────
        from members.models import MemberEnrollment

        if not MemberEnrollment.objects.filter(
            member=member,
            gym=gym,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise serializers.ValidationError(
                {
                    "member": "This member does not have an active enrollment at the chosen gym."
                }
            )

        # ── No overlapping PENDING/ACCEPTED slot for this trainer ───
        proposed_time = attrs["proposed_time"]
        duration_minutes = attrs.get("duration_minutes", 60)
        from datetime import timedelta

        proposed_end = proposed_time + timedelta(minutes=duration_minutes)

        conflict = Schedule.objects.filter(
            trainer=trainer,
            status__in=[Schedule.Status.PENDING, Schedule.Status.ACCEPTED],
        ).exclude(pk=self.instance.pk if self.instance else None)

        for existing in conflict:
            if (
                proposed_time < existing.end_time
                and proposed_end > existing.proposed_time
            ):
                raise serializers.ValidationError(
                    {
                        "proposed_time": (
                            f"Time slot conflicts with another session at "
                            f"{existing.proposed_time:%Y-%m-%d %H:%M}."
                        )
                    }
                )

        attrs["trainer"] = trainer
        return attrs


# ─────────────────────────────────────────────
# Update — trainer edits a PENDING schedule
# ─────────────────────────────────────────────
class ScheduleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            "session_type",
            "proposed_time",
            "duration_minutes",
            "location",
            "notes",
        ]

    def validate_proposed_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Proposed time must be in the future.")
        return value

    def validate(self, attrs):
        if self.instance.status != Schedule.Status.PENDING:
            raise serializers.ValidationError("Only PENDING schedules can be edited.")
        return attrs


# ─────────────────────────────────────────────
# Member responds — accept or reject
# ─────────────────────────────────────────────
class ScheduleRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["accept", "reject"])
    member_note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        schedule = self.context["schedule"]
        if schedule.status != Schedule.Status.PENDING:
            raise serializers.ValidationError(
                f"Cannot respond — schedule is already {schedule.status}."
            )
        if schedule.proposed_time <= timezone.now():
            raise serializers.ValidationError(
                "Cannot respond to a schedule whose proposed time has already passed."
            )
        return attrs

    def save(self):
        schedule = self.context["schedule"]
        action = self.validated_data["action"]
        member_note = self.validated_data.get("member_note", "")
        if action == "accept":
            schedule.accept(member_note)
        else:
            schedule.reject(member_note)
        return schedule
