from django.urls import path
from .views import (
    LogBiometricView,
    BiometricHistoryView,
    BiometricLatestView,
    BiometricTrendsView,
    DeleteBiometricView,
    TrainerMemberBiometricsView,
    TrainerMemberLatestBiometricView,
)

urlpatterns = [
    # ── Member routes ──────────────────────────────────────────────────
    # POST   → log a new biometric reading
    path("", LogBiometricView.as_view(), name="biometric-log"),
    # GET    → full history  (?from_date= ?to_date= ?limit=)
    path("history/", BiometricHistoryView.as_view(), name="biometric-history"),
    # GET    → latest snapshot + deltas
    path("latest/", BiometricLatestView.as_view(), name="biometric-latest"),
    # GET    → aggregated trends (?granularity=weekly|monthly ?from_date= ?to_date=)
    path("trends/", BiometricTrendsView.as_view(), name="biometric-trends"),
    # DELETE → delete a specific reading
    path("<uuid:pk>/delete/", DeleteBiometricView.as_view(), name="biometric-delete"),
    # ── Trainer routes ─────────────────────────────────────────────────
    # GET    → trainer reads their assigned member's history
    path(
        "member/<uuid:member_id>/",
        TrainerMemberBiometricsView.as_view(),
        name="trainer-member-biometrics",
    ),
    # GET    → trainer gets latest snapshot for AI plan generation
    path(
        "member/<uuid:member_id>/latest/",
        TrainerMemberLatestBiometricView.as_view(),
        name="trainer-member-biometric-latest",
    ),
]
