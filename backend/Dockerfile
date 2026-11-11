# syntax=docker/dockerfile:1
# Multi-stage production Dockerfile for Django backend with Prince XML

# ====================== BUILD STAGE ======================
FROM python:3.14-slim-trixie AS builder

# Build environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/usr/src/app/backend
ENV TZ="Australia/Perth"

# Install build dependencies including OCR and PDF conversion packages
RUN echo "Installing Build Dependencies." && apt-get update && apt-get install -y \
    -o Acquire::Retries=4 --no-install-recommends \
    build-essential gcc g++ dpkg-dev \
    curl wget ca-certificates \
    gdebi \
    libpq-dev \
    tesseract-ocr tesseract-ocr-eng poppler-utils \
    libjpeg62-turbo-dev zlib1g-dev libtiff-dev libwebp-dev libavif-dev \
    libfreetype-dev liblcms2-dev libopenjp2-7-dev libraqm-dev \
    libharfbuzz-dev libfribidi-dev libxcb1-dev \
    && apt-get upgrade -y

# Set working directory
WORKDIR /usr/src/app

# Install Poetry
RUN pip install --upgrade pip
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/etc/poetry python3 -
ENV PATH="${PATH}:/etc/poetry/bin"

# Install Prince XML (needed for both stages)
RUN DEB_FILE=prince.deb \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "arm64" ]; then \
    PRINCE_URL="https://www.princexml.com/download/prince_16.2-1_debian13_arm64.deb"; \
    else \
    PRINCE_URL="https://www.princexml.com/download/prince_16.2-1_debian13_amd64.deb"; \
    fi \
    && wget -O ${DEB_FILE} $PRINCE_URL \
    && yes | gdebi ${DEB_FILE} \
    && rm -f ${DEB_FILE}

# Copy only dependency files first (enables layer caching for deps)
COPY pyproject.toml poetry.lock ./backend/
WORKDIR /usr/src/app/backend

# Configure Poetry and install dependencies (cached unless pyproject/lock changes)
RUN poetry config virtualenvs.create false
# Build Pillow from source against Debian's image libraries. The PyPI wheel
# bundles its own copies (including libbrotlidec 1.2.0, CVE-2026-111497) that
# never receive Debian security updates.
RUN poetry config installer.no-binary pillow
ENV POETRY_REQUESTS_TIMEOUT=300
RUN poetry install --only=main --no-root

# Copy the rest of the project files
COPY . .
RUN rm -f ./license.dat

# Collect static files (needs dummy env vars to load Django settings)
# NOTE: Docker security scanner may warn about SECRET_KEY and IT_ASSETS_ACCESS_TOKEN
# These are DUMMY values only used during build for collectstatic - NOT real secrets
# Real secrets are injected at runtime via Rancher environment variables
ENV ENVIRONMENT="production" \
    SECRET_KEY="dummy-build-key" \
    DATABASE_URL="sqlite:///dummy.db" \
    EXTERNAL_PASS="dummy" \
    IT_ASSETS_ACCESS_TOKEN="dummy" \
    IT_ASSETS_USER="dummy" \
    IT_ASSETS_URL="http://dummy" \
    MAIN_DOMAIN="dummy.local" \
    MAINTAINER_EMAIL="dummy@dummy.local" \
    DEFAULT_FROM_EMAIL="dummy@dummy.local" \
    AZURE_ACCOUNT_NAME="dummyaccount" \
    AZURE_ACCOUNT_KEY="dummykey" \
    AZURE_CONTAINER="dummycontainer" \
    SENTRY_URL="" \
    DEBUG="False"
RUN python manage.py collectstatic --noinput

# ====================== CODE OBFUSCATION ======================
# Compile Python bytecode and remove source files for security and clean environment
RUN echo "Obfuscating Python source code..." \
    && python -m compileall -b -f . \
    && python -O -m compileall -b -f . \
    && find . -name "*.py" -not -name "manage.py" -not -path "./*/migrations/*" -not -path "./*/management/commands/*" -not -path "./*/management/*/__init__*" -delete \
    && find . -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true \
    && find . -name "*.pyc" -path "*/__pycache__/*" -delete \
    && find . -type d -name "__pycache__" -exec rmdir {} + 2>/dev/null || true

