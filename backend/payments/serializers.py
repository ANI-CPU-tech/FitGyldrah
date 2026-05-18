from rest_framework import serializers
from members.models import MemberEnrollment
from .models import Transaction


# ─────────────────────────────────────────────
# Bank Connect — owner onboarding
# ─────────────────────────────────────────────
class ConnectBankSerializer(serializers.Serializer):
    """
    Accepts bank details from the gym owner to create a
    Razorpay Route linked account.
    """

    account_number = serializers.CharField(max_length=30)
    ifsc_code = serializers.CharField(max_length=11)

    def validate_ifsc_code(self, value):
        value = value.strip().upper()
        if len(value) != 11:
            raise serializers.ValidationError(
                "IFSC code must be exactly 11 characters."
            )
        return value

    def validate_account_number(self, value):
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError(
                "Account number must contain digits only."
            )
        if not (9 <= len(value) <= 18):
            raise serializers.ValidationError(
                "Account number must be between 9 and 18 digits."
            )
        return value


# ─────────────────────────────────────────────
# Order Creation
# ─────────────────────────────────────────────
class OrderCreateSerializer(serializers.Serializer):
    enrollment_id = serializers.UUIDField()

    def validate_enrollment_id(self, value):
        request = self.context["request"]

        try:
            enrollment = MemberEnrollment.objects.select_related("tier", "gym").get(
                pk=value, member=request.user
            )
        except MemberEnrollment.DoesNotExist:
            raise serializers.ValidationError(
                "Enrollment not found or does not belong to you."
            )

        if enrollment.status == MemberEnrollment.Status.ACTIVE:
            raise serializers.ValidationError(
                "This enrollment is already active. No payment needed."
            )

        if Transaction.objects.filter(
            enrollment=enrollment,
            status=Transaction.Status.SUCCESS,
        ).exists():
            raise serializers.ValidationError(
                "A successful payment already exists for this enrollment."
            )

        self._enrollment = enrollment
        return value

    @property
    def enrollment(self):
        return self._enrollment


# ─────────────────────────────────────────────
# Payment Verification
# ─────────────────────────────────────────────
class PaymentVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()

    def validate_razorpay_order_id(self, value):
        request = self.context["request"]
        try:
            txn = Transaction.objects.select_related(
                "enrollment__tier", "enrollment__gym"
            ).get(
                razorpay_order_id=value,
                user=request.user,
                status=Transaction.Status.PENDING,
            )
        except Transaction.DoesNotExist:
            raise serializers.ValidationError(
                "No pending transaction found for this order ID."
            )
        self._transaction = txn
        return value

    @property
    def transaction(self):
        return self._transaction


# ─────────────────────────────────────────────
# Transaction read — payment history
# ─────────────────────────────────────────────
class TransactionReadSerializer(serializers.ModelSerializer):
    gym_name = serializers.CharField(source="enrollment.gym.name", read_only=True)
    tier_name = serializers.CharField(source="enrollment.tier.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "gym_name",
            "tier_name",
            "amount",
            "currency",
            "platform_fee_pct",
            "platform_fee_amount",
            "gym_transfer_amount",
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "status_label",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
