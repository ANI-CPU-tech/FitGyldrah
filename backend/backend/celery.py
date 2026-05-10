import os
from celery import Celery

# CHANGE THIS LINE:
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

# CHANGE THIS LINE:
app = Celery("backend")

# Pull all CELERY_* keys from Django settings
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py in every INSTALLED_APP
app.autodiscover_tasks()
