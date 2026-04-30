from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Role


# ──────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = [
            "email",
            "name",
            "password",
            "password2",
            "height",
            "weight",
            "body_fat_pct",
            "goals",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


# ──────────────────────────────────────────────
# Me (read + update own profile)
# ──────────────────────────────────────────────
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "height",
            "weight",
            "body_fat_pct",
            "goals",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "email",
            "role",
            "is_active",
            "created_at",
            "updated_at",
        ]


# ──────────────────────────────────────────────
# Role Claim
# ──────────────────────────────────────────────
class RoleClaimSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_role(self, value):
        user = self.context["request"].user
        # Prevent downgrading from OWNER/TRAINER back to MEMBER
        if user.role != Role.MEMBER:
            raise serializers.ValidationError(
                f"Role is already set to {user.role} and cannot be changed here."
            )
        return value

    def save(self):
        user = self.context["request"].user
        user.role = self.validated_data["role"]
        user.save(update_fields=["role"])
        return user
