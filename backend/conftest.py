"""
Root conftest.py for backend tests.

This file makes common fixtures available to all test files and configures
the test environment to use a dummy cache backend instead of Redis.
"""


def pytest_configure():
    """
    Configure pytest and Django settings before tests run.

    This runs before Django is fully initialized, allowing us to override
    cache settings to use dummy backend instead of Redis.
    """
    import os

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    # Set test mode flag so settings.py knows we're in test mode
    os.environ["PYTEST_RUNNING"] = "1"

    from django.conf import settings

    # Override cache settings to use dummy backend
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.dummy.DummyCache",
        }
    }


# Import common fixtures so they're available to all tests
pytest_plugins = [
    "common.tests.shared_fixtures",
]
