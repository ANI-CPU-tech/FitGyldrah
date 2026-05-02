from django.urls import path
from .views import (
    GymDiscoveryView,
    EnrollView,
    MyEnrollmentsView,
    EnrollmentDetailView,
    CancelEnrollmentView,
    RenewEnrollmentView,
)

# Member-facing routes → mount at /api/members/
urlpatterns = [
    # Gym discovery
    path("gyms/", GymDiscoveryView.as_view(), name="gym-discovery"),
    # Enrollment
    path("enroll/", EnrollView.as_view(), name="member-enroll"),
    path("enrollments/", MyEnrollmentsView.as_view(), name="member-enrollments"),
    path(
        "enrollments/<uuid:pk>/",
        EnrollmentDetailView.as_view(),
        name="member-enrollment-detail",
    ),
    path(
        "enrollments/<uuid:pk>/cancel/",
        CancelEnrollmentView.as_view(),
        name="member-enrollment-cancel",
    ),
    path(
        "enrollments/<uuid:pk>/renew/",
        RenewEnrollmentView.as_view(),
        name="member-enrollment-renew",
    ),
]
