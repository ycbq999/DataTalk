import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent


def enabled(name, default=False):
    return os.environ.get(name, str(int(default))).lower() in {"1", "true", "yes"}


def values(name, default=""):
    return [value.strip() for value in os.environ.get(name, default).split(",") if value.strip()]


DEBUG = enabled("DJANGO_DEBUG")
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if DEBUG and not SECRET_KEY:
    SECRET_KEY = "django-insecure-local-development-only-key-for-datatalk"
if not SECRET_KEY or (not DEBUG and len(SECRET_KEY) < 50):
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY to a unique secret of at least 50 characters.")

ALLOWED_HOSTS = values("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set DJANGO_ALLOWED_HOSTS for this environment.")
CSRF_TRUSTED_ORIGINS = values("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "core",
    "research",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middleware.PrivateApiCacheControl",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
CSRF_FAILURE_VIEW = "core.views.csrf_failure"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
WSGI_APPLICATION = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

database_variable = "MIGRATION_DATABASE_URL" if enabled("MIGRATE_DB") else "DATABASE_URL"
database_url = os.environ.get(database_variable, "")
if database_url:
    database = dj_database_url.parse(database_url, conn_max_age=60, conn_health_checks=True)
    if database["ENGINE"] != "django.db.backends.postgresql":
        raise ImproperlyConfigured(f"{database_variable} must point to PostgreSQL.")
elif DEBUG and enabled("DATATALK_SQLITE") and database_variable == "DATABASE_URL":
    sqlite_path = os.environ.get("DATATALK_SQLITE_PATH") or BASE_DIR / "db.sqlite3"
    database = {"ENGINE": "django.db.backends.sqlite3", "NAME": sqlite_path}
else:
    raise ImproperlyConfigured(f"Set {database_variable} to connect to PostgreSQL.")
DATABASES = {"default": database}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

TIME_ZONE = "UTC"
USE_TZ = True
LANGUAGE_CODE = "en-us"

secure = enabled("DJANGO_SECURE_COOKIES", not DEBUG)
SESSION_COOKIE_SECURE = secure
CSRF_COOKIE_SECURE = secure
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_SSL_REDIRECT = enabled("DJANGO_SECURE_SSL_REDIRECT", secure)
SECURE_REDIRECT_EXEMPT = [r"^api/v1/(health|ready)/$"]
if enabled("DJANGO_TRUST_PROXY_HTTPS"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", 0 if DEBUG else 3600))
SECURE_HSTS_INCLUDE_SUBDOMAINS = enabled("DJANGO_HSTS_INCLUDE_SUBDOMAINS")
SECURE_HSTS_PRELOAD = enabled("DJANGO_HSTS_PRELOAD")
# Those settings require reviewing HTTPS support for the entire domain hierarchy.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
SECURE_REFERRER_POLICY = "same-origin"

UI_DIST_DIR = Path(os.environ.get("UI_DIST_DIR", BASE_DIR.parent / "frontend" / "dist"))
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [("assets", UI_DIST_DIR / "assets")] if (UI_DIST_DIR / "assets").is_dir() else []
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

RESEARCH_ENABLED = enabled("RESEARCH_ENABLED")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "")
RESEARCH_DAILY_LIMIT = int(os.environ.get("RESEARCH_DAILY_LIMIT", 5))
RESEARCH_GLOBAL_DAILY_LIMIT = int(os.environ.get("RESEARCH_GLOBAL_DAILY_LIMIT", 25))
RESEARCH_MAX_ATTEMPTS = int(os.environ.get("RESEARCH_MAX_ATTEMPTS", 2))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
