from django.contrib import admin
from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "status",
        "amount",
        "platform_fee_amount",
        "gym_transfer_amount",
        "razorpay_order_id",
        "razorpay_payment_id",
        "created_at",
    )
    list_filter = ("status", "currency", "platform_fee_pct")
    search_fields = (
        "user__name",
        "user__email",
        "razorpay_order_id",
        "razorpay_payment_id",
    )
    readonly_fields = (
        "id",
        "user",
        "enrollment",
        "amount",
        "currency",
        "platform_fee_pct",
        "platform_fee_amount",
        "gym_transfer_amount",
        "razorpay_order_id",
        "razorpay_payment_id",
        "razorpay_signature",
        "failure_reason",
        "created_at",
        "updated_at",
    )
    ordering = ["-created_at"]

    fieldsets = (
        (
            "Overview",
            {
                "fields": ("id", "user", "enrollment", "status", "failure_reason"),
            },
        ),
        (
            "Amount & Split",
            {
                "fields": (
                    "amount",
                    "currency",
                    "platform_fee_pct",
                    "platform_fee_amount",
                    "gym_transfer_amount",
                ),
            },
        ),
        (
            "Razorpay",
            {
                "fields": (
                    "razorpay_order_id",
                    "razorpay_payment_id",
                    "razorpay_signature",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    def has_add_permission(self, request):
        # Transactions are created exclusively via the API
        return False

    def has_delete_permission(self, request, obj=None):
        # Transactions are an immutable financial audit trail
        return False
