#!/bin/bash

echo "=== Let's Encrypt SSL Certificate Setup ==="
echo ""
echo "PREREQUISITES:"
echo "1. You need a domain name (e.g., story-archive.yourdomain.com)"
echo "2. The domain must point to this server's IP: 192.168.4.21"
echo "3. Port 80 must be accessible from the internet for verification"
echo ""

read -p "Enter your domain name (e.g., story-archive.yourdomain.com): " DOMAIN_NAME
read -p "Enter your email address: " EMAIL

if [[ -z "$DOMAIN_NAME" || -z "$EMAIL" ]]; then
    echo "Domain name and email are required!"
    exit 1
fi

echo ""
echo "Installing Certbot..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

echo ""
echo "Temporarily updating nginx to allow Let's Encrypt verification..."
sudo tee /etc/nginx/sites-available/letsencrypt-temp > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    root /var/www/story-archive;
    
    location /.well-known/acme-challenge/ {
        allow all;
    }
    
    location / {
        return 301 https://\$server_name:8443\$request_uri;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/letsencrypt-temp /etc/nginx/sites-enabled/letsencrypt-temp
sudo nginx -t && sudo nginx -s reload

echo ""
echo "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot certonly --webroot \
    --webroot-path=/var/www/story-archive \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
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
    
    # Clean up temporary config
    sudo rm -f /etc/nginx/sites-enabled/letsencrypt-temp
    
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
    echo "Make sure:"
    echo "1. Your domain points to this server"
    echo "2. Port 80 is accessible from the internet"
    echo "3. No firewall is blocking the connection"
fi