require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const User = require('./model/user.model');
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Route to make a user admin
app.post('/make-admin', async (req, res) => {
  const { requesterId, targetUserId } = req.body; // Expect requesterId and targetUserId in the request body

  try {
    // Step 1: Check if the requester is an admin
    const requestingUser = await User.findOne({ userId: requesterId });

    if (!requestingUser || !requestingUser.isAdmin) {
      return res.status(403).send('You do not have permission to make another user an admin.');
    }

    // Step 2: Promote the target user to admin
    const result = await User.updateOne({ userId: targetUserId }, { isAdmin: true });

    if (result.modifiedCount > 0) {
      res.send(`User ${targetUserId} has been made an admin.`);
    } else {
      res.send(`User ${targetUserId} not found or is already an admin.`);
    }
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).send('An error occurred while updating the user.');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
