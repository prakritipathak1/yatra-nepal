import os
from pathlib import Path
from datetime import timedelta
from platform import system

from decouple import Csv, config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-yatranepal-dev-key")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())
GOOGLE_MAPS_API_KEY = config("GOOGLE_MAPS_API_KEY", default="")
SIGNCODE = config("SIGNCODE", default="")

IS_WINDOWS = system().lower().startswith("win")
os.environ.setdefault("YATRANEPAL_GIS_ENABLED", "0" if IS_WINDOWS else "1")

# Prefer the native PostGIS stack when available, but avoid forcing Linux-only
# GDAL paths on Windows hosts where the runtime libraries are not installed.
if not IS_WINDOWS:
    os.environ.setdefault("GDAL_LIBRARY_PATH", "/usr/lib/x86_64-linux-gnu/libgdal.so")
    os.environ.setdefault("GEOS_LIBRARY_PATH", "/usr/lib/x86_64-linux-gnu/libgeos_c.so")
    os.environ.setdefault("PROJ_LIB", "/usr/share/proj")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_celery_beat",
    "users",
    "trips",
    "weather",
    "risk",
    "frontend",
]

if not IS_WINDOWS:
    INSTALLED_APPS.insert(6, "django.contrib.gis")

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "yatranepal.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "yatranepal.settings.google_maps_api_key",
            ],
        },
    },
]

WSGI_APPLICATION = "yatranepal.wsgi.application"

default_database_url = config(
    "DATABASE_URL",
    default="postgis://postgres:1144@localhost:5432/yatranepal",
)
database_engine = config(
    "DATABASE_ENGINE",
    default="django.db.backends.postgresql" if IS_WINDOWS else "django.contrib.gis.db.backends.postgis",
)
DATABASES = {
    "default": dj_database_url.parse(default_database_url, engine=database_engine)
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:8000,http://127.0.0.1:8000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

REDIS_URL = config("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "yatranepal-local-cache",
        }
    }

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CELERY_BROKER_URL = REDIS_URL or "redis://localhost:6379/0"
if REDIS_URL:
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
else:
    CELERY_BROKER_URL = "memory://"
    CELERY_RESULT_BACKEND = "cache+memory://"
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


def google_maps_api_key(request):
    return {"GOOGLE_MAPS_API_KEY": GOOGLE_MAPS_API_KEY}
