# ThetaGrid - Quick Deployment Checklist

## 🎯 Prerequisites Completed
- ✅ Git repository created: https://github.com/omkarkalamkar/ThetaGrid.git
- ✅ Code pushed to GitHub
- ✅ .gitignore configured (sensitive files excluded)
- ✅ Deployment guide created: `THETAGRID_DEPLOYMENT.md`
- ✅ README documentation added

## 📋 Deployment Steps Overview

### Step 1: Oracle Instance Access
```bash
ssh -i ~/.ssh/oracle_instance ubuntu@<YOUR_ORACLE_IP>
```

### Step 2: Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 & Nginx
sudo npm install -g pm2
sudo apt install nginx -y
```

### Step 3: Clone & Setup Application
```bash
cd /home/ubuntu
git clone https://github.com/omkarkalamkar/ThetaGrid.git
cd ThetaGrid

# Backend setup
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

# Frontend setup
cd ../frontend
npm install
npm run build
```

### Step 4: Configure Environment
```bash
cd /home/ubuntu/ThetaGrid
cp .env.example .env
nano .env  # Add Angel One credentials
```

### Step 5: Setup PM2
```bash
# Create ecosystem.config.js (see THETAGRID_DEPLOYMENT.md)
nano ecosystem.config.js

# Start services
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the command output
```

### Step 6: Configure Nginx
```bash
# Create Nginx config (see THETAGRID_DEPLOYMENT.md)
sudo nano /etc/nginx/sites-available/thetagrid.peerpays.in

# Enable site
sudo ln -s /etc/nginx/sites-available/thetagrid.peerpays.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: DNS Configuration
Add A record in your DNS provider:
```
Type: A
Name: thetagrid
Value: <YOUR_ORACLE_IP>
TTL: Auto
```

### Step 8: SSL Certificate (Optional)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d thetagrid.peerpays.in
```

### Step 9: Firewall Configuration
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Also configure Oracle Cloud Security List to allow ports: 22, 80, 443**

## ✅ Verification

### Check PM2 Status
```bash
pm2 status
pm2 logs thetagrid-backend --lines 50
pm2 logs thetagrid-frontend --lines 50
```

### Test Backend
```bash
curl http://localhost:8000/api/status
```

### Test Frontend
```bash
curl http://localhost:5173
```

### Test Through Nginx
```bash
curl http://thetagrid.peerpays.in/api/status
```

### Access Dashboard
Open browser: **http://thetagrid.peerpays.in** (or **https** if SSL configured)

## 🔄 Update Deployment

When you make changes and want to update:

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

# Restart services
pm2 restart all
pm2 save
```

## 🚨 Common Issues & Solutions

### Issue: Backend not starting
```bash
pm2 logs thetagrid-backend --err
cd /home/ubuntu/ThetaGrid/backend
source .venv/bin/activate
python main.py  # Check error messages
```

### Issue: Frontend 502 Bad Gateway
```bash
# Check backend is running
curl http://localhost:8000/api/status

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

### Issue: WebSocket not connecting
```bash
# Check Nginx WebSocket config
sudo nginx -t

# Check firewall
sudo ufw status

# Test WebSocket directly
wscat -c ws://localhost:8000/ws
```

### Issue: Port conflicts
```bash
# Check what's using ports
sudo lsof -i :8000
sudo lsof -i :5173

# Kill if needed (PM2 will restart)
pm2 restart all
```

## 📊 Key Features to Verify

After deployment, verify these features work:

- [ ] Live NIFTY/SENSEX spot prices updating
- [ ] INDIA VIX showing real-time values
- [ ] Gift Nifty scraping working
- [ ] Option chain displaying correctly
- [ ] OI buildup analysis showing
- [ ] Straddle premium chart updating
- [ ] WebSocket connection stable
- [ ] Angel One authentication (if configured)
- [ ] Position tracking (if Angel One configured)
- [ ] Responsive UI on mobile devices

## 🎯 Next Steps After Deployment

1. **Configure Angel One Credentials** (if not already done)
   - Open dashboard
   - Click on broker login
   - Enter credentials
   - Verify live data feed

2. **Monitor Logs**
   ```bash
   pm2 logs
   ```

3. **Setup Monitoring** (optional)
   ```bash
   pm2 install pm2-logrotate
   ```

4. **Regular Updates**
   - Pull latest code weekly
   - Update dependencies monthly
   - Monitor system resources

5. **Backup Configuration**
   ```bash
   # Backup .env and PM2 config
   cp /home/ubuntu/ThetaGrid/.env ~/backup-env-$(date +%Y%m%d)
   ```

## 📚 Full Documentation

For detailed step-by-step instructions, see:
- **[THETAGRID_DEPLOYMENT.md](./THETAGRID_DEPLOYMENT.md)** - Complete deployment guide
- **[README.md](./ThetaGrid/README.md)** - Application documentation
- **[RUN_INSTRUCTIONS.md](./ThetaGrid/RUN_INSTRUCTIONS.md)** - Local development guide

## 🔗 Quick Links

- **GitHub Repository**: https://github.com/omkarkalamkar/ThetaGrid.git
- **API Documentation**: http://thetagrid.peerpays.in/docs
- **Angel One Docs**: https://smartapi.angelbroking.com/docs

## 🎉 Success!

If all steps completed successfully, your ThetaGrid dashboard should be live at:

**https://thetagrid.peerpays.in** 🚀

---

**Note:** Replace `<YOUR_ORACLE_IP>` with your actual Oracle instance IP address throughout this guide.

**Remember:** Keep your Angel One credentials secure and never commit `.env` file to Git!
