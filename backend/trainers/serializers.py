from rest_framework import serializers
from django.utils import timezone

from .models import TrainerProfile, GymApplication


# ─────────────────────────────────────────────
# Trainer Profile
# ─────────────────────────────────────────────
class TrainerProfileReadSerializer(serializers.ModelSerializer):
    """Full public-facing trainer card."""

    name = serializers.CharField(source="user.name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    profile_picture = serializers.ImageField(read_only=True)
    cv_file = serializers.FileField(read_only=True)

    class Meta:
        model = TrainerProfile
        fields = [
            "id",
            "name",
            "email",
            "certifications",
            "years_experience",
            "specialty",
            "bio",
            "cv_file",
            "profile_picture",
            "is_available",
            "created_at",
            "updated_at",
        ]


class TrainerProfileWriteSerializer(serializers.ModelSerializer):
    """
    Trainer updates their own profile.
    CV and profile picture handled as multipart uploads.
    """

    class Meta:
        model = TrainerProfile
        fields = [
            "certifications",
            "years_experience",
            "specialty",
            "bio",
            "cv_file",
            "profile_picture",
            "is_available",
        ]

    def validate_years_experience(self, value):
        if value < 0:
            raise serializers.ValidationError("Years of experience cannot be negative.")
        return value

    def validate_cv_file(self, value):
        if value:
            ext = value.name.split(".")[-1].lower()
            if ext not in ["pdf", "doc", "docx"]:
                raise serializers.ValidationError("CV must be a PDF or Word document.")
            # 5 MB limit
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("CV file must be under 5MB.")
        return value

    def validate_profile_picture(self, value):
        if value:
            ext = value.name.split(".")[-1].lower()
            if ext not in ["jpg", "jpeg", "png", "webp"]:
                raise serializers.ValidationError(
                    "Profile picture must be JPG, PNG, or WEBP."
                )
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("Profile picture must be under 2MB.")
        return value


# ─────────────────────────────────────────────
# Gym Application
# ─────────────────────────────────────────────
class GymApplicationReadSerializer(serializers.ModelSerializer):
    """For owner's review panel — shows full trainer details."""

    trainer_name = serializers.CharField(source="trainer.user.name", read_only=True)
    trainer_email = serializers.EmailField(source="trainer.user.email", read_only=True)
    trainer_specialty = serializers.CharField(
        source="trainer.specialty", read_only=True
    )
    trainer_experience = serializers.IntegerField(
        source="trainer.years_experience", read_only=True
    )
    trainer_cv = serializers.FileField(source="trainer.cv_file", read_only=True)
    gym_name = serializers.CharField(source="gym.name", read_only=True)

    class Meta:
        model = GymApplication
        fields = [
            "id",
            "gym_name",
            "trainer_name",
            "trainer_email",
            "trainer_specialty",
            "trainer_experience",
            "trainer_cv",
            "cover_letter",
            "status",
            "owner_note",
            "applied_at",
            "reviewed_at",
        ]


class GymApplicationCreateSerializer(serializers.ModelSerializer):
    """Trainer submits an application to a gym."""

    class Meta:
        model = GymApplication
        fields = ["gym", "cover_letter"]

    def validate(self, attrs):
        request = self.context["request"]
        trainer = request.user.trainer_profile
        gym = attrs["gym"]

        # Block duplicate pending application
        if GymApplication.objects.filter(
            trainer=trainer, gym=gym, status=GymApplication.Status.PENDING
        ).exists():
            raise serializers.ValidationError(
                "You already have a pending application for this gym."
            )

        # Block re-applying to a gym where already approved
        if GymApplication.objects.filter(
            trainer=trainer, gym=gym, status=GymApplication.Status.APPROVED
        ).exists():
            raise serializers.ValidationError("You are already approved at this gym.")

        return attrs


class ApplicationReviewSerializer(serializers.Serializer):
    """Owner approves or rejects an application."""

    action = serializers.ChoiceField(choices=["approve", "reject"])
    owner_note = serializers.CharField(required=False, allow_blank=True, default="")

    def save(self, application):
        action = self.validated_data["action"]
        application.status = (
            GymApplication.Status.APPROVED
            if action == "approve"
            else GymApplication.Status.REJECTED
        )
        application.owner_note = self.validated_data.get("owner_note", "")
        application.reviewed_at = timezone.now()
        application.save(update_fields=["status", "owner_note", "reviewed_at"])
        return application
