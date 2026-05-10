from django.contrib import admin
from .models import AIPromptLog


@admin.register(AIPromptLog)
class AIPromptLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "plan_type",
        "trainer",
        "member",
        "model_used",
        "total_tokens",
        "gen_status",
        "created_at",
        "completed_at",
    )
    list_filter = ("gen_status", "plan_type", "model_used")
    search_fields = (
        "trainer__user__name",
        "trainer__user__email",
        "member__name",
        "celery_task_id",
    )
    readonly_fields = (
        "id",
        "celery_task_id",
        "model_used",
        "system_prompt",
        "user_prompt",
        "raw_response",
        "error_message",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "created_at",
        "completed_at",
    )
    ordering = ["-created_at"]

    fieldsets = (
        (
            "Overview",
            {
                "fields": (
                    "id",
                    "plan_type",
                    "gen_status",
                    "trainer",
                    "member",
                    "plan",
                    "celery_task_id",
                    "model_used",
                )
            },
        ),
        (
            "Prompts",
            {
                "fields": ("system_prompt", "user_prompt", "extra_instructions"),
                "classes": ("collapse",),
            },
        ),
        (
            "Response",
            {
                "fields": ("raw_response", "error_message"),
                "classes": ("collapse",),
            },
        ),
        (
            "Token Usage",
            {
                "fields": ("prompt_tokens", "completion_tokens", "total_tokens"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "completed_at"),
            },
        ),
    )
