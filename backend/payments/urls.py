from django.urls import path
from .views import (
    ConnectBankView,
    CreateOrderView,
    VerifyPaymentView,
    TransactionHistoryView,
    TransactionDetailView,
)

urlpatterns = [
    # ── Bank Onboarding ────────────────────────────────────────────────
    # POST { gym_id, account_number, ifsc_code }
    # Owner links their bank account to the FitGyldrah Razorpay marketplace.
    # Must be called ONCE before the gym can accept payments.
    path("connect-bank/", ConnectBankView.as_view(), name="payment-connect-bank"),
    # ── Payment flow ───────────────────────────────────────────────────
    # POST { enrollment_id }
    # Creates a Razorpay order with Route transfers (95% gym / 5% platform).
    path("create-order/", CreateOrderView.as_view(), name="payment-create-order"),
    # POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    # Verifies HMAC signature → activates enrollment atomically.
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    # ── History ────────────────────────────────────────────────────────
    # GET → member's full transaction history (?status=PENDING|SUCCESS|FAILED)
    path("history/", TransactionHistoryView.as_view(), name="payment-history"),
    # GET → single transaction detail
    path("history/<uuid:pk>/", TransactionDetailView.as_view(), name="payment-detail"),
]
