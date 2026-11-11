#!/bin/bash

# PeerPays - Application Deployment Script
# Run this after setup-oracle.sh completes
# Usage: bash deploy-app.sh <your-public-ip-or-domain>

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🚀 PeerPays - Application Deployment Script"
echo "==========================================="
echo ""

# Check if IP/domain provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Please provide your public IP or domain${NC}"
    echo "Usage: bash deploy-app.sh YOUR_PUBLIC_IP"
    echo "Example: bash deploy-app.sh 123.456.789.012"
    exit 1
fi

SERVER_NAME=$1
APP_DIR="$HOME/Aniket_Booking"

echo -e "${BLUE}Server: $SERVER_NAME${NC}"
echo -e "${BLUE}App Directory: $APP_DIR${NC}"
echo ""

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Error: Application directory not found: $APP_DIR${NC}"
    echo "Please clone your repository first:"
    echo "  git clone <your-repo-url> $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Setup Backend
echo ""
echo "📦 Step 1: Setting up Backend..."
cd backend

# Install dependencies
echo "  → Installing backend dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "  → Creating .env file..."
    cat > .env << EOF
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/peerpays

# JWT Secret (CHANGE THIS!)
JWT_SECRET=$(openssl rand -base64 32)

# Server Port
PORT=5050

# Environment
NODE_ENV=production

# Web Push (configure later if needed)
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
EOF
    echo -e "${GREEN}  ✓ .env file created${NC}"
    echo -e "${YELLOW}  ⚠ Please update JWT_SECRET in .env for production!${NC}"
else
    echo -e "${YELLOW}  ⚠ .env file already exists, skipping...${NC}"
fi

# Create admin user
echo "  → Creating admin user..."
if node reset-admin.js; then
    echo -e "${GREEN}  ✓ Admin user created (admin/admin123)${NC}"
else
    echo -e "${YELLOW}  ⚠ Could not create admin user (may already exist)${NC}"
fi

# Start with PM2
echo "  → Starting backend with PM2..."
pm2 delete peerpays-api 2>/dev/null || true
pm2 start server.js --name peerpays-api
pm2 save
echo -e "${GREEN}  ✓ Backend started${NC}"

# Setup PM2 startup
if ! pm2 list | grep -q peerpays-api; then
    echo -e "${RED}  ✗ PM2 process not running${NC}"
else
    echo "  → Configuring PM2 startup..."
    pm2 startup | grep "sudo" | bash || true
    echo -e "${GREEN}  ✓ PM2 startup configured${NC}"
fi

# Setup Frontend
echo ""
echo "📦 Step 2: Setting up Frontend..."
cd "$APP_DIR/frontend"

# Install dependencies
echo "  → Installing frontend dependencies..."
npm install

# Create production env
echo "  → Creating production environment..."
cat > .env.production << EOF
VITE_API_URL=/api
EOF
echo -e "${GREEN}  ✓ Production environment created${NC}"

# Build
echo "  → Building frontend for production..."
npm run build
echo -e "${GREEN}  ✓ Frontend built successfully${NC}"

# Configure Nginx
echo ""
echo "📦 Step 3: Configuring Nginx..."

NGINX_CONFIG="/tmp/peerpays-nginx.conf"
cat > $NGINX_CONFIG << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Frontend (React app)
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:5050/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:5050/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
}
EOF

# Install Nginx config
sudo cp $NGINX_CONFIG /etc/nginx/sites-available/peerpays
sudo ln -sf /etc/nginx/sites-available/peerpays /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
echo "  → Testing Nginx configuration..."
if sudo nginx -t; then
    echo "  → Reloading Nginx..."
    sudo systemctl reload nginx
    echo -e "${GREEN}  ✓ Nginx configured and reloaded${NC}"
else
    echo -e "${RED}  ✗ Nginx configuration test failed${NC}"
    exit 1
fi

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo "================================================"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""
echo "🌐 Application URLs:"
echo "  Frontend: http://$SERVER_NAME"
echo "  Backend API: http://$SERVER_NAME/api"
echo ""
echo "🔐 Default Login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "📝 Next Steps:"
echo "  1. Open http://$SERVER_NAME in your browser"
echo "  2. Login with admin/admin123"
echo "  3. Change admin password immediately!"
echo "  4. Configure domain and SSL (optional):"
echo "     sudo certbot --nginx -d yourdomain.com"
echo ""
echo "📋 Useful Commands:"
echo "  View backend logs: pm2 logs peerpays-api"
echo "  Restart backend: pm2 restart peerpays-api"
echo "  View nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "  Check services: pm2 status && sudo systemctl status nginx"
echo ""
echo "🎉 Your app is now live!"
echo ""
