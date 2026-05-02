from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import NotFound, PermissionDenied

from django_filters.rest_framework import DjangoFilterBackend

from authentication.permissions import IsOwner, IsMember
from gyms.models import Gym

from .models import MemberEnrollment
from .serializers import (
    GymDiscoverySerializer,
    EnrollmentReadSerializer,
    EnrollmentCreateSerializer,
    AssignTrainerSerializer,
    GymMemberListSerializer,
)


# ══════════════════════════════════════════════
#  GYM DISCOVERY
# ══════════════════════════════════════════════


class GymDiscoveryView(generics.ListAPIView):
    """
    GET /api/members/gyms/
    Public gym search for members.
    Supports: ?search=name/location  ?facilities=Pool
    Returns enriched cards: tiers, trainer count, is_enrolled flag.
    """

    serializer_class = GymDiscoverySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "location", "facilities"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        return (
            Gym.objects.filter(is_active=True)
            .prefetch_related("tiers")
            .select_related("owner")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


# ══════════════════════════════════════════════
#  ENROLLMENT
# ══════════════════════════════════════════════


class EnrollView(APIView):
    """
    POST /api/members/enroll/
    Member joins a gym under a chosen subscription tier.
    Billing cycle (start/end date) is auto-computed from tier duration.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def post(self, request):
        serializer = EnrollmentCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        enrollment = serializer.save()
        return Response(
            EnrollmentReadSerializer(enrollment).data,
            status=status.HTTP_201_CREATED,
        )


class MyEnrollmentsView(generics.ListAPIView):
    """
    GET /api/members/enrollments/
    Member views all their enrollments (active + historical).
    Optional: ?status=ACTIVE|EXPIRED|CANCELLED
    """

    serializer_class = EnrollmentReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        qs = MemberEnrollment.objects.filter(member=self.request.user).select_related(
            "gym", "tier", "trainer__user"
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs


class EnrollmentDetailView(generics.RetrieveAPIView):
    """
    GET /api/members/enrollments/{id}/
    Member views a specific enrollment's full detail.
    """

    serializer_class = EnrollmentReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_object(self):
        try:
            enrollment = MemberEnrollment.objects.select_related(
                "gym", "tier", "trainer__user"
            ).get(pk=self.kwargs["pk"], member=self.request.user)
        except MemberEnrollment.DoesNotExist:
            raise NotFound("Enrollment not found.")
        return enrollment


class CancelEnrollmentView(APIView):
    """
    PUT /api/members/enrollments/{id}/cancel/
    Member cancels their own active enrollment.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def put(self, request, pk):
        try:
            enrollment = MemberEnrollment.objects.get(pk=pk, member=request.user)
        except MemberEnrollment.DoesNotExist:
            raise NotFound("Enrollment not found.")

        if enrollment.status != MemberEnrollment.Status.ACTIVE:
            return Response(
                {
                    "detail": f"Enrollment is already {enrollment.status}. Cannot cancel."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment.cancel()
        return Response(
            {
                "detail": f"Enrollment at '{enrollment.gym.name}' has been cancelled.",
                "enrollment": EnrollmentReadSerializer(enrollment).data,
            },
            status=status.HTTP_200_OK,
        )


class RenewEnrollmentView(APIView):
    """
    POST /api/members/enrollments/{id}/renew/
    Renews an EXPIRED enrollment using the same tier.
    Creates a fresh enrollment — does not mutate the old record.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def post(self, request, pk):
        from django.utils import timezone

        try:
            old = MemberEnrollment.objects.select_related("gym", "tier").get(
                pk=pk, member=request.user
            )
        except MemberEnrollment.DoesNotExist:
            raise NotFound("Enrollment not found.")

        if old.status == MemberEnrollment.Status.ACTIVE:
            return Response(
                {"detail": "Enrollment is still active. No renewal needed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check no other active enrollment for the same gym
        if MemberEnrollment.objects.filter(
            member=request.user, gym=old.gym, status=MemberEnrollment.Status.ACTIVE
        ).exists():
            return Response(
                {"detail": "You already have an active enrollment at this gym."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_date = timezone.now().date()
        end_date = MemberEnrollment.compute_end_date(start_date, old.tier.duration_type)

        new_enrollment = MemberEnrollment.objects.create(
            member=request.user,
            gym=old.gym,
            tier=old.tier,
            start_date=start_date,
            end_date=end_date,
            price_paid=old.tier.price,
            status=MemberEnrollment.Status.ACTIVE,
            trainer=old.trainer,  # Keep same trainer on renewal
        )
        return Response(
            EnrollmentReadSerializer(new_enrollment).data,
            status=status.HTTP_201_CREATED,
        )


# ══════════════════════════════════════════════
#  OWNER VIEWS
# ══════════════════════════════════════════════


class GymMembersListView(generics.ListAPIView):
    """
    GET /api/gyms/{gym_id}/members/
    Owner views all enrolled members at their gym.
    Optional: ?status=ACTIVE|EXPIRED|CANCELLED
    """

    serializer_class = GymMemberListSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [filters.SearchFilter]
    search_fields = ["member__name", "member__email"]

    def _get_gym(self):
        try:
            gym = Gym.objects.get(pk=self.kwargs["gym_id"])
        except Gym.DoesNotExist:
            raise NotFound("Gym not found.")
        if gym.owner != self.request.user:
            raise PermissionDenied("You are not the owner of this gym.")
        return gym

    def get_queryset(self):
        gym = self._get_gym()
        qs = MemberEnrollment.objects.filter(gym=gym).select_related(
            "member", "tier", "trainer__user"
        )
        status_filter = self.request.query_params.get("status", "ACTIVE")
        return qs.filter(status=status_filter.upper())


class AssignTrainerView(APIView):
    """
    PUT /api/gyms/{gym_id}/members/{enrollment_id}/assign-trainer/
    Owner assigns an approved trainer to an enrolled member.
    The trainer must be approved at the same gym.
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def put(self, request, gym_id, enrollment_id):
        # Validate gym ownership
        try:
            gym = Gym.objects.get(pk=gym_id)
        except Gym.DoesNotExist:
            raise NotFound("Gym not found.")
        if gym.owner != request.user:
            raise PermissionDenied("You are not the owner of this gym.")

        # Validate enrollment belongs to this gym
        try:
            enrollment = MemberEnrollment.objects.select_related(
                "gym", "trainer__user"
            ).get(pk=enrollment_id, gym=gym)
        except MemberEnrollment.DoesNotExist:
            raise NotFound("Enrollment not found at this gym.")

        if enrollment.status != MemberEnrollment.Status.ACTIVE:
            return Response(
                {"detail": "Can only assign a trainer to an active enrollment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssignTrainerSerializer(
            data=request.data, context={"enrollment": enrollment}
        )
        serializer.is_valid(raise_exception=True)
        enrollment = serializer.save()

        return Response(
            {
                "detail": f"Trainer '{enrollment.trainer.user.name}' assigned to {enrollment.member.name}.",
                "enrollment": GymMemberListSerializer(enrollment).data,
            },
            status=status.HTTP_200_OK,
        )
