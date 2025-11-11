#!/bin/bash

# Setup script for development Docker environment

set -e

echo "Setting up Cannabis Development Environment"
echo ""

# Start containers
echo "🔄 Starting Docker containers..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for database to be ready
echo "🔄 Waiting for database to be ready..."
sleep 5

# Run migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.dev.yml exec -T cannabis-backend-dev python manage.py migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Create a superuser:"
echo "     docker-compose -f docker-compose.dev.yml exec cannabis-backend-dev python manage.py createsuperuser"
echo ""
echo "  2. Access the application:"
echo "     Frontend: http://localhost:3000"
echo "     Backend:  http://localhost:8000"
echo "     Admin:    http://localhost:8000/admin"
echo ""
echo "  3. View logs:"
echo "     docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "  4. Stop containers:"
echo "     docker-compose -f docker-compose.dev.yml down"
