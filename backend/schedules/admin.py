from django.contrib import admin
from django.utils import timezone
from .models import Schedule


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "trainer",
        "member",
        "gym",
        "session_type",
        "proposed_time",
        "duration_minutes",
        "status",
        "responded_at",
    )
    list_filter = ("status", "session_type", "gym")
    search_fields = (
        "trainer__user__name",
        "trainer__user__email",
        "member__name",
        "member__email",
        "gym__name",
    )
    readonly_fields = (
        "id",
        "responded_at",
        "completed_at",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
    )
    ordering = ["proposed_time"]
    date_hierarchy = "proposed_time"
    actions = ["mark_completed"]

    def mark_completed(self, request, queryset):
        now = timezone.now()
        updated = queryset.filter(
            status=Schedule.Status.ACCEPTED,
            proposed_time__lte=now,
        ).update(
            status=Schedule.Status.COMPLETED,
            completed_at=now,
        )
        self.message_user(request, f"{updated} session(s) marked as completed.")

    mark_completed.short_description = "Mark selected accepted sessions as Completed"
