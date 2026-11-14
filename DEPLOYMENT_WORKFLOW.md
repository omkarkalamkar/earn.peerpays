# 🔄 Deployment Workflow - earn.peerpays.in

## ✅ **Current Setup:**

```
Local Code → GitHub → Oracle Server → Live Website
     ↓          ↓           ↓              ↓
  /Aniket   omkarkalamkar  earn.peerpays  https://
  _Booking  /earn.peerpays   (Oracle)    earn.peerpays.in
```

**All connected via Git!** ✅

---

## 🚀 **Complete Update Process:**

### **Method 1: Using Automated Script** ⭐ **Recommended**

```bash
cd /Users/omkar/Documents/Aniket_Booking

# Make your code changes...
# Then:

# 1. Push to GitHub
git add .
git commit -m "Your update description"
git push origin main

# 2. Deploy to server (one command!)
./deploy_updates.sh
```

**Done!** Changes live in 2-3 minutes! ✅

---

### **Method 2: Manual Deployment**

#### **Step 1: Push to GitHub**

```bash
cd /Users/omkar/Documents/Aniket_Booking

# Check what changed
git status

# Add files
git add .

# Commit with message
git commit -m "Added new feature: XYZ"

# Push to GitHub
git push origin main
```

#### **Step 2: Deploy to Server**

```bash
# SSH to server
ssh -i "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-12.key" ubuntu@130.210.25.204

# Navigate to project
cd ~/earn.peerpays

# Pull latest code
git pull origin main

# Update backend
cd backend
npm install
pm2 restart earn-peerpays-api

# Update frontend
cd ../frontend
npm install
npm run build

# Exit
exit
```

#### **Step 3: Verify**

Visit: `https://earn.peerpays.in` and check changes

---

## 📋 **Different Types of Updates:**

### **Backend Only Changes:**

```bash
# After pushing to GitHub
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays/backend
git pull origin main
npm install
pm2 restart earn-peerpays-api
```

### **Frontend Only Changes:**

```bash
# After pushing to GitHub
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays/frontend
git pull origin main
npm install
npm run build
# Nginx automatically serves new build
```

### **Database Schema Changes:**

```bash
# After code push
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays/backend

# Run migration script if you have one
node migrations/update.js

# Or manually update MongoDB
mongosh
use earn_peerpays
// Run update commands
```

### **Environment Variable Changes:**

```bash
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays/backend

# Edit .env
nano .env

# Restart backend
pm2 restart earn-peerpays-api
```

---

## 🔍 **Verification Steps:**

After deployment, check:

```bash
# 1. Check PM2 status
pm2 status

# 2. Check logs for errors
pm2 logs earn-peerpays-api --lines 50

# 3. Test API
curl https://earn.peerpays.in/api/health

# 4. Check frontend in browser
# Visit: https://earn.peerpays.in
```

---

## 🚨 **Rollback (If Something Breaks):**

```bash
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays

# Check git history
git log --oneline

# Rollback to previous commit
git reset --hard <commit-hash>

# Rebuild
cd frontend
npm run build

# Restart backend
cd ../backend
pm2 restart earn-peerpays-api
```

---

## 📊 **Git Workflow Best Practices:**

### **Branch Strategy:**

```bash
# For major features, use branches
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# On GitHub, create Pull Request
# After review, merge to main
# Then deploy
```

### **Commit Messages:**

Good examples:
```
✅ "Add OTP verification to login"
✅ "Fix booking date validation bug"
✅ "Update UI colors for mobile view"
✅ "Optimize database queries in ledger"
```

Bad examples:
```
❌ "changes"
❌ "update"
❌ "fix"
```

---

## ⚡ **Quick Commands Reference:**

### **Check what's different:**
```bash
cd /Users/omkar/Documents/Aniket_Booking
git status
git diff
```

### **Push changes:**
```bash
git add .
git commit -m "Description"
git push origin main
```

### **Deploy:**
```bash
./deploy_updates.sh
```

### **Check live status:**
```bash
ssh -i "key" ubuntu@130.210.25.204 "pm2 status && cd ~/earn.peerpays && git log --oneline | head -3"
```

---

## 🔐 **Security Notes:**

1. **Never commit sensitive data:**
   - `.env` files (already in .gitignore ✅)
   - SSH keys (already in .gitignore ✅)
   - Database credentials
   - API keys

2. **Check before pushing:**
   ```bash
   git diff --cached
   ```

3. **Server .env is separate:**
   - Local: `/Users/omkar/Documents/Aniket_Booking/backend/.env`
   - Server: `/home/ubuntu/earn.peerpays/backend/.env`
   - They can have different values (dev vs prod)

---

## 📈 **Monitoring Updates:**

### **Check deployment history:**

```bash
ssh -i "key" ubuntu@130.210.25.204
cd ~/earn.peerpays

# Last 10 deployments
git log --oneline | head -10

# When was last update
git log -1 --format="%ai %s"
```

### **Check uptime:**

```bash
ssh -i "key" ubuntu@130.210.25.204

# Backend uptime
pm2 info earn-peerpays-api

# Server uptime
uptime
```

---

## 🆘 **Common Issues:**

### **"Changes not showing on website"**

**Causes & Fixes:**

1. **Browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Clear browser cache

2. **Frontend not rebuilt:**
   ```bash
   ssh -i "key" ubuntu@130.210.25.204
   cd ~/earn.peerpays/frontend
   npm run build
   ```

3. **Backend not restarted:**
   ```bash
   pm2 restart earn-peerpays-api
   ```

### **"git pull fails with conflicts"**

```bash
# On server
cd ~/earn.peerpays

# Stash local changes (if any)
git stash

# Pull latest
git pull origin main

# Apply stashed changes (if needed)
git stash pop
```

### **"npm install fails"**

```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm cache clean --force
npm install
```

---

## 🎯 **Complete Example Workflow:**

```bash
# 1. Make changes locally
cd /Users/omkar/Documents/Aniket_Booking/frontend/src
# Edit App.jsx...

# 2. Test locally (if needed)
cd ../..
npm run dev
# Test at http://localhost:5173

# 3. Commit and push
git add frontend/src/App.jsx
git commit -m "Update navigation menu"
git push origin main

# 4. Deploy to production
./deploy_updates.sh

# 5. Verify
# Visit https://earn.peerpays.in
# Check changes are live

# 6. Monitor
ssh -i "key" ubuntu@130.210.25.204
pm2 logs earn-peerpays-api --lines 20
```

---

## 📞 **One-Line Deploy Command:**

After pushing to GitHub:

```bash
cd /Users/omkar/Documents/Aniket_Booking && ./deploy_updates.sh
```

**That's it!** 🚀

---

## ✅ **Checklist for Every Update:**

- [ ] Code changes done locally
- [ ] Tested locally (if major change)
- [ ] Committed with clear message
- [ ] Pushed to GitHub
- [ ] Deployed using script or manually
- [ ] Verified on live website
- [ ] Checked logs for errors
- [ ] Informed team (if applicable)

---

**Your workflow is now production-ready!** Any changes you make will go through GitHub and deploy cleanly to your Oracle server. 🎉
