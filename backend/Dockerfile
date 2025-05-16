# syntax=docker/dockerfile:1
FROM python:latest
LABEL org.opencontainers.image.source=https://github.com/dbca-wa/cannabis

# Environment setup
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TZ="Australia/Perth"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    -o Acquire::Retries=4 --no-install-recommends \
    vim wget ncdu systemctl gdebi \
    libavif-dev libgif7 \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Poetry
RUN pip install --upgrade pip
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/etc/poetry python3 -
ENV PATH="${PATH}:/etc/poetry/bin"

# Prince setup
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
    && yes | gdebi ${DEB_FILE} \
    && rm -f ${DEB_FILE}

# Set Prince location
ENV PATH="${PATH}:/usr/lib/prince/bin"

# License setup for Prince
RUN rm -f /usr/lib/prince/license/license.dat
RUN if [ -f ./files/license.dat ]; then \
    echo "Using provided license file"; \
    cp ./files/license.dat /tmp/license.dat; \
    else \
    echo "Creating license file from environment variables"; \
    echo "<license id=\"${PRINCE_LICENSE_ID:-missing_id}\">" > /tmp/license.dat && \
    echo "    <name>Server License</name>" >> /tmp/license.dat && \
    echo "    <vendor>YesLogic</vendor>" >> /tmp/license.dat && \
    echo "    <product>Prince</product>" >> /tmp/license.dat && \
    echo "    <version>15</version>" >> /tmp/license.dat && \
    echo "    <end-user>Government of Western Australia</end-user>" >> /tmp/license.dat && \
    echo "    <date>2024-05-31</date>" >> /tmp/license.dat && \
    echo "    <signature>${PRINCE_LICENSE_SIGNATURE:-missing_signature}</signature>" >> /tmp/license.dat && \
    echo "    <option id=\"upgrades\">20250531</option>" >> /tmp/license.dat && \
    echo "    <option id=\"expires\">20250531</option>" >> /tmp/license.dat && \
    echo "</license>" >> /tmp/license.dat; \
    fi && \
    mkdir -p /usr/lib/prince/license/ && \
    mv /tmp/license.dat /usr/lib/prince/license/license.dat
RUN mkdir -p /usr/lib/prince/license/ && mv /tmp/license.dat /usr/lib/prince/license/license.dat

# Copy project files
COPY . .

# Configure Poetry
RUN poetry config virtualenvs.create false
RUN poetry install --no-root

# Create a non-root user
ARG UID=10001
ARG GID=10001
RUN groupadd -g "${GID}" appuser \
    && useradd --create-home --home-dir /home/appuser --no-log-init --uid "${UID}" --gid "${GID}" appuser

# Set permissions
RUN chown -R ${UID}:${GID} /app
RUN chown -R ${UID}:${GID} /usr/lib/prince/license
RUN chmod +x /app/entrypoint.sh

# Switch to non-root user
USER ${UID}

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]