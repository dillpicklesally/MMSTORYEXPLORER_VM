#!/bin/bash

echo "Setting up HTTPS for Story Explorer..."

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate self-signed SSL certificate for development
if [ ! -f ssl/server.crt ] || [ ! -f ssl/server.key ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/server.key \
        -out ssl/server.crt \
        -subj "/C=US/ST=State/L=City/O=Story Explorer/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    
    echo "✓ SSL certificate generated"
else
    echo "✓ SSL certificate already exists"
fi

# Set proper permissions
chmod 600 ssl/server.key
chmod 644 ssl/server.crt

echo ""
echo "HTTPS setup complete!"
echo ""
echo "To start the server with HTTPS:"
echo "  docker-compose up -d"
echo ""
echo "Access your app at:"
echo "  HTTP:  http://localhost:8080"
echo "  HTTPS: https://localhost:8443"
echo ""
echo "Note: You'll see a security warning for the self-signed certificate."
echo "Click 'Advanced' and 'Proceed to localhost' to continue."
echo ""
echo "For production, replace ssl/server.crt and ssl/server.key with"
echo "proper SSL certificates from a Certificate Authority."