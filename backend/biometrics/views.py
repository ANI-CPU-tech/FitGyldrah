from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from django.db.models import Avg, Count
from django.db.models.functions import TruncWeek, TruncMonth
from django.utils import timezone

from datetime import timedelta

from authentication.permissions import IsMember, IsTrainer, IsOwner
from trainers.models import GymApplication

from .models import Biometric
from .serializers import (
    BiometricReadSerializer,
    BiometricWriteSerializer,
    BiometricTrendSerializer,
    BiometricLatestSerializer,
)


# ── Helpers ────────────────────────────────────────────────────────────────


def get_date_range(request):
    """
    Parse ?from_date=YYYY-MM-DD and ?to_date=YYYY-MM-DD from query params.
    Defaults: last 90 days.
    """
    from datetime import datetime

    now = timezone.now()
    to_date = request.query_params.get("to_date")
    from_date = request.query_params.get("from_date")

    try:
        to_dt = (
            datetime.strptime(to_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if to_date
            else now
        )
        from_dt = (
            datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if from_date
            else now - timedelta(days=90)
        )
    except ValueError:
        from rest_framework.exceptions import ValidationError

        raise ValidationError("Date format must be YYYY-MM-DD.")

    return from_dt, to_dt


def bmi_category(bmi):
    if bmi is None:
        return None
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25.0:
        return "Normal"
    if bmi < 30.0:
        return "Overweight"
    return "Obese"


# ══════════════════════════════════════════════
#  MEMBER VIEWS
# ══════════════════════════════════════════════


class LogBiometricView(APIView):
    """
    POST /api/biometrics/
    Member logs a new biometric reading.
    BMI is auto-calculated from weight + height if not provided.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def post(self, request):
        serializer = BiometricWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(user=request.user)
        return Response(
            BiometricReadSerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class BiometricHistoryView(generics.ListAPIView):
    """
    GET /api/biometrics/
    Member's full reading history — time-range filtered.
    ?from_date=YYYY-MM-DD  (default: 90 days ago)
    ?to_date=YYYY-MM-DD    (default: today)
    ?limit=50              (default: 100)

    This hits the TimescaleDB hypertable — time-range queries
    are handled by chunk exclusion (O(chunks) not O(rows)).
    """

    serializer_class = BiometricReadSerializer
    permission_classes = [IsAuthenticated, IsMember]

    def get_queryset(self):
        from_dt, to_dt = get_date_range(self.request)
        limit = int(self.request.query_params.get("limit", 100))
        return Biometric.objects.filter(
            user=self.request.user, recorded_at__range=(from_dt, to_dt)
        ).order_by("-recorded_at")[:limit]


class BiometricLatestView(APIView):
    """
    GET /api/biometrics/latest/
    Returns the most recent value for every metric,
    plus delta (change) from the previous reading for weight and body fat.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def get(self, request):
        readings = (
            Biometric.objects.filter(user=request.user).order_by("-recorded_at")[
                :2
            ]  # latest + one before for delta
        )

        if not readings:
            return Response(
                {"detail": "No biometric readings found. Log your first entry."},
                status=status.HTTP_404_NOT_FOUND,
            )

        latest = readings[0]
        prev = readings[1] if len(readings) > 1 else None

        def delta(new, old):
            if new is None or old is None:
                return None
            return round(new - old, 2)

        bmi_val = latest.bmi
        data = {
            "latest_weight": latest.weight,
            "latest_height": latest.height,
            "latest_body_fat": latest.body_fat_pct,
            "latest_muscle_mass": latest.muscle_mass,
            "latest_bmi": bmi_val,
            "latest_bmi_category": bmi_category(bmi_val),
            "latest_waist": latest.waist_cm,
            "latest_resting_hr": latest.resting_hr,
            "last_recorded_at": latest.recorded_at,
            "weight_delta": delta(latest.weight, prev.weight if prev else None),
            "body_fat_delta": delta(
                latest.body_fat_pct, prev.body_fat_pct if prev else None
            ),
        }

        serializer = BiometricLatestSerializer(data)
        return Response(serializer.data)


class BiometricTrendsView(APIView):
    """
    GET /api/biometrics/trends/
    Aggregated averages over time — uses TimescaleDB's time_bucket-friendly
    Django ORM TruncWeek / TruncMonth under the hood.

    ?granularity=weekly|monthly  (default: weekly)
    ?from_date=YYYY-MM-DD
    ?to_date=YYYY-MM-DD

    Response: list of { period, avg_weight, avg_body_fat, avg_bmi,
                         avg_muscle_mass, avg_resting_hr, reading_count }
    """

    permission_classes = [IsAuthenticated, IsMember]

    def get(self, request):
        from_dt, to_dt = get_date_range(request)
        granularity = request.query_params.get("granularity", "weekly").lower()

        trunc_fn = TruncWeek if granularity == "weekly" else TruncMonth

        rows = (
            Biometric.objects.filter(
                user=request.user, recorded_at__range=(from_dt, to_dt)
            )
            .annotate(period_bucket=trunc_fn("recorded_at"))
            .values("period_bucket")
            .annotate(
                avg_weight=Avg("weight"),
                avg_body_fat=Avg("body_fat_pct"),
                avg_bmi=Avg("bmi"),
                avg_muscle_mass=Avg("muscle_mass"),
                avg_resting_hr=Avg("resting_hr"),
                reading_count=Count("id"),
            )
            .order_by("period_bucket")
        )

        # Format period label
        fmt = "%Y-W%W" if granularity == "weekly" else "%Y-%m"
        data = [
            {
                "period": row["period_bucket"].strftime(fmt),
                "avg_weight": round(row["avg_weight"], 2)
                if row["avg_weight"]
                else None,
                "avg_body_fat": round(row["avg_body_fat"], 2)
                if row["avg_body_fat"]
                else None,
                "avg_bmi": round(row["avg_bmi"], 2) if row["avg_bmi"] else None,
                "avg_muscle_mass": round(row["avg_muscle_mass"], 2)
                if row["avg_muscle_mass"]
                else None,
                "avg_resting_hr": round(row["avg_resting_hr"], 1)
                if row["avg_resting_hr"]
                else None,
                "reading_count": row["reading_count"],
            }
            for row in rows
        ]

        serializer = BiometricTrendSerializer(data, many=True)
        return Response(
            {
                "granularity": granularity,
                "from_date": from_dt.date().isoformat(),
                "to_date": to_dt.date().isoformat(),
                "results": serializer.data,
            }
        )


class DeleteBiometricView(APIView):
    """
    DELETE /api/biometrics/{id}/
    Member deletes a specific reading they own.
    """

    permission_classes = [IsAuthenticated, IsMember]

    def delete(self, request, pk):
        try:
            entry = Biometric.objects.get(pk=pk, user=request.user)
        except Biometric.DoesNotExist:
            raise NotFound("Biometric entry not found.")
        entry.delete()
        return Response(
            {"detail": "Biometric entry deleted."},
            status=status.HTTP_200_OK,
        )


# ══════════════════════════════════════════════
#  TRAINER VIEW — read a client's biometrics
# ══════════════════════════════════════════════


class TrainerMemberBiometricsView(generics.ListAPIView):
    """
    GET /api/biometrics/member/{member_id}/
    Trainer reads their assigned member's biometric history.
    Used by the AI engine to build diet/workout plan context.
    ?from_date= ?to_date= ?limit=
    """

    serializer_class = BiometricReadSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        member_id = self.kwargs["member_id"]
        trainer = self.request.user.trainer_profile

        # Trainer must have this member actively assigned
        from members.models import MemberEnrollment

        if not MemberEnrollment.objects.filter(
            trainer=trainer,
            member_id=member_id,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise PermissionDenied("This member is not assigned to you.")

        from_dt, to_dt = get_date_range(self.request)
        limit = int(self.request.query_params.get("limit", 50))

        return Biometric.objects.filter(
            user_id=member_id, recorded_at__range=(from_dt, to_dt)
        ).order_by("-recorded_at")[:limit]


class TrainerMemberLatestBiometricView(APIView):
    """
    GET /api/biometrics/member/{member_id}/latest/
    Trainer gets the latest biometric snapshot of their assigned member.
    This is what the AI engine calls before generating a plan.
    """

    permission_classes = [IsAuthenticated, IsTrainer]

    def get(self, request, member_id):
        trainer = request.user.trainer_profile

        from members.models import MemberEnrollment

        if not MemberEnrollment.objects.filter(
            trainer=trainer,
            member_id=member_id,
            status=MemberEnrollment.Status.ACTIVE,
        ).exists():
            raise PermissionDenied("This member is not assigned to you.")

        readings = Biometric.objects.filter(user_id=member_id).order_by("-recorded_at")[
            :2
        ]

        if not readings:
            return Response(
                {"detail": "No biometric data found for this member."},
                status=status.HTTP_404_NOT_FOUND,
            )

        latest = readings[0]
        prev = readings[1] if len(readings) > 1 else None

        def delta(new, old):
            if new is None or old is None:
                return None
            return round(new - old, 2)

        bmi_val = latest.bmi
        data = {
            "latest_weight": latest.weight,
            "latest_height": latest.height,
            "latest_body_fat": latest.body_fat_pct,
            "latest_muscle_mass": latest.muscle_mass,
            "latest_bmi": bmi_val,
            "latest_bmi_category": bmi_category(bmi_val),
            "latest_waist": latest.waist_cm,
            "latest_resting_hr": latest.resting_hr,
            "last_recorded_at": latest.recorded_at,
            "weight_delta": delta(latest.weight, prev.weight if prev else None),
            "body_fat_delta": delta(
                latest.body_fat_pct, prev.body_fat_pct if prev else None
            ),
        }

        return Response(BiometricLatestSerializer(data).data)
