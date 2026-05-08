from django.urls import path
from . import views

urlpatterns = [
    # Member routes
    path("log/", views.BiometricLogView.as_view(), name="biometric-log"),
    path("history/", views.BiometricHistoryView.as_view(), name="biometric-history"),
    path("latest/", views.BiometricLatestView.as_view(), name="biometric-latest"),
    path("trends/", views.BiometricTrendsView.as_view(), name="biometric-trends"),
    path("<uuid:pk>/", views.BiometricDetailView.as_view(), name="biometric-detail"),
    # Trainer/Owner routes
    path(
        "member/<uuid:member_id>/",
        views.TrainerMemberBiometricsView.as_view(),
        name="trainer-member-biometrics",
    ),
]