# Remove development and sensitive files
RUN echo "Removing development artifacts..." \
    && find . -name "test_*.py" -delete 2>/dev/null || true \
    && find . -name "*_test.py" -delete 2>/dev/null || true \
    && find . -name "tests.py" -delete 2>/dev/null || true \
    && find . -name "conftest.py" -delete 2>/dev/null || true \
    && find . -name ".coverage*" -delete 2>/dev/null || true \
    && find . -name "pytest.ini" -delete 2>/dev/null || true \
    && find . -name "pyproject.toml" -delete 2>/dev/null || true \
    && find . -name "poetry.lock" -delete 2>/dev/null || true \
    && find . -name "README*" -delete 2>/dev/null || true \
    && find . -name "*.md" -delete 2>/dev/null || true \
    && find . -name ".git*" -delete 2>/dev/null || true \
    && rm -f entrypoint.sh 2>/dev/null || true

# ====================== PRODUCTION STAGE ======================
FROM python:3.14-slim-trixie AS production

# Production environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/usr/src/app/backend
ENV TZ="Australia/Perth"

# Changing this date forces the runtime package layer below (and the rest of
# the stage) to rebuild, so `apt-get upgrade` picks up new Debian security
# patches instead of reusing a cached layer.
ARG OS_PACKAGES_REFRESHED=2026-11-11

# Install only runtime dependencies including OCR, PDF conversion, and font/image libs.
# Prince is installed from its .deb with dpkg + apt's dependency resolver, so we
# avoid gdebi — gdebi is a GTK application that would drag ~100 MB of GTK, icon
# themes and Perl into a headless server image purely to run the installer.
RUN echo "Installing Runtime Dependencies." && apt-get update && apt-get install -y \
    -o Acquire::Retries=4 --no-install-recommends \
    curl ca-certificates wget \
    tesseract-ocr tesseract-ocr-eng poppler-utils \
    fontconfig fonts-dejavu-core \
    libgif7 \
    libwebp7 libwebpdemux2 libwebpmux3 \
    libavif16 \
    libbrotli1 \
    libjpeg62-turbo zlib1g libtiff6 libfreetype6 liblcms2-2 libopenjp2-7 \
    libraqm0 libharfbuzz0b libfribidi0 libxcb1 \
    postgresql-client \
    && apt-get upgrade -y

# Set working directory
WORKDIR /usr/src/app

