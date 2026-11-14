const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  entryType: {
    type: String,
    enum: ['order', 'payment'],
    required: true,
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNotes: String,
  resolvedAt: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Issue', issueSchema);
