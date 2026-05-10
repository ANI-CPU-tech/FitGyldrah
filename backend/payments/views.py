import logging

import razorpay
from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from members.models import MemberEnrollment
from .models import Transaction
from .serializers import (
    OrderCreateSerializer,
    PaymentVerifySerializer,
    TransactionReadSerializer,
)

logger = logging.getLogger(__name__)


# ── Razorpay client singleton ──────────────────────────────────────────────


def _get_razorpay_client() -> razorpay.Client:
    """
    Returns an authenticated Razorpay client using test keys from settings.
    Raises ImproperlyConfigured if keys are missing.
    """
    key_id = getattr(settings, "RAZORPAY_KEY_ID", None)
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", None)

    if not key_id or not key_secret:
        raise ValidationError(
            "Razorpay keys are not configured. "
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in settings."
        )

    return razorpay.Client(auth=(key_id, key_secret))


# ══════════════════════════════════════════════
#  STEP 1 — Create a Razorpay Order
# ══════════════════════════════════════════════


class CreateOrderView(APIView):
    """
    POST /api/payments/create-order/

    Member initiates payment for a pending enrollment.
    Returns the Razorpay order details needed by the frontend
    to open the Razorpay checkout modal.

    Request body:
        { "enrollment_id": "<uuid>" }

    Response:
        {
            "razorpay_order_id": "order_XXXXXXXXXX",
            "amount":            <amount in paise>,
            "currency":          "INR",
            "razorpay_key_id":   "<test key — safe to expose to frontend>",
            "transaction_id":    "<our internal UUID>",
            "prefill": {
                "name":  "<member name>",
                "email": "<member email>"
            }
        }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = OrderCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        enrollment = serializer.enrollment

        client = _get_razorpay_client()

        # Amount must be in paise (INR smallest unit)
        amount_paise = int(enrollment.price_paid * 100)

        # Create order on Razorpay
        try:
            rz_order = client.order.create(
                {
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": str(enrollment.id),  # our internal reference
                    "payment_capture": 1,  # auto-capture on success
                    "notes": {
                        "gym_name": enrollment.gym.name,
                        "tier_name": enrollment.tier.name,
                        "member_email": request.user.email,
                    },
                }
            )
        except razorpay.errors.BadRequestError as exc:
            logger.error(f"[Payments] Razorpay order creation failed: {exc}")
            return Response(
                {"detail": f"Razorpay error: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error(f"[Payments] Unexpected Razorpay error: {exc}")
            return Response(
                {"detail": "Payment gateway error. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create a PENDING transaction in our DB
        txn = Transaction.objects.create(
            user=request.user,
            enrollment=enrollment,
            amount=enrollment.price_paid,
            currency="INR",
            razorpay_order_id=rz_order["id"],
            status=Transaction.Status.PENDING,
        )

        logger.info(
            f"[Payments] Order created: rz_order={rz_order['id']} "
            f"txn={txn.id} user={request.user.email} "
            f"amount=₹{enrollment.price_paid}"
        )

        return Response(
            {
                "razorpay_order_id": rz_order["id"],
                "amount": amount_paise,
                "currency": "INR",
                "razorpay_key_id": settings.RAZORPAY_KEY_ID,
                "transaction_id": str(txn.id),
                "prefill": {
                    "name": request.user.name,
                    "email": request.user.email,
                },
                "description": (f"{enrollment.tier.name} — {enrollment.gym.name}"),
            },
            status=status.HTTP_201_CREATED,
        )


# ══════════════════════════════════════════════
#  STEP 2 — Verify Payment Signature
# ══════════════════════════════════════════════


class VerifyPaymentView(APIView):
    """
    POST /api/payments/verify/

    Called by the frontend AFTER the Razorpay checkout modal succeeds.
    Razorpay sends back three values which we use to cryptographically
    verify the payment is genuine (HMAC-SHA256 over order_id + payment_id).

    Request body:
        {
            "razorpay_order_id":   "order_XXXXXXXXXX",
            "razorpay_payment_id": "pay_XXXXXXXXXX",
            "razorpay_signature":  "<hmac>"
        }

    On success:
        - Transaction marked SUCCESS
        - MemberEnrollment status → ACTIVE
        - Enrollment start_date + end_date computed from today + tier duration

    On failure:
        - Transaction marked FAILED
        - Enrollment remains unchanged
        - 400 returned to client
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentVerifySerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        txn = serializer.transaction

        client = _get_razorpay_client()

        # ── Cryptographic signature verification ───────────────────────
        params = {
            "razorpay_order_id": request.data["razorpay_order_id"],
            "razorpay_payment_id": request.data["razorpay_payment_id"],
            "razorpay_signature": request.data["razorpay_signature"],
        }

        try:
            client.utility.verify_payment_signature(params)
        except razorpay.errors.SignatureVerificationError:
            # Signature mismatch — could be a spoofed request
            logger.warning(
                f"[Payments] Signature verification FAILED "
                f"order={params['razorpay_order_id']} "
                f"user={request.user.email}"
            )
            txn.status = Transaction.Status.FAILED
            txn.failure_reason = "Razorpay signature verification failed."
            txn.save(update_fields=["status", "failure_reason", "updated_at"])

            return Response(
                {"detail": "Payment verification failed. Possible tampered request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Atomic: update Transaction + activate Enrollment ───────────
        try:
            with db_transaction.atomic():
                # 1. Mark transaction as SUCCESS
                txn.razorpay_payment_id = params["razorpay_payment_id"]
                txn.razorpay_signature = params["razorpay_signature"]
                txn.status = Transaction.Status.SUCCESS
                txn.save(
                    update_fields=[
                        "razorpay_payment_id",
                        "razorpay_signature",
                        "status",
                        "updated_at",
                    ]
                )

                # 2. Activate the enrollment + compute billing dates
                enrollment = txn.enrollment
                start_date = timezone.now().date()
                end_date = MemberEnrollment.compute_end_date(
                    start_date,
                    enrollment.tier.duration_type,
                )
                enrollment.status = MemberEnrollment.Status.ACTIVE
                enrollment.start_date = start_date
                enrollment.end_date = end_date
                enrollment.save(
                    update_fields=["status", "start_date", "end_date", "updated_at"]
                )

        except Exception as exc:
            logger.error(f"[Payments] DB update failed after verification: {exc}")
            return Response(
                {
                    "detail": "Payment verified but failed to activate enrollment. Contact support."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            f"[Payments] Payment SUCCESS: "
            f"order={txn.razorpay_order_id} "
            f"payment={txn.razorpay_payment_id} "
            f"user={request.user.email} "
            f"enrollment={enrollment.id} "
            f"active until {end_date}"
        )

        return Response(
            {
                "detail": "Payment successful. Enrollment is now active.",
                "transaction": TransactionReadSerializer(txn).data,
                "enrollment": {
                    "id": str(enrollment.id),
                    "status": enrollment.status,
                    "start_date": str(enrollment.start_date),
                    "end_date": str(enrollment.end_date),
                    "gym": enrollment.gym.name,
                    "tier": enrollment.tier.name,
                },
            },
            status=status.HTTP_200_OK,
        )


# ══════════════════════════════════════════════
#  TRANSACTION HISTORY
# ══════════════════════════════════════════════


class TransactionHistoryView(generics.ListAPIView):
    """
    GET /api/payments/history/
    Member views their full payment history across all enrollments.
    ?status=PENDING|SUCCESS|FAILED
    """

    serializer_class = TransactionReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Transaction.objects.filter(user=self.request.user).select_related(
            "enrollment__gym",
            "enrollment__tier",
        )
        status_f = self.request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f.upper())
        return qs


class TransactionDetailView(generics.RetrieveAPIView):
    """
    GET /api/payments/history/{id}/
    Member views a specific transaction.
    """

    serializer_class = TransactionReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related(
            "enrollment__gym", "enrollment__tier"
        )
