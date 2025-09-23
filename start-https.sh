#!/bin/bash

echo "Starting Story Explorer with HTTPS..."

# Check if user can access docker
if ! docker info > /dev/null 2>&1; then
    echo "Docker requires sudo permissions. Running with sudo..."
    sudo docker-compose -f /var/www/story-archive/docker-compose.yml up -d
else
    docker-compose -f /var/www/story-archive/docker-compose.yml up -d
fi

echo ""
echo "To check status: docker-compose -f /var/www/story-archive/docker-compose.yml ps"
echo "To view logs: docker-compose -f /var/www/story-archive/docker-compose.yml logs"
echo "To stop: docker-compose -f /var/www/story-archive/docker-compose.yml down"