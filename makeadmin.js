require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const User = require('./model/user.model');
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Update user to admin status
      const userId = 1808813567; // Replace with the user's Telegram userId
      const result = await User.updateOne({ userId: userId }, { isAdmin: true });
      
      if (result.modifiedCount > 0) {
        console.log(`User ${userId} has been made an admin.`);
      } else {
        console.log(`User ${userId} not found or already an admin.`);
      }
    } catch (err) {
      console.error('Error updating user:', err);
    } finally {
      mongoose.connection.close();
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.post('/make-admin', async (req, res) => {
    const { userId } = req.body; // Expect userId in the request body
    
    try {
      const result = await User.updateOne({ userId: userId }, { isAdmin: true });
      
      if (result.modifiedCount > 0) {
        res.send(`User ${userId} has been made an admin.`);
      } else {
        res.send(`User ${userId} not found or already an admin.`);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send('An error occurred while updating the user.');
    }
  });
  