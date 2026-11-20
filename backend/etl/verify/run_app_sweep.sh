#!/bin/bash
# Check every imported legacy case through the running app, with API
# throttling switched off for the duration and back on at the end.
#
#   SWEEP_EMAIL=you@dbca.wa.gov.au SWEEP_PASSWORD='...' etl/verify/run_app_sweep.sh
#
# Run from monorepo/backend against the local database (.local.env). The account
# must be an active superuser with practice mode off.
#
# Throttling: the sweep makes several thousand API calls, more than the normal
# 1,000/hour user limit. The script stops any local backend on :8000, starts one
# with etl/verify/sweep_settings.py (no throttling), and on exit (pass, fail or
# Ctrl-C) stops it and, if a backend was running before, starts the normal one
# again so throttling is back on. Nothing outside this machine is affected.
set -u
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$BACKEND_DIR/../frontend"
LOG_DIR="$BACKEND_DIR/etl/data/modded/app_sweep"
mkdir -p "$LOG_DIR"
: "${SWEEP_EMAIL:?set SWEEP_EMAIL}"
: "${SWEEP_PASSWORD:?set SWEEP_PASSWORD}"
cd "$BACKEND_DIR" || exit 2

listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null; }
wait_for() {  # url, seconds
    for _ in $(seq "$2"); do curl -s -o /dev/null "$1" && return 0; sleep 1; done
    return 1
}

RESTORE_BACKEND=0
SWEEP_BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    if [ -n "$SWEEP_BACKEND_PID" ]; then
        pkill -P "$SWEEP_BACKEND_PID" 2>/dev/null
        kill "$SWEEP_BACKEND_PID" 2>/dev/null
        wait "$SWEEP_BACKEND_PID" 2>/dev/null
        echo "Unthrottled backend stopped; throttling is back on."
    fi
    if [ -n "$FRONTEND_PID" ]; then
        pkill -P "$FRONTEND_PID" 2>/dev/null
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    if [ "$RESTORE_BACKEND" = 1 ]; then
        nohup poetry run python manage.py runserver 127.0.0.1:8000 \
            > "$LOG_DIR/backend-restored.log" 2>&1 &
        echo "Normal backend restarted on :8000 (log: $LOG_DIR/backend-restored.log)."
    fi
}
trap cleanup EXIT INT TERM

# 1. Free :8000, but only ever stop a Django development server.
for pid in $(listening 8000); do
    if ps -o command= -p "$pid" | grep -q "manage.py runserver"; then
        kill "$pid"; RESTORE_BACKEND=1
    else
        echo "Port 8000 is used by something other than a Django dev server; stop it first."
        exit 2
    fi
done
for _ in $(seq 20); do [ -z "$(listening 8000)" ] && break; sleep 0.5; done

# 2. Unthrottled backend for the sweep only.
PYTHONPATH="$BACKEND_DIR/etl/verify" DJANGO_SETTINGS_MODULE=sweep_settings SENTRY_DSN= \
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend \
    poetry run python manage.py runserver 127.0.0.1:8000 --noreload \
    > "$LOG_DIR/backend-sweep.log" 2>&1 &
SWEEP_BACKEND_PID=$!
wait_for http://127.0.0.1:8000/health/ 60 || { echo "Backend did not start; see $LOG_DIR/backend-sweep.log"; exit 1; }

# 3. Frontend: use the one already on :3000, or start one for the sweep.
if [ -z "$(listening 3000)" ]; then
    (cd "$FRONTEND_DIR" && bun run dev --port 3000 --strictPort > "$LOG_DIR/frontend.log" 2>&1) &
    FRONTEND_PID=$!
    wait_for http://127.0.0.1:3000/ 60 || { echo "Frontend did not start; see $LOG_DIR/frontend.log"; exit 1; }
fi

# 4. The sweep.
node "$BACKEND_DIR/etl/verify/app_sweep.mjs"