# Install Prince XML in production stage (ensures all files are in correct locations).
# dpkg -i unpacks it; apt-get install -f pulls only Prince's real runtime deps
# (no --install-recommends), then we clear apt caches in the same layer.
RUN DEB_FILE=prince.deb \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "arm64" ]; then \
    PRINCE_URL="https://www.princexml.com/download/prince_16.2-1_debian13_arm64.deb"; \
    else \
    PRINCE_URL="https://www.princexml.com/download/prince_16.2-1_debian13_amd64.deb"; \
    fi \
    && wget -O ${DEB_FILE} $PRINCE_URL \
    && (dpkg -i ${DEB_FILE} || true) \
    && apt-get install -y -f --no-install-recommends \
    && rm -f ${DEB_FILE} \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/archives/*
ENV PATH="${PATH}:/usr/lib/prince/bin"

# Fail the build if the system Brotli library is older than the patched Debian
# release (CVE-2026-111497, DSA-6582-1). Guards against stale cached layers.
ARG LIBBROTLI_MIN_VERSION=1.1.0-2+deb13u1
RUN INSTALLED=$(dpkg-query -W -f='${Version}' libbrotli1) \
    && echo "libbrotli1 ${INSTALLED} (minimum ${LIBBROTLI_MIN_VERSION})" \
    && dpkg --compare-versions "${INSTALLED}" ge "${LIBBROTLI_MIN_VERSION}"

# Copy Python packages from builder stage
COPY --from=builder /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Fail the build if Pillow was installed from a wheel with bundled libraries,
# is missing a runtime library, or lost an image format it previously had.
RUN SITE=/usr/local/lib/python3.14/site-packages \
    && test ! -d "${SITE}/pillow.libs" \
    && ! find "${SITE}/PIL" -name '*.so' -exec ldd {} \; | grep "not found" \
    && python -c "import PIL; from PIL import features; \
    want = ['jpg', 'jpg_2000', 'zlib', 'libtiff', 'webp', 'avif', 'freetype2', 'littlecms2', 'raqm', 'xcb']; \
    missing = [f for f in want if not features.check(f)]; \
    assert not missing, f'Pillow missing features: {missing}'; \
    print('Pillow', PIL.__version__, 'built against system libraries')"

# pip is not needed at runtime. Removing it keeps a package installer out of
# the production image and drops its vendored setuptools (CVE-2025-47273).
# Two copies exist (the base image's and the builder's upgraded one copied
# over it), so the files are removed explicitly and the build fails if any
# remain importable.
RUN python -m pip uninstall -y pip \
    && SITE="$(python -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')" \
    && rm -rf "${SITE}"/pip "${SITE}"/pip-*.dist-info /usr/local/bin/pip /usr/local/bin/pip3* \
    && ! python -c "import pip" 2>/dev/null

# ====================== USER & PERMISSIONS ======================

# Create a non-root user to run the app
ARG UID=10001
ARG GID=10001
RUN groupadd -g "${GID}" appuser \
    && useradd --create-home --home-dir /home/appuser --no-log-init --uid "${UID}" --gid "${GID}" appuser

# Add alias commands and configure the bash file
RUN echo '# Custom .bashrc modifications\n' \
    'fromdate="21.06.2024"\n' \
    'todate=$date\n' \
    'from=`echo $fromdate | awk -F\. '\''{print $3$2$1}'\''`\n' \
    'to=`echo $todate | awk -F\. '\''{print $3$2$1}'\''`\n' \
    'START_DATE=`date --date=$from +"%s"`\n' \
    'END_DATE=`date --date=$to +"%s"`\n' \
    'DAYS=$((($END_DATE - $START_DATE) / 86400 ))\n' \
    'RED='\''\033[0;31m'\''\n' \
    'GREEN='\''\033[0;32m'\''\n' \
    'PURPLE='\''\033[0;35m'\''\n' \
    'BLUEBG='\''\033[0;44m'\''\n' \
    'ORDBG='\''\033[0;48m'\''\n' \
    'GREENBG='\''\033[0;42m'\''\n' \
    'NC='\''\033[0m'\'' # No Color\n' \
    'LB='\''\e[94m'\'' # Light Blue\n' \
    'PS1="\n\n\[$(tput sgr0)\]\[\033[38;5;105m\]\d\[$(tput sgr0)\], \[$(tput sgr0)\]\[\033[38;5;15m\]\D{%H:%M:%S}\[$(tput sgr0)\]\n\[$(tput sgr0)\]\[\033[38;5;76m\]\w\[$(tput sgr0)\]\n\[$(tput sgr0)\]\[\033[38;5;10m\]--------------------------------\[$(tput sgr0)\]\n\[$(tput sgr0)\]\[\033[38;5;14m\]>\[$(tput sgr0)\]"\n' \
    'alias home="cd ~"\n' \
    'alias settz="export TZ=$TZ"\n' \
    'alias edit="home && vi .bashrc"\n' \
    'alias migrate="python manage.py migrate"\n' \
    'settz\n' >> /home/appuser/.bashrc

# Copy obfuscated application from builder stage
COPY --from=builder --chown=${UID}:${GID} /usr/src/app/backend ./backend
WORKDIR /usr/src/app/backend

# Create necessary directories and set permissions
RUN mkdir -p /usr/src/app/backend/staticfiles /usr/src/app/backend/media \
    && chown -R ${UID}:${GID} /usr/src/app \
    && chown -R ${UID}:${GID} /home/appuser

# Ensure fontconfig cache is writable by the app user
RUN mkdir -p /home/appuser/.cache/fontconfig \
    && chown -R ${UID}:${GID} /home/appuser/.cache

# Delete non-commercial license of Prince (using configmap)
RUN rm -f /usr/lib/prince/license/license.dat

# Add labels
LABEL org.opencontainers.image.licenses="Proprietary"
LABEL org.opencontainers.image.title="Cannabis Backend"
LABEL org.opencontainers.image.vendor="Ecoinformatics"


# ====================== LAUNCH ======================

# Switch to appuser (non-root)
USER ${UID}

# Expose port
EXPOSE 8000

# Health check (Actually performed on Rancher)
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#     CMD curl -f http://127.0.0.1:8000/health/ || exit 1

# Set TMPDIR so Gunicorn uses /tmp for all temporary files including control server socket
ENV TMPDIR=/tmp

# Launch production server
CMD ["gunicorn", "config.wsgi", "--bind", "0.0.0.0:8000", "--timeout", "300", "--graceful-timeout", "90", "--max-requests", "2048", "--workers", "3", "--preload", "--worker-tmp-dir", "/tmp", "--no-control-socket"]
