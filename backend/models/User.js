const mongoose = require('mongoose');

// 'viewer' is a hidden, read-only admin: it can view everything an admin sees but
// cannot make any changes, and it is never exposed in any user listing.
const ROLES = ['admin', 'viewer', 'cardholder', 'booker'];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
    anonymousCode: { type: String, unique: true, sparse: true }, // C1, C2 for cardholders, B1, B2 for bookers
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

// Get display name - anonymous code for privacy
userSchema.methods.getDisplayName = function (viewerRole) {
  // Admin/viewer can see real names
  if (viewerRole === 'admin' || viewerRole === 'viewer') {
    return this.name;
  }
  // Bookers see cardholder anonymous codes
  if (viewerRole === 'booker' && this.role === 'cardholder') {
    return this.anonymousCode || this.name;
  }
  // Cardholders see booker anonymous codes  
  if (viewerRole === 'cardholder' && this.role === 'booker') {
    return this.anonymousCode || this.name;
  }
  // Same role or other cases - show real name
  return this.name;
};

// Auto-generate anonymous code for new users
userSchema.pre('save', async function (next) {
  if (this.isNew && !this.anonymousCode) {
    const User = mongoose.model('User');
    const prefix = this.role === 'cardholder' ? 'C' : this.role === 'booker' ? 'B' : null;
    
    if (prefix) {
      // Find the highest number for this prefix
      const lastUser = await User.findOne({ anonymousCode: new RegExp(`^${prefix}\\d+$`) })
        .sort({ anonymousCode: -1 })
        .limit(1);
      
      let nextNumber = 1;
      if (lastUser && lastUser.anonymousCode) {
        const match = lastUser.anonymousCode.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }
      
      this.anonymousCode = `${prefix}${nextNumber}`;
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
