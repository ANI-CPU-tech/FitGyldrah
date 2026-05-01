from django.urls import path
from .views import (
    GymListCreateView,
    GymDetailView,
    MyGymsView,
    TierListCreateView,
    TierDetailView,
)

urlpatterns = [
    # ── Gym endpoints ──────────────────────────────────
    path("", GymListCreateView.as_view(), name="gym-list-create"),
    path("mine/", MyGymsView.as_view(), name="gym-mine"),
    path("<uuid:pk>/", GymDetailView.as_view(), name="gym-detail"),
    # ── Tier endpoints (nested under a gym) ───────────
    path("<uuid:gym_id>/tiers/", TierListCreateView.as_view(), name="tier-list-create"),
    path(
        "<uuid:gym_id>/tiers/<uuid:pk>/", TierDetailView.as_view(), name="tier-detail"
    ),
]
