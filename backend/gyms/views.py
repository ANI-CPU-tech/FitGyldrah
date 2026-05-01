from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from authentication.permissions import IsOwner

from .models import Gym, SubscriptionTier
from .serializers import (
    GymReadSerializer,
    GymWriteSerializer,
    SubscriptionTierSerializer,
    SubscriptionTierCreateSerializer,
)


# ══════════════════════════════════════════════
#  GYM VIEWS
# ══════════════════════════════════════════════


class GymListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/gyms/          → Public. List all active gyms. Supports ?search=
    POST /api/gyms/          → Owner only. Register a new gym.
    """

    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "location", "facilities"]
    queryset = Gym.objects.filter(is_active=True).select_related("owner")

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsOwner()]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return GymReadSerializer
        return GymWriteSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gym = serializer.save(owner=request.user)
        return Response(
            GymReadSerializer(gym).data,
            status=status.HTTP_201_CREATED,
        )


class GymDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/gyms/{id}/   → Public. Get gym details + nested tiers.
    PUT    /api/gyms/{id}/   → Owner of THIS gym only.
    PATCH  /api/gyms/{id}/   → Owner of THIS gym only.
    DELETE /api/gyms/{id}/   → Owner of THIS gym only (soft delete).
    """

    queryset = Gym.objects.all().select_related("owner").prefetch_related("tiers")

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsOwner()]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return GymReadSerializer
        return GymWriteSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Only the gym's owner can mutate it
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if obj.owner != request.user:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You are not the owner of this gym.")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        gym = self.get_object()
        serializer = self.get_serializer(gym, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        gym = serializer.save()
        return Response(GymReadSerializer(gym).data)

    def destroy(self, request, *args, **kwargs):
        gym = self.get_object()
        gym.is_active = False  # Soft delete — preserve history
        gym.save(update_fields=["is_active"])
        return Response(
            {"detail": f"Gym '{gym.name}' has been deactivated."},
            status=status.HTTP_200_OK,
        )


class MyGymsView(generics.ListAPIView):
    """
    GET /api/gyms/mine/   → Owner sees only THEIR gyms (active + inactive).
    """

    serializer_class = GymReadSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Gym.objects.filter(owner=self.request.user).prefetch_related("tiers")


# ══════════════════════════════════════════════
#  SUBSCRIPTION TIER VIEWS
# ══════════════════════════════════════════════


class TierListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/gyms/{gym_id}/tiers/   → Public. List active tiers for a gym.
    POST /api/gyms/{gym_id}/tiers/   → Owner of the gym only.
    """

    def get_gym(self):
        try:
            return Gym.objects.get(pk=self.kwargs["gym_id"])
        except Gym.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound("Gym not found.")

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsOwner()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return SubscriptionTierCreateSerializer
        return SubscriptionTierSerializer

    def get_queryset(self):
        return SubscriptionTier.objects.filter(
            gym_id=self.kwargs["gym_id"], is_active=True
        )

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method == "POST":
            gym = self.get_gym()
            if gym.owner != request.user:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You are not the owner of this gym.")

    def create(self, request, *args, **kwargs):
        gym = self.get_gym()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tier = serializer.save(gym=gym)
        return Response(
            SubscriptionTierSerializer(tier).data,
            status=status.HTTP_201_CREATED,
        )


class TierDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/gyms/{gym_id}/tiers/{id}/   → Public.
    PUT    /api/gyms/{gym_id}/tiers/{id}/   → Gym Owner only.
    DELETE /api/gyms/{gym_id}/tiers/{id}/   → Gym Owner only (soft delete).
    """

    queryset = SubscriptionTier.objects.all()

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), IsOwner()]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return SubscriptionTierCreateSerializer
        return SubscriptionTierSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if obj.gym.owner != request.user:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You are not the owner of this gym.")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        tier = self.get_object()
        serializer = self.get_serializer(tier, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        tier = serializer.save()
        return Response(SubscriptionTierSerializer(tier).data)

    def destroy(self, request, *args, **kwargs):
        tier = self.get_object()
        tier.is_active = False
        tier.save(update_fields=["is_active"])
        return Response(
            {"detail": f"Tier '{tier.name}' has been deactivated."},
            status=status.HTTP_200_OK,
        )
