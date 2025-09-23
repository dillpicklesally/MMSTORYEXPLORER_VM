#!/bin/bash

echo "Completing certificate request..."
echo "Make sure TXT record is updated with: 5ILLiWjUlLnUFnS0q1rUay52Ks-3llqzO2iZeXhMrhE"
echo "Press any key when TXT record is updated..."
read -n 1

# Check TXT record
echo "Checking TXT record..."
dig @8.8.8.8 _acme-challenge.mmsecure.quiettools.dev TXT

echo ""
echo "Continuing certificate process..."
echo "" | sudo certbot certonly --manual --preferred-challenges dns --email admin@quiettools.dev --agree-tos --no-eff-email --domains mmsecure.quiettools.dev --force-renewal