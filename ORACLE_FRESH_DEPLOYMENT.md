# 🚀 Oracle Cloud - Fresh Deployment (Complete Guide)

## ✅ **Pre-requisites Checklist**

Before starting, ensure you have:
- [ ] Oracle Cloud account (free tier)
- [ ] SSH key pair ready
- [ ] Domain name (optional): `earn.peerpays.in`
- [ ] This GitHub repo: `https://github.com/omkarkalamkar/earn.peerpays.git`

---

## 📋 **Part 1: Oracle Cloud Console Setup (20 minutes)**

### Step 1: Create VCN (Virtual Cloud Network)

1. Login to Oracle Cloud Console
2. Navigate: **Networking → Virtual Cloud Networks**
3. Click **Start VCN Wizard**
4. Select: **Create VCN with Internet Connectivity**
5. Enter details:
   ```
   VCN Name: earn-peerpays-vcn
   Compartment: (root) or your compartment
   VCN CIDR Block: 10.0.0.0/16
   
   Public Subnet CIDR: 10.0.1.0/24
   Private Subnet CIDR: 10.0.2.0/24
   
   Use DNS Hostnames: Yes
   ```
6. Click **Next** → **Create**
7. Wait for creation (2-3 minutes)

### Step 2: Configure Security List (CRITICAL)

1. In the VCN you just created, click **Security Lists**
2. Click **Default Security List for earn-peerpays-vcn**
3. Click **Add Ingress Rules** and add these:

**Rule 1: HTTP**
```
Stateless: No
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: All
Destination Port Range: 80
Description: HTTP web traffic
```

**Rule 2: HTTPS**
```
Stateless: No
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: All
Destination Port Range: 443
Description: HTTPS web traffic
```

**Rule 3: Backend API (Optional - for debugging)**
```
Stateless: No
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: All
Destination Port Range: 5050
Description: Node.js backend
```

4. Click **Add Ingress Rules**

**IMPORTANT:** SSH (port 22) should already be there by default. If not, add it!

### Step 3: Verify Internet Gateway

1. In VCN page, click **Internet Gateways** on left sidebar
2. You should see one gateway (created by wizard)
3. Verify:
   ```
   Name: internet-gateway-earn-peerpays-vcn (or similar)
   State: Enabled ✅
   ```

### Step 4: Verify Route Table

1. In VCN page, click **Route Tables**
2. Click **Default Route Table for earn-peerpays-vcn**
3. Verify this route exists:
   ```
   Destination CIDR: 0.0.0.0/0
   Target Type: Internet Gateway
   Target: [your internet gateway name]
   ```

If missing, click **Add Route Rules** and add it.

---

## 🖥️ **Part 2: Create Compute Instance (10 minutes)**

### Step 1: Launch Instance

1. Navigate: **Compute → Instances**
2. Click **Create Instance**

### Step 2: Configure Instance

**Name:**
```
earn-peerpays-prod
```

**Placement:**
```
Availability Domain: AD-1 (or any available)
Fault Domain: Let Oracle Choose
```

**Image and Shape:**

Click **Change Image**:
```
Image: Canonical Ubuntu
Version: 20.04 (or latest 20.04 LTS)
Image Build: Latest
```

Click **Change Shape**:
```
Shape Series: Ampere or AMD (both work)
Shape Name: VM.Standard.E2.1.Micro (Always Free)
OCPU: 1
Memory: 1 GB
Network Bandwidth: 0.48 Gbps
```

**Networking:**

THIS IS CRITICAL - DOUBLE CHECK:
```
✅ Primary Network:
   - Virtual Cloud Network: earn-peerpays-vcn
   - Subnet: Public Subnet (10.0.1.0/24)
   
✅ Public IP Address:
   - ✅✅✅ ASSIGN A PUBLIC IPV4 ADDRESS ✅✅✅
   (This checkbox MUST be checked!)
   
✅ Advanced Options:
   - Skip source/destination check: LEAVE UNCHECKED (disabled)
```

**Add SSH Keys:**

Upload your public key:
```
Choose: Upload public key files (.pub)
File: ssh-key-2026-11-11 (1).key.pub
```

Or paste public key content if you have it.

**Boot Volume:**
```
Size: 47 GB (default free tier)
```

