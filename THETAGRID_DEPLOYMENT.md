# ThetaGrid Deployment Guide - Oracle Cloud Instance

## Overview
ThetaGrid is an **Options Selling Intelligence Dashboard** with live market data, option chain analysis, and OI buildup tracking.

**Technology Stack:**
- Backend: Python 3.11+ (FastAPI + WebSocket)
- Frontend: React + Vite
- Data Source: Angel One SmartAPI
- Domain: thetagrid.peerpays.in (to be configured)

---

## Prerequisites

### On Local Machine:
- Oracle Cloud SSH key setup (already done from previous deployment)
- Git repository: https://github.com/omkarkalamkar/ThetaGrid.git

### On Oracle Instance:
- Ubuntu 22.04 LTS
- Python 3.11+
- Node.js 18+
- PM2 for process management
- Nginx for reverse proxy

---

## Part 1: Initial Server Setup

### 1.1 SSH into Oracle Instance
```bash
ssh -i ~/.ssh/oracle_instance ubuntu@<YOUR_ORACLE_IP>
```

### 1.2 Update System & Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+ and pip
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 18+ (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
python3.11 --version
node --version
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

---

## Part 2: Clone & Setup Application

### 2.1 Clone Repository
```bash
cd /home/ubuntu
git clone https://github.com/omkarkalamkar/ThetaGrid.git
cd ThetaGrid
```

### 2.2 Backend Setup
```bash
cd /home/ubuntu/ThetaGrid/backend

# Create virtual environment
python3.11 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Deactivate for now
deactivate
```

### 2.3 Frontend Setup
```bash
cd /home/ubuntu/ThetaGrid/frontend

# Install dependencies
npm install

# Build for production
npm run build
```

### 2.4 Environment Configuration
```bash
cd /home/ubuntu/ThetaGrid

# Create .env file from example
cp .env.example .env

# Edit with your Angel One credentials (IMPORTANT!)
nano .env
```

**Edit `.env` file:**
```env
# Angel One SmartAPI Credentials
ANGEL_API_KEY=your_api_key_here
ANGEL_CLIENT_ID=your_client_id_here
ANGEL_PASSWORD=your_password_here
ANGEL_TOTP_SECRET=your_totp_secret_here

# Server Config
BACKEND_PORT=8000
FRONTEND_PORT=5173
```

**Note:** You can also configure credentials later through the web UI.

---

## Part 3: PM2 Process Configuration

### 3.1 Create PM2 Ecosystem File
```bash
cd /home/ubuntu/ThetaGrid
nano ecosystem.config.js
```

**Content:**
```javascript
module.exports = {
  apps: [
    {
      name: 'thetagrid-backend',
      script: '/home/ubuntu/ThetaGrid/backend/.venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: '/home/ubuntu/ThetaGrid/backend',
      interpreter: 'none',
      env: {
        PYTHONPATH: '/home/ubuntu/ThetaGrid/backend'
      },
      error_file: '/home/ubuntu/ThetaGrid/logs/backend-error.log',
      out_file: '/home/ubuntu/ThetaGrid/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'thetagrid-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 5173',
      cwd: '/home/ubuntu/ThetaGrid/frontend',
      error_file: '/home/ubuntu/ThetaGrid/logs/frontend-error.log',
      out_file: '/home/ubuntu/ThetaGrid/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    }
  ]
};
```

### 3.2 Create Logs Directory
```bash
mkdir -p /home/ubuntu/ThetaGrid/logs
```

### 3.3 Start PM2 Processes
```bash
cd /home/ubuntu/ThetaGrid
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Copy and run the command that PM2 outputs

# Check status
pm2 status
pm2 logs thetagrid-backend --lines 50
pm2 logs thetagrid-frontend --lines 50
```

---

## Part 4: Nginx Configuration

### 4.1 Create Nginx Configuration File
```bash
sudo nano /etc/nginx/sites-available/thetagrid.peerpays.in
```

**Content:**
```nginx
server {
    listen 80;
    server_name thetagrid.peerpays.in;

    # Frontend - Serve built files
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://127.0.0.1:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # API Docs (optional, can comment out in production)
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 4.2 Enable Site & Test Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/thetagrid.peerpays.in /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## Part 5: DNS Configuration

### 5.1 Add DNS Record in Cloudflare/Domain Provider

Add an **A record**:
```
Type: A
Name: thetagrid
Value: <YOUR_ORACLE_INSTANCE_PUBLIC_IP>
TTL: Auto
Proxy: DNS only (or proxied if using Cloudflare)
```

Full domain will be: **thetagrid.peerpays.in**

### 5.2 Verify DNS Propagation
```bash
# Check from local machine
ping thetagrid.peerpays.in
nslookup thetagrid.peerpays.in
```

---

## Part 6: SSL Certificate (Optional but Recommended)

### 6.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 6.2 Obtain SSL Certificate
```bash
sudo certbot --nginx -d thetagrid.peerpays.in
```

Follow the prompts:
- Enter email address
- Agree to terms
- Choose redirect option (recommended: redirect HTTP to HTTPS)

### 6.3 Auto-Renewal Setup
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is enabled by default
sudo systemctl status certbot.timer
```

---

## Part 7: Firewall Configuration

### 7.1 Configure UFW (if enabled)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 5173/tcp
sudo ufw enable
sudo ufw status
```

### 7.2 Oracle Cloud Security List
Ensure these ports are open in **Oracle Cloud Console**:
- **22** (SSH)
- **80** (HTTP)
- **443** (HTTPS)
- **8000** (Backend - internal)
- **5173** (Frontend - internal)

---

## Part 8: Testing & Verification

### 8.1 Check PM2 Processes
```bash
pm2 status
pm2 logs thetagrid-backend --lines 100
pm2 logs thetagrid-frontend --lines 100
```

### 8.2 Test Backend Directly
```bash
curl http://localhost:8000/api/status
curl http://localhost:8000/api/market
```

### 8.3 Test Frontend Directly
```bash
curl http://localhost:5173
```

### 8.4 Test Through Nginx
```bash
curl http://thetagrid.peerpays.in/api/status
```

### 8.5 Access from Browser
Open: **http://thetagrid.peerpays.in** (or **https** if SSL configured)

Should see the ThetaGrid dashboard with:
- Live market data (NIFTY, SENSEX, VIX, Gift Nifty)
- Option chain
- OI buildup analysis
- Straddle premium charts

---

## Part 9: Deployment & Update Commands

### 9.1 Update Application (Pull Latest Code)
```bash
cd /home/ubuntu/ThetaGrid
git pull origin main

# Update backend
cd backend
source .venv/bin/activate
pip install -r requirements.txt
deactivate

# Update frontend
cd ../frontend
npm install
npm run build

# Restart PM2 processes
pm2 restart ecosystem.config.js
pm2 save
```

### 9.2 View Logs
```bash
# Real-time logs
pm2 logs thetagrid-backend
pm2 logs thetagrid-frontend

# Last 100 lines
pm2 logs thetagrid-backend --lines 100

# Error logs only
pm2 logs thetagrid-backend --err

# Flush logs
pm2 flush
```

### 9.3 Restart Services
```bash
# Restart all
pm2 restart all

# Restart specific service
pm2 restart thetagrid-backend
pm2 restart thetagrid-frontend

# Reload without downtime
pm2 reload thetagrid-backend
```

### 9.4 Stop Services
```bash
pm2 stop thetagrid-backend
pm2 stop thetagrid-frontend

# Or stop all
pm2 stop all
```

---

## Part 10: Troubleshooting

### Issue: Backend not starting
```bash
# Check logs
pm2 logs thetagrid-backend --err

# Check if port is in use
sudo lsof -i :8000

# Check Python environment
cd /home/ubuntu/ThetaGrid/backend
source .venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Issue: Frontend build fails
```bash
cd /home/ubuntu/ThetaGrid/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Nginx 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:8000/api/status

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### Issue: WebSocket connection fails
```bash
# Check Nginx WebSocket configuration
sudo nginx -t

# Test WebSocket directly
wscat -c ws://localhost:8000/ws

# Check firewall
sudo ufw status
```

### Issue: Angel One authentication fails
```bash
# Check .env file
cat /home/ubuntu/ThetaGrid/.env

# Test backend with logs
cd /home/ubuntu/ThetaGrid/backend
source .venv/bin/activate
python main.py
```

---

## Part 11: Monitoring & Maintenance

### 11.1 PM2 Monitoring
```bash
# Process monitor
pm2 monit

# Memory usage
pm2 describe thetagrid-backend

# Restart on high memory
pm2 restart thetagrid-backend --max-memory-restart 500M
```

### 11.2 Disk Space Management
```bash
# Check disk space
df -h

# Clear old logs (if needed)
pm2 flush

# Rotate logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 11.3 System Resources
```bash
# CPU and memory usage
top
htop

# Process-specific
ps aux | grep python
ps aux | grep node
```

---

## Part 12: Security Best Practices

1. **Never commit .env file** to Git
2. **Use strong passwords** for Angel One credentials
3. **Enable UFW firewall** with minimal open ports
4. **Setup SSL/HTTPS** for production
5. **Regular system updates:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
6. **Monitor PM2 logs** for suspicious activity
7. **Backup important data** regularly:
   ```bash
   # Backup straddle history and persistence data
   cd /home/ubuntu/ThetaGrid/backend
   tar -czf backup-$(date +%Y%m%d).tar.gz *.json
   ```

---

## Quick Reference Commands

```bash
# Start application
cd /home/ubuntu/ThetaGrid
pm2 start ecosystem.config.js

# Update application
git pull origin main
cd backend && source .venv/bin/activate && pip install -r requirements.txt && deactivate
cd ../frontend && npm install && npm run build
pm2 restart all

# View logs
pm2 logs

# Check status
pm2 status

# Restart Nginx
sudo systemctl restart nginx

# Test API
curl http://thetagrid.peerpays.in/api/status
```

---

## Support & Documentation

- **Application Docs:** `/home/ubuntu/ThetaGrid/RUN_INSTRUCTIONS.md`
- **API Documentation:** http://thetagrid.peerpays.in/docs
- **Angel One API Docs:** https://smartapi.angelbroking.com/docs
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/

---

## Notes

- ThetaGrid requires **Angel One SmartAPI** credentials for live market data
- Without credentials, it runs in **demo mode** with mock data
- Application automatically handles market hours (9:15 AM - 3:30 PM IST)
- Straddle history resets daily at 9:15 AM
- WebSocket provides real-time updates every 1 second
- OI baseline is captured at first tick of the day for buildup analysis

---

**Deployment completed successfully! 🚀**

Access your dashboard at: **https://thetagrid.peerpays.in**
