from django.contrib import admin
from django.utils import timezone
from .models import MemberEnrollment


@admin.register(MemberEnrollment)
class MemberEnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "gym",
        "tier",
        "status",
        "start_date",
        "end_date",
        "price_paid",
        "trainer",
    )
    list_filter = ("status", "gym")
    search_fields = ("member__name", "member__email", "gym__name")
    readonly_fields = ("id", "price_paid", "created_at", "updated_at", "cancelled_at")
    raw_id_fields = ("member", "gym", "tier", "trainer")
    actions = ["mark_expired"]

    def mark_expired(self, request, queryset):
        today = timezone.now().date()
        updated = queryset.filter(
            status=MemberEnrollment.Status.ACTIVE,
            end_date__lt=today,
        ).update(status=MemberEnrollment.Status.EXPIRED)
        self.message_user(request, f"{updated} enrollment(s) marked as expired.")

    mark_expired.short_description = "Mark overdue enrollments as Expired"
