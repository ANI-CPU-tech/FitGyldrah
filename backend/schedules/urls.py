from django.urls import path
from .views import (
    TrainerScheduleListCreateView,
    TrainerScheduleDetailView,
    TrainerMarkCompleteView,
    MemberScheduleListView,
    MemberScheduleRespondView,
    MemberScheduleCancelView,
)

urlpatterns = [
    # ── Trainer routes ─────────────────────────────────────────────────
    # GET  → trainer's schedule list  (?status= ?upcoming=true)
    # POST → trainer proposes a new session
    path(
        "trainer/",
        TrainerScheduleListCreateView.as_view(),
        name="trainer-schedule-list-create",
    ),
    # GET   → single schedule detail
    # PATCH → trainer edits a PENDING schedule
    # DELETE → trainer cancels a schedule
    path(
        "trainer/<uuid:pk>/",
        TrainerScheduleDetailView.as_view(),
        name="trainer-schedule-detail",
    ),
    # PUT → mark an ACCEPTED session as COMPLETED
    path(
        "trainer/<uuid:pk>/complete/",
        TrainerMarkCompleteView.as_view(),
        name="trainer-schedule-complete",
    ),
    # ── Member routes ──────────────────────────────────────────────────
    # GET → member's schedule list (?status= ?upcoming=true)
    path("member/", MemberScheduleListView.as_view(), name="member-schedule-list"),
    # PUT → member accepts or rejects a PENDING proposal
    path(
        "member/<uuid:pk>/respond/",
        MemberScheduleRespondView.as_view(),
        name="member-schedule-respond",
    ),
    # PUT → member cancels an ACCEPTED session
    path(
        "member/<uuid:pk>/cancel/",
        MemberScheduleCancelView.as_view(),
        name="member-schedule-cancel",
    ),
]
