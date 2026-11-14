# MongoDB Database Access Guide

## Server Details
- **Server IP:** 130.210.25.204
- **Database:** earn_peerpays
- **MongoDB Port:** 27017 (localhost only)

---

## Quick Access Methods

### 🎨 Method 1: MongoDB Compass (Best for Beginners)

**Step 1:** Create SSH Tunnel
```bash
ssh -i "ssh-key-2026-11-12.key" -L 27017:localhost:27017 ubuntu@130.210.25.204 -N
```
*Keep this terminal open*

**Step 2:** Open MongoDB Compass and connect:
```
mongodb://localhost:27017/earn_peerpays
```

**Features:**
- Visual interface
- Query builder
- Document editor
- Import/Export
- Aggregation pipeline builder

---

### 💻 Method 2: MongoDB Shell (mongosh)

**Direct SSH:**
```bash
ssh -i "ssh-key-2026-11-12.key" ubuntu@130.210.25.204 'mongosh earn_peerpays'
```

**Common Queries:**
```javascript
// Show all collections
show collections

// Find all users
db.users.find()

// Find admin users
db.users.find({ role: 'admin' })

// Count bookings
db.bookings.countDocuments()

// Find recent deals
db.deals.find().sort({ createdAt: -1 }).limit(5)

// Aggregation example
db.bookings.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Update a user
db.users.updateOne(
  { username: 'admin' },
  { $set: { name: 'Super Admin' } }
)

// Delete old notifications
db.notifications.deleteMany({ 
  createdAt: { $lt: new Date('2026-01-01') } 
})
```

---

### 🔧 Method 3: Helper Script

**Run the script:**
```bash
./DB_ACCESS.sh
```

**Options:**
1. Open MongoDB Shell
2. Create SSH Tunnel (for Compass)
3. Export entire database
4. Show all collections
5. Count documents
6. Create backup

---

## Collections Overview

### Main Collections:
- **users** - User accounts (admin, cardholder, booker, viewer)
- **deals** - Deal listings created by admin
- **cards** - Credit/debit cards owned by cardholders
- **bookings** - Card submissions and order tracking
- **ledger** - Transaction ledger (earnings/debts)
- **payments** - Payment records
- **notifications** - In-app notifications
- **pushsubscriptions** - Push notification subscriptions

---

## Backup & Restore

### Create Backup:
```bash
# Via SSH
ssh -i "ssh-key-2026-11-12.key" ubuntu@130.210.25.204 \
  "mongodump --db=earn_peerpays --archive --gzip" > backup.gz

# Or using helper script
./DB_ACCESS.sh  # Choose option 6
```

### Restore Backup:
```bash
# To remote server
cat backup.gz | ssh -i "ssh-key-2026-11-12.key" ubuntu@130.210.25.204 \
  "mongorestore --archive --gzip --drop"

# To local MongoDB
mongorestore --archive=backup.gz --gzip
```

---

## Security Notes

⚠️ **Important:**
- MongoDB is only accessible via localhost on the server (not exposed to internet)
- SSH tunnel required for remote access (secure)
- SSH key is required for all access
- Never commit SSH keys to git
- Regular backups recommended (weekly)

---

## Useful Queries

### User Management
```javascript
// Create new admin
db.users.insertOne({
  username: 'newadmin',
  passwordHash: '$2a$10$...',  // Use bcrypt
  role: 'admin',
  name: 'New Admin',
  phone: '9876543210',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

// List all inactive users
db.users.find({ active: false })

// Count users by role
db.users.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } }
])
```

### Deal Analytics
```javascript
// Active deals count
db.deals.countDocuments({ status: 'open' })

// Deals by platform
db.deals.aggregate([
  { $group: { _id: "$platform", count: { $sum: 1 } } }
])

// Recent deals
db.deals.find().sort({ createdAt: -1 }).limit(10).pretty()
```

### Booking/Order Stats
```javascript
// Bookings by status
db.bookings.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// Completed orders today
db.bookings.countDocuments({
  status: 'COMPLETED',
  completedAt: { 
    $gte: new Date(new Date().setHours(0,0,0,0)) 
  }
})

// Total order value
db.bookings.aggregate([
  { $match: { status: 'COMPLETED' } },
  { $group: { _id: null, total: { $sum: "$dealSnapshot.price" } } }
])
```

### Ledger Queries
```javascript
// User's total earnings
db.ledger.aggregate([
  { $match: { user: ObjectId('USER_ID_HERE') } },
  { $group: { _id: null, total: { $sum: "$amount" } } }
])

// All pending payments
db.payments.find({ status: 'pending' })
```

---

## Monitoring

### Check Database Size:
```bash
ssh -i "ssh-key-2026-11-12.key" ubuntu@130.210.25.204 \
  "mongosh earn_peerpays --quiet --eval 'db.stats()'"
```

### Check Server MongoDB Status:
```bash
ssh -i "ssh-key-2026-11-12.key" ubuntu@130.210.25.204 \
  "sudo systemctl status mongod"
```

---

## Emergency Commands

### Reset Admin Password:
```javascript
// In mongosh
db.users.updateOne(
  { username: 'admin' },
  { $set: { passwordHash: '$2a$10$...' } }  // New bcrypt hash
)
```

### Clear All Notifications:
```javascript
db.notifications.deleteMany({})
```

### Reset Demo Data:
```javascript
// Delete all bookings
db.bookings.deleteMany({})

// Delete all ledger entries
db.ledger.deleteMany({})

// Delete all payments
db.payments.deleteMany({})
```

---

## Need Help?

- MongoDB Docs: https://www.mongodb.com/docs/manual/
- mongosh Docs: https://www.mongodb.com/docs/mongodb-shell/
- MongoDB Compass: https://www.mongodb.com/products/compass

**Helper Script:** `./DB_ACCESS.sh`
