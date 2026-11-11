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
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
