"""
Cache Configuration for Cannabis Backend

This module configures application-level caching using Django's cache framework.

Cache backends (in order of preference):
1. Redis (if REDIS_URL is set and reachable): Shared across all Gunicorn workers
2. LocMemCache (fallback): Per-process in-memory cache, no infrastructure needed
3. DummyCache (tests only): No-op cache for test isolation

Note: Organisational Edge proxy (Nginx/Varnish/Fastly) handles HTTP-level caching.
This cache is for application-level caching (e.g., IT Assets API responses) that
cannot be cached at the HTTP level.
"""

import logging
import os

logger = logging.getLogger(__name__)

# Track Redis availability globally for other modules
REDIS_AVAILABLE = False


def get_cache_config():
    """
    Get cache configuration based on environment.

    Priority:
    - Tests: Always dummy cache (no caching, test isolation)
    - Redis available: Shared cache across all workers (best performance)
    - No Redis: LocMemCache per worker (still caches IT Assets etc.)

    Sets global REDIS_AVAILABLE flag for other components (e.g., throttling).

    Returns:
        dict: Django CACHES configuration
    """
    global REDIS_AVAILABLE

    redis_url = os.environ.get("REDIS_URL")
    is_testing = os.environ.get("PYTEST_RUNNING", "0") == "1"
    environment = os.environ.get("ENVIRONMENT", "local")

    # Always use dummy cache for tests
    if is_testing:
        logger.info("CACHE: Using dummy cache for tests (Redis not required)")
        REDIS_AVAILABLE = False
        return {
            "default": {
                "BACKEND": "django.core.cache.backends.dummy.DummyCache",
            }
        }

    # Try Redis if URL is provided
    if redis_url:
        try:
            # Test Redis connection with short timeout
            import redis

            client = redis.from_url(redis_url, socket_connect_timeout=2)
            client.ping()
            client.close()

            logger.info(f"CACHE: Redis connected successfully ({redis_url})")
            logger.info("CACHE: Caching ENABLED")
            logger.info("CACHE: Rate limiting ENABLED")
            REDIS_AVAILABLE = True

            return {
                "default": {
                    "BACKEND": "django_redis.cache.RedisCache",
                    "LOCATION": redis_url,
                    "OPTIONS": {
                        "CLIENT_CLASS": "django_redis.client.DefaultClient",
                        "SOCKET_CONNECT_TIMEOUT": 5,
                        "SOCKET_TIMEOUT": 5,
                        "RETRY_ON_TIMEOUT": True,
                        "MAX_CONNECTIONS": 50,
                        "CONNECTION_POOL_KWARGS": {
                            "max_connections": 50,
                            "retry_on_timeout": True,
                        },
                    },
                    "KEY_PREFIX": "cannabis",
                    "TIMEOUT": 300,  # 5 minutes default TTL
                }
            }
        except Exception as e:
            logger.warning(f"CACHE: Redis connection failed ({redis_url}): {e}")
            logger.warning("CACHE: Falling back to in-memory cache (per-worker)")
            logger.warning("CACHE: Rate limiting DISABLED (Redis unavailable)")
            if environment in ["staging", "production"]:
                logger.warning(
                    f"CACHE: Redis is recommended for {environment}. "
                    "See documentation for setup instructions."
                )
            REDIS_AVAILABLE = False
    else:
        logger.info("CACHE: REDIS_URL not set")
        logger.info("CACHE: Using in-memory cache (per-worker, no Redis needed)")
        logger.info("CACHE: Rate limiting DISABLED (no Redis configured)")
        REDIS_AVAILABLE = False

    # Use in-memory cache when Redis unavailable — still caches within each
    # Gunicorn worker process (IT Assets API, etc.), just not shared across workers
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "cannabis-locmem",
            "TIMEOUT": 300,  # 5 minutes default TTL
        }
    }


# Export cache configuration
CACHES = get_cache_config()

# Cache Key Patterns
# Use these patterns for consistent cache key generation across the application
CACHE_KEYS = {
    # User-related caches (5 minute TTL)
    "user_cases": "user:{user_id}:cases",
    "user_profile": "user:{user_id}:profile",
    # External API caches (5 minute TTL)
    "external_users_search": "external_users_search:{query}",
}

# Cache TTL (Time To Live) values in seconds
CACHE_TTL = {
    "user_cases": 300,  # 5 minutes - frequently accessed, changes occasionally
    "user_profile": 600,  # 10 minutes - moderately accessed, changes occasionally
    "external_users_search": 300,  # 5 minutes - IT Assets API results
}
