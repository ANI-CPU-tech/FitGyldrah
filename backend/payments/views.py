import logging
import math
import uuid

import razorpay
from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from authentication.permissions import IsOwner
from gyms.models import Gym
from members.models import MemberEnrollment
from .models import Transaction
from .serializers import (
    ConnectBankSerializer,
    OrderCreateSerializer,
    PaymentVerifySerializer,
    TransactionReadSerializer,
)

logger = logging.getLogger(__name__)


# ── Shared Razorpay client ──────────────────────────────────────────────────


def _get_razorpay_client() -> razorpay.Client:
    """
    Returns the FitGyldrah platform-level Razorpay client.
    Uses the global keys from settings — not any gym-specific keys.
    """
    key_id = getattr(settings, "RAZORPAY_KEY_ID", "")
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")

    if not key_id or not key_secret:
        raise RuntimeError(
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in settings."
        )

    return razorpay.Client(auth=(key_id, key_secret))


def _compute_split(amount_paise: int, fee_pct: int) -> tuple[int, int]:
    """
    Returns (platform_fee_paise, gym_transfer_paise).
    Uses math.ceil on the fee so we never transfer more than we collect.
    """
    platform_fee = math.ceil(amount_paise * fee_pct / 100)
    gym_transfer = amount_paise - platform_fee
    return platform_fee, gym_transfer


# ══════════════════════════════════════════════
#  BANK ONBOARDING — Gym Owner connects bank (MOCKED FOR DEMO)
# ══════════════════════════════════════════════


