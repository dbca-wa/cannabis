"""Local settings for the legacy import app sweep: throttling switched off.

Used only by ``etl/verify/run_app_sweep.sh`` for the backend it starts for the
sweep. The app's own settings are unchanged, and throttling is back the moment
that backend stops.
"""

from config.settings import *  # noqa: F401,F403

_unlimited = {
    scope: "1000000/hour"
    for scope in REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})  # noqa: F405
}

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": [],
    # Views that name their own throttle (e.g. system settings) still look up a
    # rate, so every scope is given one too high to reach.
    "DEFAULT_THROTTLE_RATES": _unlimited,
}
