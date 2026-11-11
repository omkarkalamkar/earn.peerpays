#!/bin/bash

# PeerPays - Oracle Cloud Setup Script
# Run this script on your Oracle Cloud Ubuntu instance
# Usage: bash setup-oracle.sh

set -e  # Exit on error

echo "🚀 PeerPays - Oracle Cloud Setup Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root. Run as ubuntu user.${NC}"
   exit 1
fi

echo -e "${GREEN}✓ Running as non-root user${NC}"

# Update system
echo ""
echo "📦 Step 1: Updating system packages..."
sudo apt update
sudo apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

# Install Node.js 20.x
echo ""
echo "📦 Step 2: Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
else
    echo -e "${YELLOW}⚠ Node.js already installed: $(node --version)${NC}"
fi

# Install MongoDB
echo ""
echo "📦 Step 3: Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
       sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    sudo apt update
    sudo apt install -y mongodb-org
    
    sudo systemctl start mongod
    sudo systemctl enable mongod
    echo -e "${GREEN}✓ MongoDB installed and started${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB already installed${NC}"
    sudo systemctl start mongod || true
fi

# Install Nginx
echo ""
echo "📦 Step 4: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed and started${NC}"
else
    echo -e "${YELLOW}⚠ Nginx already installed${NC}"
fi

# Install PM2
echo ""
echo "📦 Step 5: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
else
    echo -e "${YELLOW}⚠ PM2 already installed${NC}"
fi

# Install Git
echo ""
echo "📦 Step 6: Installing Git..."
if ! command -v git &> /dev/null; then
    sudo apt install -y git
    echo -e "${GREEN}✓ Git installed${NC}"
else
    echo -e "${YELLOW}⚠ Git already installed${NC}"
fi

# Configure Firewall
echo ""
echo "🔥 Step 7: Configuring UFW firewall..."
sudo ufw --force enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5050  # Backend API
echo -e "${GREEN}✓ Firewall configured${NC}"
sudo ufw status

# Install additional utilities
echo ""
echo "📦 Step 8: Installing utilities..."
sudo apt install -y htop curl wget unzip
echo -e "${GREEN}✓ Utilities installed${NC}"

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ Server setup completed successfully!${NC}"
echo "================================================"
echo ""
echo "📋 Installed Software:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - MongoDB: $(mongod --version | head -n1)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo "  - PM2: $(pm2 --version)"
echo "  - Git: $(git --version)"
echo ""
echo "🔥 Firewall Status:"
sudo ufw status | grep -E "(22|80|443|5050)"
echo ""
echo "📍 Next Steps:"
echo "  1. Clone your repository: git clone <your-repo-url>"
echo "  2. Setup backend: cd backend && npm install"
echo "  3. Create .env file in backend/"
echo "  4. Setup frontend: cd frontend && npm install && npm run build"
echo "  5. Start backend: pm2 start server.js --name peerpays-api"
echo "  6. Configure Nginx (see ORACLE_CLOUD_DEPLOYMENT.md)"
echo ""
echo "📖 Full guide: ORACLE_CLOUD_DEPLOYMENT.md"
echo ""
