# 🌐 Host Multiple Websites on Same Oracle Instance

## ✅ **Current Usage:**

**Instance:** `earn-peerpays-prod`
- RAM: 1GB (40% used - 600MB available)
- Storage: 47GB (8.7% used - 43GB available)
- CPU: 1 OCPU (minimal load)

**Can easily host 2-3 more websites on same instance!** ✅

---

## 🚀 **Method 1: Multiple Domains on Same Instance (Recommended)**

### **Architecture:**

```
Same Server (130.210.25.204)
├── earn.peerpays.in (Current - Port 5050)
├── app2.yourdomain.com (New - Port 5051)
└── app3.yourdomain.com (New - Port 5052)
```

### **Steps to Add Second Website:**

#### **1. Clone New Project:**

```bash
ssh -i "key" ubuntu@130.210.25.204

cd ~
git clone https://github.com/username/your-new-project.git
cd your-new-project
```

#### **2. Setup Backend (Different Port):**

```bash
cd backend
npm install

# Create .env with DIFFERENT port
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/new_project_db
JWT_SECRET=new-project-secret-2026
PORT=5051
NODE_ENV=production
EOF

# Start with PM2
pm2 start server.js --name new-project-api
pm2 save
```

#### **3. Build Frontend:**

```bash
cd ../frontend
npm install
npm run build
```

#### **4. Add Nginx Config:**

```bash
sudo nano /etc/nginx/sites-available/new-project
```

```nginx
upstream new_backend {
    server localhost:5051;
}

server {
    listen 80;
    server_name app2.yourdomain.com;
    
    location ~ ^/(api|socket\.io) {
        proxy_pass http://new_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /home/ubuntu/your-new-project/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/new-project /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### **5. Setup DNS:**

Add A record in your DNS:
```
Type: A
Name: app2
Value: 130.210.25.204
```

#### **6. Setup SSL:**

```bash
sudo certbot --nginx -d app2.yourdomain.com --agree-tos --email admin@yourdomain.com
```

**Done!** Second website live at `https://app2.yourdomain.com` ✅

---

## 🚀 **Method 2: Second Oracle Instance (If Need More Resources)**

### **Create Another Free Tier VM:**

Oracle allows **2 free VMs**, so you can create one more.

#### **Steps:**

1. **Oracle Console → Compute → Instances → Create Instance**
2. **Use same settings as before:**
   - Name: `website2-prod`
   - Shape: VM.Standard.E2.1.Micro (Always Free)
   - Image: Ubuntu 20.04
   - VCN: Use existing `earn-peerpays-vcn`
   - Subnet: Use existing public subnet
   - Public IP: Assign new IP

3. **Deploy second website on new instance**
4. **Point domain to new IP**

---

## 📊 **Resource Allocation Guide:**

### **Single Instance (1GB RAM):**

Can host:
- ✅ 2-3 Node.js apps (if lightweight)
- ✅ 1 MongoDB database (shared)
- ✅ 1 Nginx (handles all domains)

**Example allocation:**
```
earn.peerpays.in:
- Backend: 300MB RAM
- MongoDB: 200MB RAM

app2.yourdomain.com:
- Backend: 300MB RAM

System + Nginx: 200MB RAM
```

### **Two Instances (2GB total):**

Can host:
- ✅ 4-6 websites comfortably
- ✅ Separate databases per instance
- ✅ Better isolation

---

## 🗂️ **Directory Structure (Multiple Sites):**

```
/home/ubuntu/
├── earn.peerpays/          (Current - Port 5050)
│   ├── backend/
│   └── frontend/
│
├── project2/               (Port 5051)
│   ├── backend/
│   └── frontend/
│
└── project3/               (Port 5052)
    ├── backend/
    └── frontend/
```

---

## 🔧 **MongoDB - Multiple Databases:**

Same MongoDB instance can host multiple databases:

```bash
mongosh
show dbs

# Databases:
# - earn_peerpays     (current)
# - project2_db       (new)
# - project3_db       (new)
```

Each app connects to its own database via `MONGO_URI`.

---

## ⚙️ **PM2 Process Management:**

```bash
pm2 list

# Output:
# ┌─────┬────────────────────┬─────────┬────────┐
# │ id  │ name               │ status  │ memory │
# ├─────┼────────────────────┼─────────┼────────┤
# │ 0   │ earn-peerpays-api  │ online  │ 80 MB  │
# │ 1   │ project2-api       │ online  │ 75 MB  │
# │ 2   │ project3-api       │ online  │ 70 MB  │
# └─────┴────────────────────┴─────────┴────────┘
```

---

## 🔒 **SSL for Multiple Domains:**

```bash
# Add SSL for each domain
sudo certbot --nginx -d app2.yourdomain.com
sudo certbot --nginx -d app3.yourdomain.com

# Auto-renewal works for all
sudo certbot renew --dry-run
```

---

## 📈 **Performance Tips:**

1. **Use PM2 Cluster Mode** for better CPU usage:
   ```bash
   pm2 start server.js -i 1 --name app-api
   ```

2. **Enable Nginx Caching:**
   ```nginx
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
   ```

3. **Monitor Resources:**
   ```bash
   pm2 monit
   htop
   ```

4. **Optimize MongoDB:**
   ```bash
   mongosh
   db.collection.createIndex({ field: 1 })
   ```

---

## 🚨 **When to Use Second Instance:**

Use second instance if:
- ❌ RAM usage consistently > 80%
- ❌ CPU usage consistently > 80%
- ❌ Apps are resource-heavy (video processing, ML, etc.)
- ✅ Need complete isolation between projects

Otherwise, **same instance works great!** 💪

---

## 💰 **Cost Summary:**

| Resource | Limit | Cost |
|----------|-------|------|
| VM.Standard.E2.1.Micro (x2) | Forever | **FREE** ✅ |
| 200GB Block Storage | Forever | **FREE** ✅ |
| 10TB Outbound Transfer/month | Forever | **FREE** ✅ |
| Public IPs (x2) | Forever | **FREE** ✅ |

**Total cost: $0/month forever!** 🎉

---

## 📞 **Quick Commands:**

### **Check current resource usage:**

```bash
# Memory
free -h

# CPU
top

# Disk
df -h

# All PM2 apps
pm2 status

# All Nginx sites
ls -la /etc/nginx/sites-enabled/
```

---

## ✅ **Summary:**

**Your Options:**

1. **Same Instance (Recommended for now):**
   - ✅ Add 2-3 more websites easily
   - ✅ Different ports (5050, 5051, 5052)
   - ✅ Separate domains via Nginx
   - ✅ Shared MongoDB (different databases)

2. **Second Instance (If needed later):**
   - ✅ Another 1GB RAM VM (free)
   - ✅ Complete isolation
   - ✅ New public IP

**Current capacity:**
- RAM: 600MB available
- Storage: 43GB available
- Can handle **2-3 more Node.js apps** easily! 🚀

---

**Want me to help deploy your second website on same instance?** Let me know! 👍
