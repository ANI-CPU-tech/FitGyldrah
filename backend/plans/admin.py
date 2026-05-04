from django.contrib import admin
from django.utils import timezone
from .models import FitnessPlan


@admin.register(FitnessPlan)
class FitnessPlanAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "plan_type",
        "trainer",
        "member",
        "status",
        "ai_generated",
        "version",
        "approved_at",
        "created_at",
    )
    list_filter = ("status", "plan_type", "ai_generated")
    search_fields = (
        "title",
        "trainer__user__name",
        "trainer__user__email",
        "member__name",
        "member__email",
    )
    readonly_fields = (
        "id",
        "ai_task_id",
        "version",
        "approved_at",
        "created_at",
        "updated_at",
    )
    ordering = ["-created_at"]
    actions = ["approve_plans", "archive_plans"]

    def approve_plans(self, request, queryset):
        now = timezone.now()
        updated = queryset.filter(status=FitnessPlan.Status.DRAFT).update(
            status=FitnessPlan.Status.APPROVED,
            approved_at=now,
        )
        self.message_user(request, f"{updated} plan(s) approved.")

    approve_plans.short_description = "Approve selected DRAFT plans"

    def archive_plans(self, request, queryset):
        updated = queryset.exclude(status=FitnessPlan.Status.ARCHIVED).update(
            status=FitnessPlan.Status.ARCHIVED,
        )
        self.message_user(request, f"{updated} plan(s) archived.")

    archive_plans.short_description = "Archive selected plans"
