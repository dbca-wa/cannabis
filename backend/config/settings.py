# region Imports ===============================================================================
import logging, os, sentry_sdk, dj_database_url, environ
from logging import LogRecord
from pathlib import Path
from datetime import timedelta

# endregion ========================================================================================

# region Project ENV ===================================================================

BASE_DIR = Path(__file__).resolve().parent.parent

# Environ detection
env = environ.Env()
ENVIRONMENT = env("ENVIRONMENT", default="local")
# Dynamically determine the env file path
env_file = os.path.join(BASE_DIR, f".{ENVIRONMENT}.env")

if os.path.exists(env_file):
    env.read_env(
        env_file, overwrite=True
    )  # Env takes precedence over shell / pc configured vars

# Core settings
SECRET_KEY = env("SECRET_KEY")
DATABASE_URL = env("DATABASE_URL")
DEBUG = ENVIRONMENT == "development" or ENVIRONMENT == "local"
EXTERNAL_PASS = env("EXTERNAL_PASS")

# App configuration
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_NUMBER_FIELDS = 2500
PAGE_SIZE = 10
USER_LIST_PAGE_SIZE = 250
FILE_UPLOAD_PERMISSIONS = None  # Use default operating system file permissions
# APPEND_SLASH=False


# API configurations
EXTERNAL_PASS = env("EXTERNAL_PASS")
IT_ASSETS_ACCESS_TOKEN = env("IT_ASSETS_ACCESS_TOKEN")
IT_ASSETS_USER = env("IT_ASSETS_USER")
IT_ASSETS_URLS = env("IT_ASSETS_URL")

# Domain configuration
DOMAINS = {
    "main": env("MAIN_DOMAIN"),
}


# Site URL configuration
if DEBUG:
    SITE_URL = DOMAINS["main"]
    INSTANCE_URL = "http://127.0.0.1:8000/"
else:
    SITE_URL = f"https://{DOMAINS['main']}"
    INSTANCE_URL = SITE_URL
SITE_URL_HTTP = SITE_URL if DEBUG else f"https://{DOMAINS['main']}"


# Prince server configuration
PRINCE_SERVER_URL = env("PRINCE_SERVER_URL", default="")
if not DEBUG and not PRINCE_SERVER_URL:
    PRINCE_SERVER_URL = str(BASE_DIR)

# endregion ========================================================================================

# region Internationalisation ==========================================================
TIME_ZONE = "Australia/Perth"
TZ = "Australia/Perth"
LANGUAGE_CODE = "en-au"
USE_I18N = True
USE_TZ = True

# endregion ========================================================================================

# region Media, Roots and Storage =====================================================
ROOT_URLCONF = "config.urls"
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

if DEBUG:
    # Development: Use local file storage
    DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
    MEDIA_URL = "/files/"
    MEDIA_ROOT = os.path.join(BASE_DIR, "files")
else:
    # Production: Use Azure Blob Storage
    DEFAULT_FILE_STORAGE = "storages.backends.azure_storage.AzureStorage"
    AZURE_ACCOUNT_NAME = env("AZURE_ACCOUNT_NAME")
    AZURE_ACCOUNT_KEY = env("AZURE_ACCOUNT_KEY")
    AZURE_CONTAINER = env("AZURE_CONTAINER", default="media")


# STATICFILES_STORAGE = "storages.backends.azure_storage.AzureStorage"
# DEFAULT_FILE_STORAGE = "storages.backends.azure_storage.AzureStorage"
# STORAGES = {
#     "default": {
#         "BACKEND": "storages.backends.azure_storage.AzureStorage",
#     },
# }

# endregion ========================================================================================

# region Email Config =========================================================
EMAIL_HOST = os.environ.get("EMAIL_HOST", "mail-relay.lan.fyi")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")
ENVELOPE_EMAIL_RECIPIENTS = [env("MAINTAINER_EMAIL")]
ENVELOPE_USE_HTML_EMAIL = True

# endregion ========================================================================================

# region Database =============================================================
# DATABASES = {"default": dj_database_url.config()}
# DATABASES = {"default": dj_database_url.parse(DATABASE_URL)}
DATABASES = {"default": env.db()}

# Prod database optimisations
if not DEBUG:
    DATABASES["default"].update(
        {
            "CONN_MAX_AGE": 60,  # Connection pooling
            "OPTIONS": {
                "connect_timeout": 30,
                # "read_timeout": 60, # Invalid in this version
                # "write_timeout": 60, # Invalid in this version
            },
        }
    )

# endregion ========================================================================================

# region Auth =========================================================
AUTH_USER_MODEL = "users.User"
AUTHENTICATION_BACKENDS = ("django.contrib.auth.backends.ModelBackend",)
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# endregion ========================================================================================

# region CORS, CSRF and Hosts =========================================================

