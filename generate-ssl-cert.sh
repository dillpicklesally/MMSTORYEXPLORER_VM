#!/bin/bash

# Create SSL certificate directory
mkdir -p ssl

# Generate self-signed certificate (for development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/server.key \
    -out ssl/server.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificate generated at ssl/server.crt and ssl/server.key"
echo "For production, replace with proper SSL certificates from a CA."