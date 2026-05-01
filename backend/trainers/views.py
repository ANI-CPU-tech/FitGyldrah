from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError

from authentication.permissions import IsOwner, IsTrainer

from gyms.models import Gym

from .models import TrainerProfile, GymApplication
from .serializers import (
    TrainerProfileReadSerializer,
    TrainerProfileWriteSerializer,
    GymApplicationReadSerializer,
    GymApplicationCreateSerializer,
    ApplicationReviewSerializer,
)


# ══════════════════════════════════════════════
#  TRAINER PROFILE VIEWS
# ══════════════════════════════════════════════


class TrainerProfileSetupView(APIView):
    """
    POST /api/trainers/profile/setup/
    Called once when a user claims the TRAINER role.
    Creates their TrainerProfile. Accepts multipart (CV + picture upload).
    """

    permission_classes = [IsAuthenticated, IsTrainer]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # Prevent double-creation
        if hasattr(request.user, "trainer_profile"):
            return Response(
                {
                    "detail": "Trainer profile already exists. Use PATCH /api/trainers/profile/ to update."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TrainerProfileWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save(user=request.user)
        return Response(
            TrainerProfileReadSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class TrainerProfileMeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/trainers/profile/     → Trainer sees own full profile
    PATCH /api/trainers/profile/     → Trainer updates own profile (multipart for files)
    """

    permission_classes = [IsAuthenticated, IsTrainer]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return TrainerProfileWriteSerializer
        return TrainerProfileReadSerializer

    def get_object(self):
        try:
            return self.request.user.trainer_profile
        except TrainerProfile.DoesNotExist:
            raise NotFound(
                "Trainer profile not found. Call /api/trainers/profile/setup/ first."
            )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop(
            "partial", True
        )  # always partial — no need to resend files
        profile = self.get_object()
        serializer = self.get_serializer(profile, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(TrainerProfileReadSerializer(profile).data)


class TrainerPublicDetailView(generics.RetrieveAPIView):
    """
    GET /api/trainers/{id}/
    Public profile of a trainer — visible to anyone.
    """

    serializer_class = TrainerProfileReadSerializer
    permission_classes = [AllowAny]
    queryset = TrainerProfile.objects.select_related("user")


class TrainerListByGymView(generics.ListAPIView):
    """
    GET /api/gyms/{gym_id}/trainers/
    Lists all APPROVED trainers at a specific gym.
    """

    serializer_class = TrainerProfileReadSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["specialty", "user__name", "certifications"]

    def get_queryset(self):
        gym_id = self.kwargs["gym_id"]
        return (
            TrainerProfile.objects.filter(
                applications__gym_id=gym_id,
                applications__status=GymApplication.Status.APPROVED,
            )
            .select_related("user")
            .distinct()
        )


# ══════════════════════════════════════════════
#  APPLICATION VIEWS
# ══════════════════════════════════════════════


class TrainerApplyView(APIView):
    """
    POST /api/trainers/apply/
    Trainer applies to a gym.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def post(self, request):
        try:
            trainer = request.user.trainer_profile
        except TrainerProfile.DoesNotExist:
            return Response(
                {"detail": "Set up your trainer profile before applying to a gym."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GymApplicationCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        application = serializer.save(trainer=trainer)
        return Response(
            GymApplicationReadSerializer(application).data,
            status=status.HTTP_201_CREATED,
        )


class TrainerMyApplicationsView(generics.ListAPIView):
    """
    GET /api/trainers/applications/mine/
    Trainer views all their own applications and their statuses.
    """

    serializer_class = GymApplicationReadSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        return GymApplication.objects.filter(
            trainer=self.request.user.trainer_profile
        ).select_related("gym", "trainer__user")


class GymApplicationsListView(generics.ListAPIView):
    """
    GET /api/gyms/{gym_id}/applications/
    Owner views ALL applications to their gym.
    Optional ?status=PENDING|APPROVED|REJECTED filter.
    """

    serializer_class = GymApplicationReadSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_gym(self):
        try:
            gym = Gym.objects.get(pk=self.kwargs["gym_id"])
        except Gym.DoesNotExist:
            raise NotFound("Gym not found.")
        if gym.owner != self.request.user:
            raise PermissionDenied("You are not the owner of this gym.")
        return gym

    def get_queryset(self):
        gym = self.get_gym()
        status_filter = self.request.query_params.get("status", None)
        qs = GymApplication.objects.filter(gym=gym).select_related(
            "trainer__user", "gym"
        )
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs


class ApplicationReviewView(APIView):
    """
    PUT /api/gyms/{gym_id}/applications/{application_id}/review/
    Owner approves or rejects an application.
    Body: { "action": "approve" | "reject", "owner_note": "..." }
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def _get_application(self, gym_id, application_id, owner):
        try:
            gym = Gym.objects.get(pk=gym_id)
        except Gym.DoesNotExist:
            raise NotFound("Gym not found.")

        if gym.owner != owner:
            raise PermissionDenied("You are not the owner of this gym.")

        try:
            return GymApplication.objects.select_related("trainer__user", "gym").get(
                pk=application_id, gym=gym
            )
        except GymApplication.DoesNotExist:
            raise NotFound("Application not found.")

    def put(self, request, gym_id, application_id):
        application = self._get_application(gym_id, application_id, request.user)

        if application.status != GymApplication.Status.PENDING:
            return Response(
                {
                    "detail": f"Application is already {application.status}. Cannot review again."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ApplicationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.save(application=application)

        return Response(
            {
                "detail": f"Application {application.status.lower()}.",
                "application": GymApplicationReadSerializer(application).data,
            },
            status=status.HTTP_200_OK,
        )