class ConnectBankView(APIView):
    """
    POST /api/payments/connect-bank/

    Gym owner submits their bank details to link their account to the
    FitGyldrah Razorpay Route marketplace.

    *NOTE: MOCKED FOR DBMS PROJECT DEMO TO BYPASS RAZORPAY KYC*
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def post(self, request):
        # ── Validate gym ownership ─────────────────────────────────────
        gym_id = request.data.get("gym_id")
        if not gym_id:
            return Response(
                {"detail": "gym_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            gym = Gym.objects.select_related("owner").get(pk=gym_id)
        except Gym.DoesNotExist:
            raise NotFound("Gym not found.")

        if gym.owner != request.user:
            raise PermissionDenied("You are not the owner of this gym.")

        # ── Block re-linking if already connected ──────────────────────
        if gym.razorpay_linked_account_id:
            return Response(
                {
                    "detail": "This gym already has a linked bank account.",
                    "linked_account_hint": f"acc_••••••{gym.razorpay_linked_account_id[-6:]}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate bank details (to ensure realistic flow) ───────────
        serializer = ConnectBankSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # ── MOCK THE RAZORPAY API CALL ─────────────────────────────────
        # Generate a realistic-looking fake Razorpay account ID
        mock_account_id = f"acc_mock_{uuid.uuid4().hex[:10]}"

        # Save it to our database
        gym.razorpay_linked_account_id = mock_account_id
        gym.save(update_fields=["razorpay_linked_account_id", "updated_at"])

        logger.info(
            f"[Payments] Bank linked (MOCKED): gym={gym.id} "
            f"account={mock_account_id} owner={request.user.email}"
        )

        return Response(
            {
                "detail": (
                    f"Bank account successfully linked to '{gym.name}'. "
                    "The gym can now accept member payments."
                ),
                "gym_id": str(gym.id),
                "linked_account_hint": f"acc_••••••{mock_account_id[-6:]}",
                "is_payment_ready": True,
            },
            status=status.HTTP_200_OK,
        )


# ══════════════════════════════════════════════
#  STEP 1 — Create Razorpay Order with Route
# ══════════════════════════════════════════════


class CreateOrderView(APIView):
    """
    POST /api/payments/create-order/

    Member initiates payment for a pending enrollment.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = OrderCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        enrollment = serializer.enrollment
        gym = enrollment.gym

        # ── Guard: gym must have a linked bank account ─────────────────
        if not gym.is_payment_ready:
            return Response(
                {
                    "detail": (
                        f"'{gym.name}' has not completed bank onboarding. "
                        "Payments are not yet available for this gym. "
                        "Please contact the gym owner."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = _get_razorpay_client()
        fee_pct = getattr(settings, "RAZORPAY_PLATFORM_FEE_PCT", 5)
        amount_paise = int(enrollment.price_paid * 100)

        # We still calculate the split for our database schema!
        platform_fee_paise, gym_transfer_paise = _compute_split(amount_paise, fee_pct)

        logger.info(
            f"[Payments] Order split: total=₹{enrollment.price_paid} "
            f"platform=₹{platform_fee_paise / 100:.2f} ({fee_pct}%) "
            f"gym=₹{gym_transfer_paise / 100:.2f} ({100 - fee_pct}%) "
            f"linked_account={gym.razorpay_linked_account_id}"
        )

        # ── Build normal order payload (Without Route Transfers) ───────
        order_payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": str(enrollment.id),
            "payment_capture": 1,
            # We removed the 'transfers' array to bypass Razorpay's KYC block
            "notes": {
                "gym_name": gym.name,
                "tier_name": enrollment.tier.name,
                "member_email": request.user.email,
                "platform_fee": f"{fee_pct}%",
            },
        }

        try:
            rz_order = client.order.create(order_payload)
        except razorpay.errors.BadRequestError as exc:
            logger.error(f"[Payments] Razorpay order creation failed: {exc}")
            return Response(
                {"detail": f"Razorpay error: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error(f"[Payments] Unexpected error during order creation: {exc}")
            return Response(
                {"detail": "Payment gateway error. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── Create PENDING transaction with split details ───────────────
        txn = Transaction.objects.create(
            user=request.user,
            enrollment=enrollment,
            amount=enrollment.price_paid,
            currency="INR",
            razorpay_order_id=rz_order["id"],
            status=Transaction.Status.PENDING,
            platform_fee_pct=fee_pct,
            platform_fee_amount=round(platform_fee_paise / 100, 2),
            gym_transfer_amount=round(gym_transfer_paise / 100, 2),
        )

        logger.info(
            f"[Payments] Order created: rz_order={rz_order['id']} "
            f"txn={txn.id} user={request.user.email}"
        )

        return Response(
            {
                "razorpay_order_id": rz_order["id"],
                "amount": amount_paise,
                "currency": "INR",
                "razorpay_key_id": settings.RAZORPAY_KEY_ID,
                "transaction_id": str(txn.id),
                "split": {
                    "platform_fee_pct": fee_pct,
                    "platform_fee_inr": str(txn.platform_fee_amount),
                    "gym_transfer_inr": str(txn.gym_transfer_amount),
                },
                "prefill": {
                    "name": request.user.name,
                    "email": request.user.email,
                },
                "description": f"{enrollment.tier.name} — {gym.name}",
            },
            status=status.HTTP_201_CREATED,
        )


# ══════════════════════════════════════════════
#  STEP 2 — Verify Payment Signature
# ══════════════════════════════════════════════


class VerifyPaymentView(APIView):
    """
    POST /api/payments/verify/

    Called by the frontend after Razorpay checkout modal succeeds.
    Verifies the HMAC-SHA256 signature using global platform keys,
    then atomically marks the Transaction SUCCESS and activates the enrollment.

    Request body:
        {
            "razorpay_order_id":   "order_XXXXXXXXXX",
            "razorpay_payment_id": "pay_XXXXXXXXXX",
            "razorpay_signature":  "<hmac>"
        }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentVerifySerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        txn = serializer.transaction
        client = _get_razorpay_client()

        # ── HMAC-SHA256 signature verification ────────────────────────
        params = {
            "razorpay_order_id": request.data["razorpay_order_id"],
            "razorpay_payment_id": request.data["razorpay_payment_id"],
            "razorpay_signature": request.data["razorpay_signature"],
        }

        try:
            client.utility.verify_payment_signature(params)
        except razorpay.errors.SignatureVerificationError:
            logger.warning(
                f"[Payments] Signature FAILED "
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
                # 1. Mark transaction SUCCESS
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
                    "detail": (
                        "Payment verified but failed to activate enrollment. "
                        "Please contact support with your order ID: "
                        f"{params['razorpay_order_id']}"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            f"[Payments] Payment SUCCESS: "
            f"order={txn.razorpay_order_id} "
            f"payment={txn.razorpay_payment_id} "
            f"user={request.user.email} "
            f"enrollment={enrollment.id} "
            f"active_until={end_date} "
            f"platform_fee=₹{txn.platform_fee_amount} "
            f"gym_transfer=₹{txn.gym_transfer_amount}"
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
    Member views their full payment history.
    ?status=PENDING|SUCCESS|FAILED
    """

    serializer_class = TransactionReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Transaction.objects.filter(user=self.request.user).select_related(
            "enrollment__gym", "enrollment__tier"
        )
        status_f = self.request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f.upper())
        return qs


class TransactionDetailView(generics.RetrieveAPIView):
    """
    GET /api/payments/history/{id}/
    Member views a specific transaction in full.
    """

    serializer_class = TransactionReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related(
            "enrollment__gym", "enrollment__tier"
        )
