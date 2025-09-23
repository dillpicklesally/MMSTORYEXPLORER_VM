#!/bin/bash

echo "=== VPN Connection Debug Tool ==="
echo "Current time: $(date)"
echo ""

echo "1. Testing HTTPS locally:"
curl -k -s -o /dev/null -w "Local HTTPS Status: %{http_code}, Time: %{time_total}s\n" https://192.168.4.21:8443/ssl-test.html

echo ""
echo "2. Checking nginx processes:"
ps aux | grep nginx | grep -v grep

echo ""
echo "3. Checking port 8443:"
ss -tlnp | grep 8443

echo ""
echo "4. Recent SSL error logs:"
sudo tail -5 /var/log/nginx/story-archive-ssl-error.log 2>/dev/null || echo "No error logs yet"

echo ""
echo "5. Recent SSL access logs:"
sudo tail -5 /var/log/nginx/story-archive-ssl.log 2>/dev/null || echo "No access logs yet"

echo ""
echo "=== When you try via VPN, check these logs again ==="
echo "sudo tail -10 /var/log/nginx/story-archive-ssl-error.log"
echo "sudo tail -10 /var/log/nginx/story-archive-ssl.log"