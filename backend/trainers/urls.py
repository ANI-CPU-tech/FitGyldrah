from django.urls import path
from .views import (
    TrainerProfileSetupView,
    TrainerProfileMeView,
    TrainerPublicDetailView,
    TrainerApplyView,
    TrainerMyApplicationsView,
)

urlpatterns = [
    # ── Trainer profile ───────────────────────────────────────
    # POST   → create profile (first time after claiming TRAINER role)
    path(
        "profile/setup/",
        TrainerProfileSetupView.as_view(),
        name="trainer-profile-setup",
    ),
    # GET / PATCH → view or update own profile
    path("profile/", TrainerProfileMeView.as_view(), name="trainer-profile-me"),
    # GET → public profile of any trainer
    path("<uuid:pk>/", TrainerPublicDetailView.as_view(), name="trainer-public-detail"),
    # ── Applications ──────────────────────────────────────────
    # POST → trainer applies to a gym
    path("apply/", TrainerApplyView.as_view(), name="trainer-apply"),
    # GET  → trainer views own application history
    path(
        "applications/mine/",
        TrainerMyApplicationsView.as_view(),
        name="trainer-my-applications",
    ),
]
