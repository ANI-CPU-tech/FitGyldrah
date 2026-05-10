from rest_framework import serializers
from members.models import MemberEnrollment
from .models import Transaction


# ─────────────────────────────────────────────
# Order Creation — member initiates payment
# ─────────────────────────────────────────────
class OrderCreateSerializer(serializers.Serializer):
    enrollment_id = serializers.UUIDField()

    def validate_enrollment_id(self, value):
        request = self.context["request"]

        # Enrollment must exist and belong to the requesting user
        try:
            enrollment = MemberEnrollment.objects.select_related("tier", "gym").get(
                pk=value, member=request.user
            )
        except MemberEnrollment.DoesNotExist:
            raise serializers.ValidationError(
                "Enrollment not found or does not belong to you."
            )

        # Block payment if enrollment is already active
        if enrollment.status == MemberEnrollment.Status.ACTIVE:
            raise serializers.ValidationError(
                "This enrollment is already active. No payment needed."
            )

        # Block if a successful transaction already exists for this enrollment
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
# Payment Verification — frontend posts back
# after Razorpay checkout completes
# ─────────────────────────────────────────────
class PaymentVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()

    def validate_razorpay_order_id(self, value):
        request = self.context["request"]

        # Must match a PENDING transaction owned by this user
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
# Read — transaction history
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
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "status_label",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        # Never expose the raw signature to clients
        read_only_fields = fields
