from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from authentication.permissions import IsTrainer, IsMember

from .models import FitnessPlan
from .serializers import (
    FitnessPlanReadSerializer,
    FitnessPlanCreateSerializer,
    FitnessPlanUpdateSerializer,
    AIGeneratePlanSerializer,
)


# ── Helpers ────────────────────────────────────────────────────────────────


def get_plan_or_404(pk):
    try:
        return FitnessPlan.objects.select_related("trainer__user", "member").get(pk=pk)
    except FitnessPlan.DoesNotExist:
        raise NotFound("Fitness plan not found.")


# ══════════════════════════════════════════════
#  TRAINER VIEWS
# ══════════════════════════════════════════════


class TrainerPlanListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/plans/trainer/
         Trainer lists all plans they've created.
         ?status=DRAFT|APPROVED|ARCHIVED
         ?plan_type=DIET|WORKOUT
         ?member_id=<uuid>   → filter by a specific member

    POST /api/plans/trainer/
         Trainer manually creates a new plan for a member.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def get_serializer_class(self):
        return (
            FitnessPlanCreateSerializer
            if self.request.method == "POST"
            else FitnessPlanReadSerializer
        )

    def get_queryset(self):
        trainer = self.request.user.trainer_profile
        qs = FitnessPlan.objects.filter(trainer=trainer).select_related(
            "trainer__user", "member"
        )
        status_f = self.request.query_params.get("status")
        type_f = self.request.query_params.get("plan_type")
        member_id = self.request.query_params.get("member_id")

        if status_f:
            qs = qs.filter(status=status_f.upper())
        if type_f:
            qs = qs.filter(plan_type=type_f.upper())
        if member_id:
            qs = qs.filter(member_id=member_id)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = FitnessPlanCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return Response(
            FitnessPlanReadSerializer(plan).data,
            status=status.HTTP_201_CREATED,
        )