# Get unique domains
if DEBUG:
    ALLOWED_HOSTS = [
        "127.0.0.1",
        "localhost",
        "0.0.0.0",
        "127.0.0.1:3000",
        "127.0.0.1:8000",
        "0.0.0.0:8000",
    ]
else:
    ALLOWED_HOSTS = list(set(DOMAINS.values()))

# Remove duplicates
ALLOWED_HOSTS = list(set(ALLOWED_HOSTS))

# CSRF trusted origins
if DEBUG:
    CSRF_TRUSTED_ORIGINS = [
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:8000",
        "http://0.0.0.0",
    ]
else:
    CSRF_TRUSTED_ORIGINS = [f"https://{domain}" for domain in DOMAINS.values()]

CSRF_COOKIE_NAME = "cannabis_cookie"  # Set custom CSRF cookie name

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "OPTIONS",
    "PUT",
    "DELETE",
]
CORS_ALLOW_HEADERS = [
    "X-CSRFToken",
    "Content-Type",
    "Authorization",
    "x-request-id",
]

if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://127\.0\.0\.1:3000$",
    ]
# else: # handled by nginx
#     if not hasattr(globals(), "_CORS_CONFIGURED"):
#         CORS_ALLOWED_ORIGINS = [f"https://{domain}" for domain in ALLOWED_HOSTS]
#         print(f"DEBUG: CORS_ALLOWED_ORIGINS = {CORS_ALLOWED_ORIGINS}")
#         globals()["_CORS_CONFIGURED"] = True


if not DEBUG:
    # Secure cookie configuration for production
    SESSION_COOKIE_DOMAIN = ".dbca.wa.gov.au"
    CSRF_COOKIE_DOMAIN = ".dbca.wa.gov.au"

    # Cross-site settings for multi-domain setup
    CSRF_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SAMESITE = "None"

    # Security settings
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True

    # Additional security headers (handled by Nginx)
    # SECURE_SSL_REDIRECT = True
    # SECURE_HSTS_SECONDS = 31536000  # 1 year
    # SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"


# endregion ========================================================================================

# region Application definitions ======================================================
SYSTEM_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt",
]

CUSTOM_APPS = [
    "common.apps.CommonConfig",
    "users.apps.UsersConfig",
    "police.apps.PoliceConfig",
    "submissions.apps.SubmissionsConfig",
    "communications.apps.CommunicationsConfig",
]

INSTALLED_APPS = SYSTEM_APPS + THIRD_PARTY_APPS + CUSTOM_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # "config.dbca_middleware.DBCAMiddleware", # wont be creating accounts via Auth2/SSO
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# endregion ========================================================================================


# region JWT =======================================================================

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        # "rest_framework.authentication.SessionAuthentication", #no django admin
    ],
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": SECRET_KEY,
    "ALGORITHM": "HS256",
}
# endregion ========================================================================================


# region Logs and Tracking =======================================================================
if ENVIRONMENT != "development" and ENVIRONMENT != "local":
    sentry_sdk.init(
        environment=ENVIRONMENT,
        dsn=env("SENTRY_URL"),
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )


class ColoredFormatter(logging.Formatter):
    def color_string(self, string, color):
        colors = {
            "blue": "\033[94m",
            "cyan": "\033[96m",
            "green": "\033[92m",
            "white": "\033[97m",
            "yellow": "\033[93m",
            "red": "\033[91m",
        }
        ft = f"{colors[color]}{string}\033[0m"
        return ft

    def format(self, record: LogRecord) -> str:
        log_message = super().format(record)
        level = ""
        message = ""
        time = self.formatTime(record, "%d-%m-%Y @ %H:%M:%S")
        traceback = ""
        # time = self.formatTime(record, "%Y-%m-%d %H:%M:%S")

        if record.levelname == "DEBUG" or record.levelname == "INFO":
            level = self.color_string(f"[{record.levelname}] {record.message}", "white")
            message = self.color_string(log_message, "white")
        elif record.levelname == "WARNING":
            level = self.color_string(
                f"[{record.levelname}] {record.message}", "yellow"
            )
            message = self.color_string(log_message, "white")
        elif record.levelname == "ERROR":
            level = self.color_string(f"[{record.levelname}] {record.message}", "red")
            message = self.color_string(log_message, "white")

        if record.levelname == "ERROR":
            traceback += f"{record.exc_text}"

        if len(traceback) > 1 and traceback != "None":
            return f"{self.color_string(time, 'blue')} {level}\n{traceback}"
        else:
            return f"{self.color_string(time, 'blue')} {level}"


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "colored": {
            "()": "config.settings.ColoredFormatter",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "colored",
            "filters": [],
        }
    },
    "loggers": {
        logger_name: {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        }
        for logger_name in (
            "django",
            "django.request",
            "django.db.backends",
            "django.template",
            "core",
        )
    },
    "root": {
        "level": "DEBUG",
        "handlers": ["console"],
    },
}

LOGGER = logging.getLogger(__name__)

# endregion ========================================================================================
