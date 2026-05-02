from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from authentication.permissions import IsTrainer, IsMember

from .models import Schedule
from .serializers import (
    ScheduleReadSerializer,
    ScheduleCreateSerializer,
    ScheduleUpdateSerializer,
    ScheduleRespondSerializer,
)


# ── Helpers ────────────────────────────────────────────────────────────────


def get_schedule_or_404(pk):
    try:
        return Schedule.objects.select_related("trainer__user", "member", "gym").get(
            pk=pk
        )
    except Schedule.DoesNotExist:
        raise NotFound("Schedule not found.")


# ══════════════════════════════════════════════
#  TRAINER VIEWS
# ══════════════════════════════════════════════


class TrainerScheduleListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/schedules/trainer/
         Trainer sees all their proposed schedules.
         ?status=PENDING|ACCEPTED|REJECTED|CANCELLED|COMPLETED
         ?upcoming=true  → only future ACCEPTED slots

    POST /api/schedules/trainer/
         Trainer proposes a new session slot for a member.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def get_serializer_class(self):
        return (
            ScheduleCreateSerializer
            if self.request.method == "POST"
            else ScheduleReadSerializer
        )

    def get_queryset(self):
        trainer = self.request.user.trainer_profile
        qs = Schedule.objects.filter(trainer=trainer).select_related(
            "trainer__user", "member", "gym"
        )
        status_filter = self.request.query_params.get("status")
        upcoming = self.request.query_params.get("upcoming")

        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if upcoming == "true":
            from django.utils import timezone

            qs = qs.filter(
                status=Schedule.Status.ACCEPTED,
                proposed_time__gt=timezone.now(),
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ScheduleCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save()
        return Response(
            ScheduleReadSerializer(schedule).data,
            status=status.HTTP_201_CREATED,
        )


class TrainerScheduleDetailView(APIView):
    """
    GET    /api/schedules/trainer/{id}/   → Trainer views a schedule they own.
    PATCH  /api/schedules/trainer/{id}/   → Trainer edits a PENDING schedule.
    DELETE /api/schedules/trainer/{id}/   → Trainer cancels any non-completed schedule.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def _get_own_schedule(self, pk, request):
        schedule = get_schedule_or_404(pk)
        if schedule.trainer.user != request.user:
            raise PermissionDenied("You do not own this schedule.")
        return schedule

    def get(self, request, pk):
        schedule = self._get_own_schedule(pk, request)
        return Response(ScheduleReadSerializer(schedule).data)

    def patch(self, request, pk):
        schedule = self._get_own_schedule(pk, request)
        serializer = ScheduleUpdateSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save()
        return Response(ScheduleReadSerializer(schedule).data)

    def delete(self, request, pk):
        schedule = self._get_own_schedule(pk, request)
        if schedule.status == Schedule.Status.COMPLETED:
            return Response(
                {"detail": "Cannot cancel a completed session."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schedule.cancel(cancelled_by="TRAINER")
        return Response(
            {
                "detail": "Schedule cancelled.",
                "schedule": ScheduleReadSerializer(schedule).data,
            },
            status=status.HTTP_200_OK,
        )


class TrainerMarkCompleteView(APIView):
    """
    PUT /api/schedules/trainer/{id}/complete/
    Trainer marks an ACCEPTED session as COMPLETED after it happens.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def put(self, request, pk):
        from django.utils import timezone

        schedule = get_schedule_or_404(pk)

        if schedule.trainer.user != request.user:
            raise PermissionDenied("You do not own this schedule.")
        if schedule.status != Schedule.Status.ACCEPTED:
            return Response(
                {
                    "detail": f"Only ACCEPTED sessions can be marked complete (current: {schedule.status})."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if schedule.proposed_time > timezone.now():
            return Response(
                {
                    "detail": "Cannot mark a session as complete before its scheduled time."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule.complete()
        return Response(
            {
                "detail": "Session marked as completed.",
                "schedule": ScheduleReadSerializer(schedule).data,
            },
            status=status.HTTP_200_OK,
        )


# ══════════════════════════════════════════════
#  MEMBER VIEWS
# ══════════════════════════════════════════════


class MemberScheduleListView(generics.ListAPIView):
    """
    GET /api/schedules/member/
    Member sees all schedules proposed to them.
    ?status=PENDING|ACCEPTED|REJECTED|CANCELLED|COMPLETED
    ?upcoming=true → only future accepted sessions
    """

    serializer_class = ScheduleReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        qs = Schedule.objects.filter(member=self.request.user).select_related(
            "trainer__user", "member", "gym"
        )
        status_filter = self.request.query_params.get("status")
        upcoming = self.request.query_params.get("upcoming")

        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if upcoming == "true":
            from django.utils import timezone

            qs = qs.filter(
                status=Schedule.Status.ACCEPTED,
                proposed_time__gt=timezone.now(),
            )
        return qs


class MemberScheduleRespondView(APIView):
    """
    PUT /api/schedules/member/{id}/respond/
    Member accepts or rejects a PENDING schedule proposal.
    Body: { "action": "accept" | "reject", "member_note": "..." }
    """

    permission_classes = [IsAuthenticated, IsMember]

    def put(self, request, pk):
        schedule = get_schedule_or_404(pk)

        if schedule.member != request.user:
            raise PermissionDenied("This schedule was not proposed to you.")

        serializer = ScheduleRespondSerializer(
            data=request.data,
            context={"schedule": schedule},
        )
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save()

        action_label = (
            "accepted" if schedule.status == Schedule.Status.ACCEPTED else "rejected"
        )
        return Response(
            {
                "detail": f"Schedule {action_label}.",
                "schedule": ScheduleReadSerializer(schedule).data,
            },
            status=status.HTTP_200_OK,
        )


class MemberScheduleCancelView(APIView):
    """
    PUT /api/schedules/member/{id}/cancel/
    Member cancels an ACCEPTED schedule (e.g. can't make it).
    """

    permission_classes = [IsAuthenticated, IsMember]

    def put(self, request, pk):
        schedule = get_schedule_or_404(pk)

        if schedule.member != request.user:
            raise PermissionDenied("This schedule does not belong to you.")

        if schedule.status not in (Schedule.Status.PENDING, Schedule.Status.ACCEPTED):
            return Response(
                {
                    "detail": f"Cannot cancel a schedule that is already {schedule.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule.cancel(cancelled_by="MEMBER")
        return Response(
            {
                "detail": "Schedule cancelled.",
                "schedule": ScheduleReadSerializer(schedule).data,
            },
            status=status.HTTP_200_OK,
        )
