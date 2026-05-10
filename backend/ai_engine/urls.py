from django.urls import path
from .views import AILogListView, AILogDetailView

urlpatterns = [
    # GET  → trainer's AI generation history (summary)
    #        ?plan_type=DIET|WORKOUT   ?status=PENDING|SUCCESS|FAILED
    path("logs/", AILogListView.as_view(), name="ai-log-list"),
    # GET    → full log detail (system prompt + user prompt + raw response)
    # DELETE → remove a log entry
    path("logs/<uuid:pk>/", AILogDetailView.as_view(), name="ai-log-detail"),
]