### Step 3: Create Instance

1. Review all settings
2. Click **Create**
3. Wait 2-3 minutes for **Running** status

### Step 4: Note Important Details

Once instance is **Running**, note these:

```
Public IP Address: __________________ (e.g., 129.154.238.134)
Username: ubuntu
SSH Command: ssh -i "ssh-key.key" ubuntu@[PUBLIC_IP]
```

---

## 🧪 **Part 3: Test Instance Connectivity (5 minutes)**

### Test 1: Ping (from your Mac)

```bash
ping [PUBLIC_IP]
```

**Expected:** Should get responses. If timeout, wait 2-3 minutes and try again.

### Test 2: SSH (from your Mac)

```bash
ssh -i "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-11 (1).key" ubuntu@[PUBLIC_IP]
```

**Expected:** Should connect successfully.

If "Permission denied":
```bash
chmod 400 "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-11 (1).key"
```

Then try SSH again.

### Test 3: Update System

```bash
# Once SSH'd in
sudo apt update
sudo apt upgrade -y
```

This will take 3-5 minutes. Wait for completion.

---

## 📦 **Part 4: Install Dependencies (10 minutes)**

Run these commands **one by one** on the Oracle instance:

### 4.1: Install Node.js 18

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version    # Should show v18.x.x
npm --version     # Should show 9.x.x or higher
```

### 4.2: Install MongoDB

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod    # Should show "active (running)"
mongosh --version               # Should show version
```

### 4.3: Install Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify
sudo systemctl status nginx     # Should show "active (running)"
curl http://localhost           # Should show "Welcome to nginx!"
```

### 4.4: Install PM2

```bash
sudo npm install -g pm2

# Setup PM2 startup
pm2 startup
# Copy the command it shows and run it

# Verify
pm2 --version    # Should show version number
```

### 4.5: Install Git

```bash
sudo apt install -y git

# Verify
git --version    # Should show git version
```

---

## 🚀 **Part 5: Deploy Application (15 minutes)**

### 5.1: Clone Repository

```bash
cd ~
git clone https://github.com/omkarkalamkar/earn.peerpays.git
cd earn.peerpays
ls -la    # Verify files are there
```

### 5.2: Setup Backend

```bash
cd ~/earn.peerpays/backend

# Install dependencies
npm install

# Create production .env file
cat > .env << 'EOF'
MONGO_URI=mongodb://localhost:27017/earn_peerpays
JWT_SECRET=earn-peerpays-production-secret-2026
PORT=5050
NODE_ENV=production
EOF

# Verify .env
cat .env
```

### 5.3: Setup Frontend

```bash
cd ~/earn.peerpays/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Verify build
ls -la dist/    # Should see index.html and assets/
```

### 5.4: Start Backend with PM2

```bash
cd ~/earn.peerpays/backend

# Start with PM2
pm2 start server.js --name earn-peerpays-api

# Save PM2 config
pm2 save

# Check status
pm2 status    # Should show "online"
pm2 logs earn-peerpays-api --lines 20    # Check for errors
```

### 5.5: Configure Nginx

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/earn-peerpays << 'NGXCONF'
upstream backend {
    server localhost:5050;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    client_max_body_size 50M;

    # API routes
    location ~ ^/(api|socket\.io) {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        root /home/ubuntu/earn.peerpays/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
}
NGXCONF

# Enable site
sudo ln -sf /etc/nginx/sites-available/earn-peerpays /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## ✅ **Part 6: Verify Deployment (5 minutes)**

### Test 1: Check Services

```bash
# PM2 status
pm2 status

# MongoDB status
sudo systemctl status mongod

# Nginx status
sudo systemctl status nginx
```

All should show "active (running)" ✅

### Test 2: Test API (from server)

```bash
curl http://localhost:5050/api/health
```

**Expected:** `{"ok":true}` or similar

### Test 3: Test Frontend (from server)

```bash
curl -I http://localhost/
```

**Expected:** `HTTP/1.1 200 OK`

### Test 4: Test Public IP (from your Mac)

```bash
curl http://[PUBLIC_IP]/api/health
```

**Expected:** Should return JSON response

### Test 5: Test in Browser (from your Mac)

Open browser:
```
http://[PUBLIC_IP]
```

**Expected:** Website loads! 🎉

**If NOT loading:** Oracle public IP routing issue → Use Cloudflare Tunnel (see Part 7)

---

## 🌐 **Part 7: Setup Custom Domain (10 minutes)**

### Option A: If Public IP Works

**In your DNS provider:**
```
Type: A
Name: earn
Value: [PUBLIC_IP from Oracle]
TTL: 300
```

Wait 5-15 minutes, then visit: `http://earn.peerpays.in`

