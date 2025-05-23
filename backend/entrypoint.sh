#!/usr/bin/env bash

# Define the license template with placeholders for environment variables
# LICENSE_TEMPLATE=$(cat <<EOF
# <license id="${PRINCE_LICENSE_ID}">
#     <name>Server License</name>
#     <vendor>YesLogic</vendor>
#     <product>Prince</product>
#     <version>15</version>
#     <end-user>Government of Western Australia</end-user>
#     <date>2024-05-31</date>
#     <signature>${PRINCE_LICENSE_SIGNATURE}</signature>
#     <option id="upgrades">20250531</option>
#     <option id="expires">20250531</option>
# </license>
# EOF
# )

# Output the license template to license.dat
# echo "$LICENSE_TEMPLATE" > /usr/lib/prince/license/license.dat
if [ ! -e /usr/lib/prince/license/license.dat ]; then
  echo "Creating license.dat symlink..."
  ln -s /usr/src/app/backend/files/license.dat /usr/lib/prince/license/license.dat
else
  echo "License file already exists, skipping symlink creation."
fi

# Run Django migrations
echo "Running Django migrations..."
# DISABLED DUE TO READ ONLY FILE SYSTEM
# python manage.py makemigrations

# Update database
python manage.py migrate

# Launch backend (moved from Dockerfile to run after securely setting Prince license)
echo "Launching gunicorn..."
exec gunicorn config.wsgi --bind 0.0.0.0:8000 --timeout 300 --graceful-timeout 90 --max-requests 2048 --workers 4 --preload