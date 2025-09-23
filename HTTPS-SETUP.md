# HTTPS Setup for Story Explorer

This guide explains how to enable HTTPS for the Story Explorer application.

## Quick Setup

1. **Generate SSL certificates:**
   ```bash
   ./setup-https.sh
   ```

2. **Start the server:**
   ```bash
   docker-compose up -d
   ```

3. **Access your app:**
   - HTTP: http://localhost:8080 (redirects to HTTPS)
   - HTTPS: https://localhost:8443

## What's Configured

### nginx.conf
- HTTP server on port 80 redirects to HTTPS
- HTTPS server on port 443 with SSL configuration
- Modern TLS protocols (TLSv1.2, TLSv1.3)
- CORS headers maintained

### docker-compose.yml
- nginx:alpine image for web server
- Port 8080 for HTTP (redirects)
- Port 8443 for HTTPS
- SSL certificates mounted from `./ssl` directory

## Self-Signed Certificates

The setup script generates self-signed certificates for development. Browsers will show a security warning - this is normal for self-signed certificates.

**To proceed in your browser:**
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost" or "Accept Risk"

## Production Setup

For production use, replace the self-signed certificates:

1. **Get proper SSL certificates** from a Certificate Authority (Let's Encrypt, etc.)

2. **Replace the certificate files:**
   ```bash
   cp your-domain.crt ssl/server.crt
   cp your-domain.key ssl/server.key
   ```

3. **Update nginx.conf** with your domain name:
   ```nginx
   server_name your-domain.com;
   ```

4. **Restart the container:**
   ```bash
   docker-compose restart
   ```

## Troubleshooting

- **Certificate errors**: Ensure `ssl/server.crt` and `ssl/server.key` exist and have correct permissions
- **Connection refused**: Check that ports 8080 and 8443 are available
- **Docker issues**: Try `docker-compose down && docker-compose up -d`