from django.urls import path
from .views import (
    GymListCreateView,
    GymDetailView,
    MyGymsView,
    TierListCreateView,
    TierDetailView,
)
from trainers.views import (
    TrainerListByGymView,
    GymApplicationsListView,
    ApplicationReviewView,
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
    path(
        "<uuid:gym_id>/trainers/",
        TrainerListByGymView.as_view(),
        name="gym-trainers-list",
    ),
    path(
        "<uuid:gym_id>/applications/",
        GymApplicationsListView.as_view(),
        name="gym-applications-list",
    ),
    path(
        "<uuid:gym_id>/applications/<uuid:application_id>/review/",
        ApplicationReviewView.as_view(),
        name="gym-application-review",
    ),
]
