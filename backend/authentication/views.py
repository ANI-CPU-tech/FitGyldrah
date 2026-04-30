from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, UserProfileSerializer, RoleClaimSerializer


# ──────────────────────────────────────────────
# POST /api/auth/register/
# ──────────────────────────────────────────────
class RegisterView(generics.CreateAPIView):
    """
    Open endpoint. Anyone can register.
    Returns the created user profile (no tokens — they must login separately).
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserProfileSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


# ──────────────────────────────────────────────
# POST /api/auth/login/
# Handled by simplejwt's TokenObtainPairView — we subclass it only to
# attach the user profile to the response alongside the tokens.
# ──────────────────────────────────────────────
class LoginView(TokenObtainPairView):
    """
    Returns: { access, refresh, user: {...profile} }
    """

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            from django.contrib.auth import authenticate

            user = authenticate(
                request,
                email=request.data.get("email"),
                password=request.data.get("password"),
            )
            if user:
                response.data["user"] = UserProfileSerializer(user).data
        return response


# ──────────────────────────────────────────────
# POST /api/auth/logout/
# Blacklists the refresh token so it can't be used again.
# ──────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"detail": "refresh token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "Successfully logged out."}, status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ──────────────────────────────────────────────
# GET  /api/auth/me/   → returns own profile
# PUT  /api/auth/me/   → update biodata (height, weight, goals, body_fat_pct)
# ──────────────────────────────────────────────
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "put", "patch"]

    def get_object(self):
        return self.request.user


# ──────────────────────────────────────────────
# POST /api/auth/claim-role/
# Called from the dashboard after onboarding.
# ──────────────────────────────────────────────
class ClaimRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RoleClaimSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "detail": f"Role successfully set to {user.role}.",
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )
