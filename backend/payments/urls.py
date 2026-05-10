from django.urls import path
from .views import (
    CreateOrderView,
    VerifyPaymentView,
    TransactionHistoryView,
    TransactionDetailView,
)

urlpatterns = [
    # ── Step 1: Member initiates payment ───────────────────────────────
    # POST { "enrollment_id": "<uuid>" }
    # Returns Razorpay order details for the frontend checkout modal.
    path("create-order/", CreateOrderView.as_view(), name="payment-create-order"),
    # ── Step 2: Frontend posts back after Razorpay checkout ────────────
    # POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    # Verifies signature → activates enrollment on success.
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    # ── Transaction history ────────────────────────────────────────────
    # GET  → member's full payment history  (?status=PENDING|SUCCESS|FAILED)
    path("history/", TransactionHistoryView.as_view(), name="payment-history"),
    # GET  → single transaction detail
    path("history/<uuid:pk>/", TransactionDetailView.as_view(), name="payment-detail"),
]
