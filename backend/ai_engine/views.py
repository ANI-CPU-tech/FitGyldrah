from rest_framework import generics, serializers as drf_serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, PermissionDenied

from authentication.permissions import IsTrainer
from .models import AIPromptLog


# ══════════════════════════════════════════════
#  SERIALIZERS
# ══════════════════════════════════════════════


class AIPromptLogSummarySerializer(drf_serializers.ModelSerializer):
    """Lightweight list card — omits heavy prompt/response text fields."""

    member_name = drf_serializers.CharField(source="member.name", read_only=True)
    plan_id = drf_serializers.SerializerMethodField()
    status_label = drf_serializers.CharField(
        source="get_gen_status_display", read_only=True
    )

    class Meta:
        model = AIPromptLog
        fields = [
            "id",
            "plan_type",
            "member_name",
            "plan_id",
            "model_used",
            "total_tokens",
            "gen_status",
            "status_label",
            "extra_instructions",
            "created_at",
            "completed_at",
        ]

    def get_plan_id(self, obj):
        return str(obj.plan.id) if obj.plan else None


class AIPromptLogDetailSerializer(drf_serializers.ModelSerializer):
    """Full log — includes system prompt, user prompt, and raw Groq response."""

    trainer_name = drf_serializers.CharField(source="trainer.user.name", read_only=True)
    member_name = drf_serializers.CharField(source="member.name", read_only=True)
    plan_id = drf_serializers.SerializerMethodField()
    status_label = drf_serializers.CharField(
        source="get_gen_status_display", read_only=True
    )

    class Meta:
        model = AIPromptLog
        fields = [
            "id",
            "plan_type",
            "trainer_name",
            "member_name",
            "plan_id",
            "celery_task_id",
            "model_used",
            "system_prompt",
            "user_prompt",
            "raw_response",
            "error_message",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "gen_status",
            "status_label",
            "extra_instructions",
            "created_at",
            "completed_at",
        ]

    def get_plan_id(self, obj):
        return str(obj.plan.id) if obj.plan else None


# ══════════════════════════════════════════════
#  VIEWS
# ══════════════════════════════════════════════


class AILogListView(generics.ListAPIView):
    """
    GET /api/ai/logs/
    Trainer sees their full AI generation history (summary cards).

    Query params:
      ?plan_type=DIET|WORKOUT
      ?status=PENDING|SUCCESS|FAILED
    """

    serializer_class = AIPromptLogSummarySerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_queryset(self):
        trainer = self.request.user.trainer_profile
        qs = AIPromptLog.objects.filter(trainer=trainer).select_related(
            "member", "plan"
        )

        type_f = self.request.query_params.get("plan_type")
        status_f = self.request.query_params.get("status")

        if type_f:
            qs = qs.filter(plan_type=type_f.upper())
        if status_f:
            qs = qs.filter(gen_status=status_f.upper())

        return qs


class AILogDetailView(generics.RetrieveDestroyAPIView):
    """
    GET    /api/ai/logs/{id}/
    Returns full log including system prompt, user prompt, and raw Groq response.
    Useful for debugging failed or unexpected generations.

    DELETE /api/ai/logs/{id}/
    Removes the log entry (does not delete the associated plan).
    """

    serializer_class = AIPromptLogDetailSerializer
    permission_classes = [IsAuthenticated, IsTrainer]

    def get_object(self):
        try:
            log = AIPromptLog.objects.select_related(
                "trainer__user", "member", "plan"
            ).get(pk=self.kwargs["pk"])
        except AIPromptLog.DoesNotExist:
            raise NotFound("AI log entry not found.")

        if log.trainer.user != self.request.user:
            raise PermissionDenied("This log does not belong to you.")

        return log
