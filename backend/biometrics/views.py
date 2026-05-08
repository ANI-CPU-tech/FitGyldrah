from datetime import timedelta, datetime
from django.db import connection
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from authentication.permissions import IsMember, IsTrainer, IsOwner

from .models import Biometric
from .serializers import (
    BiometricCreateSerializer,
    BiometricReadSerializer,
    BiometricLatestSerializer,
    BiometricTrendPointSerializer,
)


# ── Helper ─────────────────────────────────────────────────────────────────


def _parse_date_param(request, param: str, default=None):
    """Parse an ISO date query param like ?from=2026-01-01"""
    raw = request.query_params.get(param)
    if not raw:
        return default
    try:
        return datetime.strptime(raw, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValidationError({param: f"Invalid date format. Use YYYY-MM-DD."})


# ══════════════════════════════════════════════
#  MEMBER — LOG & READ OWN BIOMETRICS
# ══════════════════════════════════════════════


class BiometricLogView(generics.CreateAPIView):
    """
    POST /api/biometrics/
    Member logs a new biometric reading.
    At least one measurement field must be provided.
    BMI is auto-computed from weight + member's stored height.
    """

    serializer_class = BiometricCreateSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(member=request.user)
        return Response(
            BiometricReadSerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class BiometricHistoryView(generics.ListAPIView):
    """
    GET /api/biometrics/
    Member's full biometric history, newest first.

    Query params:
      ?from=YYYY-MM-DD      → readings on or after this date
      ?to=YYYY-MM-DD        → readings on or before this date
      ?limit=50             → max entries (default 100, max 500)
    """

    serializer_class = BiometricReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        member = self.request.user
        date_from = _parse_date_param(
            self.request, "from", default=timezone.now() - timedelta(days=90)
        )
        date_to = _parse_date_param(self.request, "to", default=timezone.now())
        limit = min(int(self.request.query_params.get("limit", 100)), 500)

        return (
            Biometric.objects.filter(
                member=member, recorded_at__gte=date_from, recorded_at__lte=date_to
            )
            .select_related("member")
            .order_by("-recorded_at")[:limit]
        )


class BiometricDetailView(generics.RetrieveDestroyAPIView):
    """
    GET    /api/biometrics/{id}/   → Member reads a specific entry.
    DELETE /api/biometrics/{id}/   → Member deletes their own entry.
    """

    serializer_class = BiometricReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_object(self):
        try:
            entry = Biometric.objects.select_related("member").get(pk=self.kwargs["pk"])
        except Biometric.DoesNotExist:
            raise NotFound("Biometric entry not found.")
        if entry.member != self.request.user:
            raise PermissionDenied("This entry does not belong to you.")
        return entry


# ══════════════════════════════════════════════
#  LATEST SNAPSHOT
# ══════════════════════════════════════════════


class BiometricLatestView(APIView):
    """
    GET /api/biometrics/latest/
    Returns the most recent non-null value for each measurement field.
    Fields may come from different entries (e.g. weight daily, BF% weekly).

    Works for:
      - Member reading their own snapshot
      - Trainer reading a member's snapshot (?member_id=<uuid>)
    """

    permission_classes = [IsAuthenticated]

    def _get_member(self, request):
        member_id = request.query_params.get("member_id")
        if member_id:
            # Trainer or owner querying a member
            if request.user.role not in ("TRAINER", "OWNER"):
                raise PermissionDenied(
                    "Only trainers and owners can query other members."
                )
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                return User.objects.get(pk=member_id, role="MEMBER")
            except User.DoesNotExist:
                raise NotFound("Member not found.")
        return request.user

    def get(self, request):
        member = self._get_member(request)
        qs = Biometric.objects.filter(member=member).order_by("-recorded_at")

        def latest_val(field):
            entry = qs.filter(**{f"{field}__isnull": False}).first()
            return getattr(entry, field, None) if entry else None

        last_entry = qs.first()
        bmi_val = latest_val("bmi")

        snapshot = {
            "weight_kg": latest_val("weight_kg"),
            "body_fat_pct": latest_val("body_fat_pct"),
            "muscle_mass_kg": latest_val("muscle_mass_kg"),
            "bmi": bmi_val,
            "bmi_category": Biometric.bmi_category(bmi_val),
            "resting_hr_bpm": latest_val("resting_hr_bpm"),
            "systolic_bp": latest_val("systolic_bp"),
            "diastolic_bp": latest_val("diastolic_bp"),
            "last_entry_at": last_entry.recorded_at if last_entry else None,
        }

        serializer = BiometricLatestSerializer(snapshot)
        return Response(serializer.data)


# ══════════════════════════════════════════════
#  TRENDS — TimescaleDB time_bucket aggregation
# ══════════════════════════════════════════════


class BiometricTrendsView(APIView):
    """
    GET /api/biometrics/trends/
    Returns aggregated weekly or monthly averages using TimescaleDB's
    time_bucket() function for maximum efficiency.

    Query params:
      ?granularity=weekly|monthly   (default: weekly)
      ?from=YYYY-MM-DD              (default: 90 days ago)
      ?to=YYYY-MM-DD                (default: today)
      ?member_id=<uuid>             (trainer/owner only)

    Response: list of trend buckets, oldest first (good for charting).
    """

    permission_classes = [IsAuthenticated]

    def _get_member(self, request):
        member_id = request.query_params.get("member_id")
        if member_id:
            if request.user.role not in ("TRAINER", "OWNER"):
                raise PermissionDenied(
                    "Only trainers and owners can query other members."
                )
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                return User.objects.get(pk=member_id, role="MEMBER")
            except User.DoesNotExist:
                raise NotFound("Member not found.")
        return request.user

    def get(self, request):
        member = self._get_member(request)
        granularity = request.query_params.get("granularity", "weekly").lower()
        date_from = _parse_date_param(
            request, "from", default=timezone.now() - timedelta(days=90)
        )
        date_to = _parse_date_param(request, "to", default=timezone.now())

        if granularity not in ("weekly", "monthly"):
            raise ValidationError({"granularity": "Must be 'weekly' or 'monthly'."})

        interval = "1 week" if granularity == "weekly" else "1 month"
        period_format = "IYYY-IW" if granularity == "weekly" else "YYYY-MM"

        # ── TimescaleDB time_bucket() raw query ────────────────────────
        # time_bucket() is a TimescaleDB function that truncates timestamps
        # into fixed-size intervals — far faster than date_trunc on hypertables.
        sql = """
            SELECT
                to_char(time_bucket(%s, recorded_at), %s)      AS period,
                ROUND(AVG(weight_kg)::numeric,    2)::float    AS avg_weight_kg,
                ROUND(AVG(body_fat_pct)::numeric, 2)::float    AS avg_body_fat,
                ROUND(AVG(bmi)::numeric,          2)::float    AS avg_bmi,
                ROUND(AVG(resting_hr_bpm)::numeric,2)::float   AS avg_hr_bpm,
                COUNT(*)                                        AS reading_count
            FROM biometrics
            WHERE member_id = %s
              AND recorded_at >= %s
              AND recorded_at <= %s
            GROUP BY time_bucket(%s, recorded_at)
            ORDER BY time_bucket(%s, recorded_at) ASC
        """

        params = [
            interval,
            period_format,
            str(member.id),
            date_from,
            date_to,
            interval,
            interval,
        ]

        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()

        buckets = [dict(zip(columns, row)) for row in rows]
        serializer = BiometricTrendPointSerializer(buckets, many=True)
        return Response(
            {
                "member_id": str(member.id),
                "granularity": granularity,
                "from": date_from.date().isoformat(),
                "to": date_to.date().isoformat(),
                "buckets": serializer.data,
            }
        )


# ══════════════════════════════════════════════
#  TRAINER — read a member's biometrics
# ══════════════════════════════════════════════


class TrainerMemberBiometricsView(generics.ListAPIView):
    """
    GET /api/biometrics/member/{member_id}/
    Trainer reads a specific member's recent biometric history.
    The member must be assigned to this trainer.

    Query params:
      ?from=YYYY-MM-DD
      ?to=YYYY-MM-DD
      ?limit=50
    """

    serializer_class = BiometricReadSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def _get_member(self):
        from django.contrib.auth import get_user_model
        from members.models import MemberEnrollment

        User = get_user_model()
        trainer = self.request.user.trainer_profile

        try:
            member = User.objects.get(pk=self.kwargs["member_id"], role="MEMBER")
        except User.DoesNotExist:
            raise NotFound("Member not found.")

        # Trainer must have this member assigned
        if not MemberEnrollment.objects.filter(
            member=member,
            trainer=trainer,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise PermissionDenied("This member is not assigned to you.")

        return member

    def get_queryset(self):
        member = self._get_member()
        date_from = _parse_date_param(
            self.request, "from", default=timezone.now() - timedelta(days=90)
        )
        date_to = _parse_date_param(self.request, "to", default=timezone.now())
        limit = min(int(self.request.query_params.get("limit", 50)), 200)

        return (
            Biometric.objects.filter(
                member=member, recorded_at__gte=date_from, recorded_at__lte=date_to
            )
            .select_related("member")
            .order_by("-recorded_at")[:limit]
        )