class TrainerPlanDetailView(APIView):
    """
    GET    /api/plans/trainer/{id}/   → Read any plan the trainer created.
    PATCH  /api/plans/trainer/{id}/   → Edit a DRAFT plan.
    DELETE /api/plans/trainer/{id}/   → Archive a DRAFT plan.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def _get_own_plan(self, pk, request):
        plan = get_plan_or_404(pk)
        if plan.trainer.user != request.user:
            raise PermissionDenied("You do not own this plan.")
        return plan

    def get(self, request, pk):
        plan = self._get_own_plan(pk, request)
        return Response(FitnessPlanReadSerializer(plan).data)

    def patch(self, request, pk):
        plan = self._get_own_plan(pk, request)
        serializer = FitnessPlanUpdateSerializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return Response(FitnessPlanReadSerializer(plan).data)

    def delete(self, request, pk):
        plan = self._get_own_plan(pk, request)
        if plan.status == FitnessPlan.Status.ARCHIVED:
            return Response(
                {"detail": "Plan is already archived."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan.archive()
        return Response(
            {"detail": f"Plan '{plan.title}' archived."},
            status=status.HTTP_200_OK,
        )


class ApprovePlanView(APIView):
    """
    PUT /api/plans/trainer/{id}/approve/
    Trainer approves a DRAFT plan → status becomes APPROVED.
    Any previously APPROVED plan of the same type for that member
    is automatically archived.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def put(self, request, pk):
        plan = get_plan_or_404(pk)

        if plan.trainer.user != request.user:
            raise PermissionDenied("You do not own this plan.")

        if plan.status != FitnessPlan.Status.DRAFT:
            return Response(
                {
                    "detail": f"Only DRAFT plans can be approved. Current status: {plan.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan.approve()
        return Response(
            {
                "detail": f"Plan '{plan.title}' approved and published to member's dashboard.",
                "plan": FitnessPlanReadSerializer(plan).data,
            },
            status=status.HTTP_200_OK,
        )


# ── AI Generation ──────────────────────────────────────────────────────────


class AIGeneratePlanView(APIView):
    """
    POST /api/plans/trainer/generate/
    Trainer triggers async AI generation of a plan for a member.
    Queues a Celery task — returns a task_id to poll.

    Body:
      { "member_id": "<uuid>", "plan_type": "DIET"|"WORKOUT",
        "extra_instructions": "avoid gluten, high protein" }
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def post(self, request):
        serializer = AIGeneratePlanSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        member = serializer.validated_data["member"]
        trainer = serializer.validated_data["trainer"]
        plan_type = serializer.validated_data["plan_type"]
        extra_instructions = serializer.validated_data.get("extra_instructions", "")

        # Import here to avoid circular import — ai_engine is built later
        try:
            from ai_engine.tasks import generate_fitness_plan_task

            task = generate_fitness_plan_task.delay(
                trainer_id=str(trainer.id),
                member_id=str(member.id),
                plan_type=plan_type,
                extra_instructions=extra_instructions,
            )
            task_id = str(task.id)
        except ImportError:
            # ai_engine not yet built — return a placeholder for now
            task_id = "ai_engine_not_yet_configured"

        return Response(
            {
                "detail": "AI plan generation queued. Poll the status endpoint with the task_id.",
                "task_id": task_id,
                "member_id": str(member.id),
                "plan_type": plan_type,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class AIGenerationStatusView(APIView):
    """
    GET /api/plans/trainer/generate/{task_id}/status/
    Poll the Celery task status for an AI generation job.
    Returns the created plan once COMPLETE.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def get(self, request, task_id):
        try:
            from celery.result import AsyncResult

            result = AsyncResult(task_id)

            if result.state == "PENDING":
                return Response({"state": "PENDING", "detail": "Task is queued."})
            elif result.state == "STARTED":
                return Response(
                    {"state": "STARTED", "detail": "AI is generating the plan..."}
                )
            elif result.state == "SUCCESS":
                plan_id = result.result.get("plan_id")
                plan = get_plan_or_404(plan_id)
                return Response(
                    {
                        "state": "SUCCESS",
                        "detail": "Plan generated. Review and approve before publishing.",
                        "plan": FitnessPlanReadSerializer(plan).data,
                    }
                )
            elif result.state == "FAILURE":
                return Response(
                    {"state": "FAILURE", "detail": str(result.result)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            else:
                return Response({"state": result.state})

        except Exception as e:
            return Response(
                {"detail": f"Could not fetch task status: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ══════════════════════════════════════════════
#  MEMBER VIEWS
# ══════════════════════════════════════════════


class MemberActivePlansView(generics.ListAPIView):
    """
    GET /api/plans/member/active/
    Member views their currently APPROVED plans.
    ?plan_type=DIET|WORKOUT  → filter by type
    Returns at most one DIET and one WORKOUT plan (the latest approved).
    """

    serializer_class = FitnessPlanReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        qs = FitnessPlan.objects.filter(
            member=self.request.user,
            status=FitnessPlan.Status.APPROVED,
        ).select_related("trainer__user", "member")
        type_f = self.request.query_params.get("plan_type")
        if type_f:
            qs = qs.filter(plan_type=type_f.upper())
        return qs


class MemberPlanHistoryView(generics.ListAPIView):
    """
    GET /api/plans/member/history/
    Member views their full plan history including archived versions.
    """

    serializer_class = FitnessPlanReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        qs = FitnessPlan.objects.filter(member=self.request.user).select_related(
            "trainer__user", "member"
        )
        type_f = self.request.query_params.get("plan_type")
        if type_f:
            qs = qs.filter(plan_type=type_f.upper())
        return qs


class MemberPlanDetailView(generics.RetrieveAPIView):
    """
    GET /api/plans/member/{id}/
    Member reads a specific APPROVED plan in full detail.
    """

    serializer_class = FitnessPlanReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_object(self):
        plan = get_plan_or_404(self.kwargs["pk"])
        if plan.member != self.request.user:
            raise PermissionDenied("This plan does not belong to you.")
        if plan.status != FitnessPlan.Status.APPROVED:
            raise PermissionDenied("This plan has not been approved yet.")
        return plan
