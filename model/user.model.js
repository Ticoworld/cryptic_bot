const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  userId: { type: Number, required: true, unique: true }, // Telegram user ID
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true }, // Ensure email is unique
  university: { type: String, required: true },
  level: { type: String, required: true },
  proofFileUrl: { type: String },
  walletAddress: { type: String },
  referrer: { type: Number }, // Store userId of the referrer
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



//   const userId = msg.from.id;
//   const referrerCode = match[1];

//   // Check if the user is already registered
//   if (!registeredUsers.has(userId)) {
//     return bot.sendMessage(
//       msg.chat.id,
//       "You need to complete your registration before you can provide a referrer."
//     );
//   }

//   // Check if referrer exists
//   const referrer = await User.findOne({ referralCode: referrerCode });

//   if (!referrer) {
//     return bot.sendMessage(
//       msg.chat.id,
//       "Invalid referral code. Please check and try again." 
//     );
//   }

//   // Save referrer ID
//   userData[userId] = userData[userId] || {};
//   userData[userId].referrer = referrer.userId;

//   // Update referrer's referredUsers list
//   await User.findByIdAndUpdate(referrer._id, {
//     $push: { referredUsers: userId }
//   });

//   bot.sendMessage(
//     msg.chat.id,
//     `You have been referred by user with referral code: ${referrerCode}`
//   );
// });