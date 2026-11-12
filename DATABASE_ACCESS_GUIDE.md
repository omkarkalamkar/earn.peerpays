# 🗄️ MongoDB Database Access Guide

## 📍 **Database Location:**

```
Server: Oracle Cloud Instance (130.210.25.204)
Path: /var/lib/mongodb/
Database Name: earn_peerpays
Port: 27017 (localhost only)
```

---

## 🔐 **Access Methods:**

### **Method 1: SSH + MongoDB Shell (Direct Access)**

```bash
# SSH to server
ssh -i "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-12.key" ubuntu@130.210.25.204

# Connect to MongoDB
mongosh

# Switch to database
use earn_peerpays

# Show all collections
show collections

# Query users
db.users.find().pretty()

# Query bookings
db.bookings.find().pretty()

# Count documents
db.users.countDocuments()
```

---

### **Method 2: MongoDB Compass (GUI Tool)**

**Setup SSH Tunnel first:**

```bash
# On your Mac, run:
ssh -i "/Users/omkar/Documents/Aniket_Booking/ssh-key-2026-11-12.key" -L 27017:localhost:27017 ubuntu@130.210.25.204 -N
```

**Then in MongoDB Compass:**
```
Connection String: mongodb://localhost:27017/earn_peerpays
```

Keep tunnel running while using Compass.

---

### **Method 3: From Node.js Backend**

Already configured in `.env`:
```
MONGO_URI=mongodb://localhost:27017/earn_peerpays
```

---

## 📊 **Database Structure:**

### **Collections:**

1. **users** - User accounts (admin, cardholder, booker)
2. **bookings** - All booking/order records
3. **cards** - Card information
4. **deals** - Available deals
5. **ledgers** - Financial ledger entries
6. **notifications** - User notifications
7. **orderstats** - Order statistics
8. **payments** - Payment records
9. **pushsubscriptions** - Push notification subscriptions

---

## 🔧 **Common Operations:**

### **Backup Database:**

```bash
# SSH to server
ssh -i "key" ubuntu@130.210.25.204

# Create backup
mongodump --db earn_peerpays --out /home/ubuntu/backup/

# Download backup to local
exit
scp -i "key" -r ubuntu@130.210.25.204:/home/ubuntu/backup/ ./local-backup/
```

### **Restore Database:**

```bash
# Upload backup to server
scp -i "key" -r ./local-backup/ ubuntu@130.210.25.204:/home/ubuntu/restore/

# SSH and restore
ssh -i "key" ubuntu@130.210.25.204
mongorestore --db earn_peerpays /home/ubuntu/restore/earn_peerpays/
```

### **View Real-time Logs:**

```bash
# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Backend API logs
pm2 logs earn-peerpays-api
```

### **Database Size:**

```bash
mongosh
use earn_peerpays
db.stats()
```

---

## 🛡️ **Security:**

**Current Setup:**
- ✅ MongoDB only listens on localhost (127.0.0.1)
- ✅ Not exposed to internet
- ✅ Access only via SSH tunnel or from backend

**To secure further:**

```bash
# Create MongoDB admin user
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "secure_password_here",
  roles: ["root"]
})

# Enable authentication in MongoDB config
sudo nano /etc/mongod.conf
# Add: security.authorization: enabled
sudo systemctl restart mongod
```

---

## 📈 **Monitoring:**

### **Check Database Status:**

```bash
ssh -i "key" ubuntu@130.210.25.204

# MongoDB service status
sudo systemctl status mongod

# Database size
du -sh /var/lib/mongodb/

# Connection count
mongosh --eval "db.serverStatus().connections"
```

---

## 🔄 **Maintenance:**

### **Auto-backup Script:**

Create daily backup cron job:

```bash
# Create backup script
cat > /home/ubuntu/backup-db.sh << 'BACKUP'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db earn_peerpays --out /home/ubuntu/backups/$DATE/
# Keep only last 7 days
find /home/ubuntu/backups/ -type d -mtime +7 -exec rm -rf {} \;
BACKUP

chmod +x /home/ubuntu/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-db.sh
```

---

## 🗑️ **Cleanup:**

### **Delete Old Records:**

```javascript
// In mongosh
use earn_peerpays

// Delete bookings older than 90 days
db.bookings.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 90*24*60*60*1000) }
})

// Delete old notifications
db.notifications.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) },
  read: true
})
```

---

## 📊 **Useful Queries:**

### **Get Statistics:**

```javascript
// Total users by role
db.users.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } }
])

// Total earnings
db.ledgers.aggregate([
  { $group: { _id: null, total: { $sum: "$amount" } } }
])

// Active deals
db.deals.find({ active: true }).count()

// Recent bookings
db.bookings.find().sort({ createdAt: -1 }).limit(10)
```

---

## 🚨 **Troubleshooting:**

### **MongoDB won't start:**

```bash
# Check logs
sudo tail -50 /var/log/mongodb/mongod.log

# Check disk space
df -h

# Check if port is in use
sudo ss -tulpn | grep 27017

# Remove lock file if corrupted
sudo rm /var/lib/mongodb/mongod.lock
sudo systemctl restart mongod
```

### **Connection refused:**

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Check if listening on correct port
sudo netstat -tulpn | grep 27017

# Restart MongoDB
sudo systemctl restart mongod
```

---

## 💡 **Tips:**

1. **Regular Backups:** Setup daily automated backups
2. **Monitor Size:** Check database size regularly
3. **Index Optimization:** Add indexes for frequently queried fields
4. **Cleanup Old Data:** Delete old records periodically
5. **Security:** Enable authentication for production

---

## 📞 **Quick Commands Reference:**

```bash
# Connect to DB
mongosh

# List databases
show dbs

# Use database
use earn_peerpays

# List collections
show collections

# Find all documents in collection
db.users.find()

# Count documents
db.users.countDocuments()

# Find one
db.users.findOne({ email: "admin@peerpays.com" })

# Update
db.users.updateOne(
  { email: "admin@peerpays.com" },
  { $set: { name: "New Name" } }
)

# Delete
db.bookings.deleteOne({ _id: ObjectId("...") })

# Exit
exit
```

---

**Database fully accessible and backed by persistent storage!** ✅
