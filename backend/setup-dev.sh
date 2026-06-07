#!/bin/bash
# Development environment setup script for Cannabis Backend

set -e  # Exit on error

echo "Setting up Cannabis Backend development environment..."
echo ""

# Check if Poetry is installed
if ! command -v poetry &> /dev/null; then
    echo "Poetry is not installed. Please install it first:"
    echo "   curl -sSL https://install.python-poetry.org | python3 -"
    exit 1
fi

echo "Poetry found: $(poetry --version)"
echo ""

# Check Python version
python_version=$(python3 --version | cut -d' ' -f2)
echo "Python version: $python_version"
echo ""

# Update lock file if needed
echo "Updating poetry.lock file..."
poetry lock --no-update
echo ""

# Install dependencies
echo "Installing dependencies..."
poetry install
echo ""

# Install pre-commit hooks
echo "Installing pre-commit hooks..."
poetry run pre-commit install
echo ""

# Run pre-commit on all files
echo "Running pre-commit checks on all files..."
poetry run pre-commit run --all-files || {
    echo ""
    echo "Some pre-commit checks failed. This is normal for first-time setup."
    echo "The hooks have been installed and will run automatically on future commits."
    echo ""
}

# Check if .development.env exists
if [ ! -f .development.env ]; then
    echo "No .development.env file found."
    if [ -f .development.env.example ]; then
        echo "Creating .development.env from .development.env.example..."
        cp .development.env.example .development.env
        echo ".development.env created. Please edit it with your settings."
    else
        echo "Please create a .development.env file with your configuration."
    fi
    echo ""
fi

# Run migrations
echo "Running database migrations..."
poetry run python manage.py migrate
echo ""

# Collect static files
echo "Collecting static files..."
poetry run python manage.py collectstatic --noinput
echo ""

# Create superuser if one does not exist
echo "Checking for existing superuser..."
SUPERUSER_EXISTS=$(poetry run python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print(User.objects.filter(is_superuser=True).exists())")

if [ "$SUPERUSER_EXISTS" = "False" ]; then
    echo "No superuser found. Creating one..."
    poetry run python manage.py createsuperuser
else
    echo "Superuser already exists. Skipping creation."
fi
echo ""

echo "Development environment setup complete!"
echo ""
echo "Next steps:"
echo "   1. Ensure .development.env has correct database and other settings"
echo "   2. Run tests: poetry run pytest"
echo "   3. Start development server: poetry run python manage.py runserver"
echo ""
echo "Pre-commit hooks are now active and will run automatically on git commit."
echo "To run manually: poetry run pre-commit run --all-files"
echo ""
