#!/bin/bash

echo "🚀 Deploying Updates to earn.peerpays.in..."
echo ""

# SSH to server and update
ssh -i "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-12.key" ubuntu@130.210.25.204 << 'DEPLOYEOF'

cd ~/earn.peerpays

echo "📥 Pulling latest code from GitHub..."
git pull origin main

echo ""
echo "📦 Updating backend..."
cd backend
npm install --production
pm2 restart earn-peerpays-api

echo ""
echo "📦 Updating frontend..."
cd ../frontend
npm install
npm run build

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Checking status..."
pm2 status

DEPLOYEOF

echo ""
echo "✅ Website updated at https://earn.peerpays.in"
