const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  userId: { type: Number, required: true, unique: true }, // Telegram user ID
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true }, // Ensure email is unique
  walletAddress: { type: String },
  whatsapp: { type: String },
  referralCode: { type: String, unique: true, required: true }, // Unique referral code
  referredUsers: [{ type: String }], // List of referred userIds
  referrals: { type: Number, default: 0 }, // Number of referrals made by the user
  isAdmin: { type: Boolean, default: false } // Field to indicate if user is an admin
}, {
  timestamps: true // Automatically manage createdAt and updatedAt fields
});

// Add index to improve search performance on referral code and email
userSchema.index({ referralCode: 1 });
userSchema.index({ email: 1 });

// Export the model
module.exports = mongoose.model('User', userSchema); 