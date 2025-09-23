#!/bin/bash

echo "=== Private Certificate Authority Setup ==="
echo "This creates a private CA for internal use only."
echo "Users will need to install the CA certificate in their browsers."
echo ""

# Create CA directory
mkdir -p /var/www/story-archive/private-ca
cd /var/www/story-archive/private-ca

echo "Creating private Certificate Authority..."

# Generate CA private key
openssl genrsa -out ca-key.pem 4096

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca-key.pem -out ca-cert.pem -subj "/C=US/ST=State/L=City/O=Story Archive CA/CN=Story Archive Root CA"

echo "Creating server certificate signed by private CA..."

# Generate server private key
openssl genrsa -out server-key.pem 2048

# Create certificate signing request
openssl req -new -key server-key.pem -out server-csr.pem -subj "/C=US/ST=State/L=City/O=Story Archive/CN=192.168.4.21"

# Create extensions file for SAN
cat > server-ext.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = 192.168.4.21
EOF

# Generate server certificate signed by CA
openssl x509 -req -days 365 -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -out server-cert.pem -extensions v3_req -extfile server-ext.conf -CAcreateserial

# Copy certificates to SSL directory
cp server-cert.pem /var/www/story-archive/ssl/server.crt
cp server-key.pem /var/www/story-archive/ssl/server.key

# Set proper permissions
chmod 644 /var/www/story-archive/ssl/server.crt
chmod 600 /var/www/story-archive/ssl/server.key

echo ""
echo "✅ Private CA setup complete!"
echo ""
echo "🔒 Server certificate installed"
echo "📋 CA certificate for users: /var/www/story-archive/private-ca/ca-cert.pem"
echo ""
echo "NEXT STEPS:"
echo "1. Send ca-cert.pem to your users"
echo "2. Users must install it in their browser as a trusted root certificate"
echo "3. After installation, https://192.168.4.21:8443 will show as trusted"
echo ""
echo "Installing CA certificate in browsers:"
echo "• Chrome: Settings → Privacy → Security → Manage certificates → Authorities → Import"
echo "• Firefox: Settings → Privacy → Certificates → View Certificates → Authorities → Import"
echo ""

# Reload nginx
sudo nginx -s reload

echo "Server is ready at https://192.168.4.21:8443"