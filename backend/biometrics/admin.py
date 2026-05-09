from django.contrib import admin
from .models import Biometric


@admin.register(Biometric)
class BiometricAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "weight",
        "body_fat_pct",
        "bmi",
        "muscle_mass",
        "resting_hr",
        "recorded_at",
    )
    list_filter = ("user",)
    search_fields = ("user__name", "user__email")
    readonly_fields = ("id", "bmi", "created_at")
    ordering = ["-recorded_at"]
    date_hierarchy = "recorded_at"
