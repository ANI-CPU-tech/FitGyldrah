from django.contrib import admin
from .models import TrainerProfile, GymApplication


@admin.register(TrainerProfile)
class TrainerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "specialty",
        "years_experience",
        "is_available",
        "created_at",
    )
    list_filter = ("is_available",)
    search_fields = ("user__name", "user__email", "specialty", "certifications")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(GymApplication)
class GymApplicationAdmin(admin.ModelAdmin):
    list_display = ("trainer", "gym", "status", "applied_at", "reviewed_at")
    list_filter = ("status",)
    search_fields = ("trainer__user__name", "gym__name")
    readonly_fields = ("id", "applied_at", "reviewed_at")
    actions = ["approve_applications", "reject_applications"]

    def approve_applications(self, request, queryset):
        from django.utils import timezone

        updated = queryset.filter(status=GymApplication.Status.PENDING).update(
            status=GymApplication.Status.APPROVED,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"{updated} application(s) approved.")

    approve_applications.short_description = "Approve selected applications"

    def reject_applications(self, request, queryset):
        from django.utils import timezone

        updated = queryset.filter(status=GymApplication.Status.PENDING).update(
            status=GymApplication.Status.REJECTED,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"{updated} application(s) rejected.")

    reject_applications.short_description = "Reject selected applications"
