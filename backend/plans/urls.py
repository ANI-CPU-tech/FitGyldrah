from django.urls import path
from .views import (
    TrainerPlanListCreateView,
    TrainerPlanDetailView,
    ApprovePlanView,
    AIGeneratePlanView,
    AIGenerationStatusView,
    MemberActivePlansView,
    MemberPlanHistoryView,
    MemberPlanDetailView,
)

urlpatterns = [
    # ── Trainer routes ─────────────────────────────────────────────────────
    # GET  → trainer's plan list  (?status= ?plan_type= ?member_id=)
    # POST → trainer manually creates a plan
    path(
        "trainer/", TrainerPlanListCreateView.as_view(), name="trainer-plan-list-create"
    ),
    # GET   → single plan detail
    # PATCH → edit a DRAFT plan
    # DELETE → archive a plan
    path(
        "trainer/<uuid:pk>/",
        TrainerPlanDetailView.as_view(),
        name="trainer-plan-detail",
    ),
    # PUT → approve a DRAFT plan → publishes to member
    path(
        "trainer/<uuid:pk>/approve/",
        ApprovePlanView.as_view(),
        name="trainer-plan-approve",
    ),
    # POST → queue AI generation for a member's plan
    path(
        "trainer/generate/", AIGeneratePlanView.as_view(), name="trainer-plan-generate"
    ),
    # GET → poll Celery task status
    path(
        "trainer/generate/<str:task_id>/status/",
        AIGenerationStatusView.as_view(),
        name="trainer-plan-generate-status",
    ),
    # ── Member routes ──────────────────────────────────────────────────────
    # GET → member's currently APPROVED plans (?plan_type=DIET|WORKOUT)
    path("member/active/", MemberActivePlansView.as_view(), name="member-plan-active"),
    # GET → full plan history including archived
    path(
        "member/history/", MemberPlanHistoryView.as_view(), name="member-plan-history"
    ),
    # GET → read a specific approved plan
    path(
        "member/<uuid:pk>/", MemberPlanDetailView.as_view(), name="member-plan-detail"
    ),
]
