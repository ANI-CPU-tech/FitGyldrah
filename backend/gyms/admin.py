from django.contrib import admin
from .models import Gym, SubscriptionTier


class SubscriptionTierInline(admin.TabularInline):
    model = SubscriptionTier
    extra = 1
    fields = ("name", "price", "duration_type", "is_active")


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "location", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "location", "owner__email")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [SubscriptionTierInline]


@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
    list_display = ("name", "gym", "price", "duration_type", "is_active")
    list_filter = ("duration_type", "is_active")
    search_fields = ("name", "gym__name")
    readonly_fields = ("id", "created_at", "updated_at")