### Option B: If Public IP Doesn't Work (Use Cloudflare Tunnel)

```bash
# On Oracle server
cd ~

# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Create quick tunnel (temporary)
pm2 start "cloudflared tunnel --url http://localhost:80" --name cf-tunnel
pm2 save

# Check logs for public URL
pm2 logs cf-tunnel --lines 30
```

Look for line like:
```
https://xyz-something.trycloudflare.com
```

This is your public URL! ✅

**For permanent tunnel with custom domain:**
1. Create Cloudflare account
2. Add domain: `peerpays.in`
3. Follow Cloudflare's nameserver instructions
4. Run: `cloudflared tunnel login` (on your Mac)
5. Run: `cloudflared tunnel create earn-peerpays-prod`
6. Run: `cloudflared tunnel route dns earn-peerpays-prod earn.peerpays.in`

---

## 🔒 **Part 8: Setup HTTPS/SSL (5 minutes)**

### If using direct public IP:

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d earn.peerpays.in

# Follow prompts - it will auto-configure Nginx
```

### If using Cloudflare Tunnel:

**HTTPS is automatic!** ✅ No setup needed.

---

## 📊 **Final Verification Checklist**

- [ ] Oracle instance running
- [ ] SSH working
- [ ] Node.js installed (v18.x)
- [ ] MongoDB running
- [ ] Nginx running
- [ ] PM2 process online
- [ ] Backend API responding
- [ ] Frontend loading in browser
- [ ] Public access working (direct IP or tunnel)
- [ ] Custom domain pointing correctly
- [ ] HTTPS working (if configured)

---

## 🚨 **Common Issues & Solutions**

### Issue: Can't SSH to instance
**Solution:** Check security list has port 22 open for 0.0.0.0/0

### Issue: Public IP not accessible
**Solution:** Use Cloudflare Tunnel (Oracle free tier limitation)

### Issue: MongoDB fails to start
**Solution:**
```bash
sudo rm /tmp/mongodb-27017.sock
sudo systemctl restart mongod
```

### Issue: Backend crashes
**Solution:**
```bash
pm2 logs earn-peerpays-api
# Check error, fix, then restart:
pm2 restart earn-peerpays-api
```

### Issue: Frontend shows blank page
**Solution:**
```bash
cd ~/earn.peerpays/frontend
npm run build
sudo systemctl reload nginx
```

---

## 🎯 **Quick Commands Reference**

### Check all services:
```bash
pm2 status && sudo systemctl status mongod && sudo systemctl status nginx
```

### View logs:
```bash
pm2 logs earn-peerpays-api
sudo tail -f /var/log/nginx/error.log
```

### Restart everything:
```bash
pm2 restart all
sudo systemctl restart mongod
sudo systemctl restart nginx
```

### Update code:
```bash
cd ~/earn.peerpays
git pull
cd backend && npm install
cd ../frontend && npm install && npm run build
pm2 restart earn-peerpays-api
```

---

## 📞 **Estimated Total Time**

- **Part 1 (Oracle Console):** 20 min
- **Part 2 (Instance):** 10 min
- **Part 3 (Test):** 5 min
- **Part 4 (Dependencies):** 10 min
- **Part 5 (Deploy):** 15 min
- **Part 6 (Verify):** 5 min
- **Part 7 (Domain):** 10 min
- **Part 8 (SSL):** 5 min

**Total:** ~80 minutes (1 hour 20 min)

---

## ✅ **Success Criteria**

Website is ready when:
- You can access `https://earn.peerpays.in` from any device
- Login page loads
- You can login with test credentials
- Dashboard shows data
- All features work

---

**Ek baar ye steps follow kar, perfect deployment hoga!** 🚀
