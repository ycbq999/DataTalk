import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("thesiswatch")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.conf.update(
    accept_content=["json"],
    broker_connection_timeout=3,
    broker_connection_max_retries=5,
    broker_transport_options={
        "socket_connect_timeout": 3,
        "socket_timeout": 3,
        "retry_on_timeout": False,
        "max_retries": 0,
        "visibility_timeout": 300,
    },
    task_ignore_result=True,
    task_publish_retry=False,
    worker_prefetch_multiplier=1,
)
app.autodiscover_tasks()
