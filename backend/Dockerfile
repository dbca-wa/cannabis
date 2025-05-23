# syntax=docker/dockerfile:1
FROM python:slim
LABEL org.opencontainers.image.source=https://github.com/dbca-wa/cannabis

# Base setup ============================================================================
# Environment setup
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TZ="Australia/Perth"

# Install system dependencies
RUN echo "Installing System Utils." && apt-get update && apt-get install -y \
    -o Acquire::Retries=4 --no-install-recommends \
    vim wget ncdu systemctl \
    #Slim build required tools 
    curl wget ca-certificates  \
    # Poetry
    build-essential gcc g++ dpkg-dev \
    # Clean
    && apt-get upgrade -y \ 
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


# Set working dir of project
WORKDIR /usr/src/app


# Prince setup ============================================================================
RUN echo "Downloading and Installing Prince Package based on architecture" \
    && DEB_FILE=prince.deb \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "arm64" ]; then \
    PRINCE_URL="https://www.princexml.com/download/prince_16-1_debian12_arm64.deb"; \
    else \
    PRINCE_URL="https://www.princexml.com/download/prince_16-1_debian12_amd64.deb"; \
    fi \
    && echo "Detected architecture: $ARCH, downloading from $PRINCE_URL" \
    && wget -O ${DEB_FILE} $PRINCE_URL \
    && apt-get update \
    # continue trying to install if deps issue
    && dpkg -i ${DEB_FILE} || true \ 
    && apt-get install -f -y \
    && rm -f ${DEB_FILE} \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Prince installer
# RUN apt-get update && apt-get install -y -o Acquire::Retries=4 --no-install-recommends \
#     gdebi

# Install Prince
# RUN echo "Installing Prince stuff" \
#     && DEB_FILE=prince.deb \
#     && yes | gdebi ${DEB_FILE}  \
#     && echo "Cleaning up" \
#     && rm -f ${DEB_FILE} \
#     && apt-get clean \
#     && rm -rf /var/lib/apt/lists/*


# Set Prince location
ENV PATH="${PATH}:/usr/lib/prince/bin"

# Install dependencies and project ===============================================================
# Copy project files
COPY . .

# Install Poetry
RUN pip install --upgrade pip
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/etc/poetry python3 -
ENV PATH="${PATH}:/etc/poetry/bin"

# Configure Poetry
RUN poetry config virtualenvs.create false
RUN poetry install --no-root

# Set user, port, permissions and run ============================================================
# Create a non-root user
ARG UID=10001
ARG GID=10001
RUN groupadd -g "${GID}" cannabisuser \
    && useradd --create-home --home-dir /home/cannabisuser --no-log-init --uid "${UID}" --gid "${GID}" cannabisuser

# Set permissions
RUN chown -R ${UID}:${GID} /usr/src/app
RUN chown -R ${UID}:${GID} /usr/lib/prince/license
RUN chmod +x /usr/src/app/entrypoint.sh

# Switch to non-root user
USER ${UID}

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]