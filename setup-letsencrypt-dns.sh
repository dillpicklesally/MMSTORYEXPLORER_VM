#!/bin/bash

echo "=== Let's Encrypt DNS Challenge Setup ==="
echo "This method doesn't require port 80 to be accessible from the internet."
echo ""

DOMAIN_NAME="mmsecure.quiettools.dev"
EMAIL="admin@quiettools.dev"

echo "Installing DNS challenge plugin..."
sudo apt install -y python3-certbot-dns-route53 python3-certbot-dns-cloudflare

echo ""
echo "Attempting manual DNS challenge..."
echo "This will require you to add a TXT record to your DNS."

sudo certbot certonly \
    --manual \
    --preferred-challenges dns \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --manual-public-ip-logging-ok \
    --domains $DOMAIN_NAME

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificate obtained successfully!"
    
    # Update nginx SSL configuration to use Let's Encrypt certificate
    sudo tee /etc/nginx/sites-available/story-archive-ssl > /dev/null <<EOF
# HTTPS server with Let's Encrypt certificate
server {
    listen 8443 ssl http2;
    server_name $DOMAIN_NAME;
    
    # Let's Encrypt SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Improve SSL handling
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Buffer sizes for VPN connections
    client_max_body_size 100M;
    client_body_buffer_size 128k;
    client_header_buffer_size 4k;
    large_client_header_buffers 4 16k;
    
    # Timeout settings
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 65s;
    
    root /var/www/story-archive;
    index index.html index.php;
    
    # Enable CORS for all origins
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept" always;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
    
    # PHP-FPM configuration
    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
    }
    
    location /archive/ {
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
    
    # Handle archive files with proper MIME types
    location ~* \.(mp4|mov|avi|mkv)\$ {
        add_header Content-Type video/mp4;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(jpg|jpeg|png|gif|webp)\$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Test and reload nginx
    sudo nginx -t && sudo nginx -s reload
    
    echo ""
    echo "✅ Setup complete!"
    echo "Your app is now available at:"
    echo "🔒 HTTPS: https://$DOMAIN_NAME:8443 (trusted certificate, no warnings)"
    echo "🔓 HTTP:  http://192.168.4.21:8080 (fallback)"
    echo ""
    echo "Certificate will auto-renew every 90 days."
    echo "VPN users can now access https://$DOMAIN_NAME:8443 without security warnings!"
    
else
    echo ""
    echo "❌ Certificate installation failed!"
    echo "Check /var/log/letsencrypt/letsencrypt.log for details"
fi