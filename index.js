require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const { v4: uuidv4 } = require("uuid");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 8000;
const dbUri = process.env.MONGO_URI;

mongoose
  .connect(dbUri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

const User = require("./model/user.model"); 

app.use(express.json());
app.use(bodyParser.json());

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
// const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

let userData = {};
let registeredUsers = new Set();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start(?:\s+([\w-]+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const referralCode = match[1];

  try {
    const existingUser = await User.findOne({ userId });

    if (existingUser) {
      return bot.sendMessage(
        msg.chat.id,
        "You are already registered. You can use the /help command to see available options."
      );
    }

    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        userData[userId] = { referrer: referrer.userId };
      }
    }

    const userReferralCode = uuidv4();
    if (!userData[userId]) {
      userData[userId] = {};
    }
    userData[userId].referralCode = userReferralCode;

    bot.sendMessage(
      msg.chat.id,
      "Welcome! Please provide your name (First and Last) to get started."
    );
  } catch (err) {
    bot.sendMessage(
      msg.chat.id,
      "An error occurred while checking your registration status. Please try again."
    );
  }
});

bot.on("message", async (msg) => {
  const userId = msg.from.id;
  const text = msg.text;

  if (!userData[userId]) {
    return;
  }

  if (!userData[userId].name) {
    userData[userId].name = text;
    bot.sendMessage(msg.chat.id, "Great! Please provide your email address.");
  } else if (!userData[userId].email) {
    if (validateEmail(text)) {
      userData[userId].email = text;
      bot.sendMessage(msg.chat.id, "Please provide your WhatsApp contact.");
    } else {
      bot.sendMessage(msg.chat.id, "Please enter a valid email address.");
    }
  } else if (!userData[userId].whatsapp) {
    userData[userId].whatsapp = text;
    bot.sendMessage(msg.chat.id, "Which university do you attend?");
  } else if (!userData[userId].university) {
    userData[userId].university = text;
    bot.sendMessage(
      msg.chat.id,
      "What is your current level of study (e.g., 100, 200, etc.)?"
    );
  } else if (!userData[userId].level) {
    userData[userId].level = text;
    bot.sendMessage(msg.chat.id, "What is your course of study?");
  } else if (!userData[userId].course) {
    userData[userId].course = text;
    bot.sendMessage(msg.chat.id, "Share your BEP20 wallet address.");
  } else if (!userData[userId].walletAddress) {
    userData[userId].walletAddress = text;

    const newUser = new User({
      userId: msg.from.id,
      name: userData[userId].name,
      email: userData[userId].email,
      whatsapp: userData[userId].whatsapp,
      university: userData[userId].university,
      level: userData[userId].level,
      course: userData[userId].course,
      walletAddress: userData[userId].walletAddress,
      referralCode: userData[userId].referralCode,
    });

    try {
      await newUser.save();

      if (userData[userId].referrer) {
        const referredUsername = msg.from.username || "No username";

        await User.findOneAndUpdate(
          { userId: userData[userId].referrer },
          {
            $push: { referredUsers: referredUsername },
            $inc: { referrals: 1 },
          }
        );
      }

      bot.sendMessage(
        msg.chat.id,
        `Your information has been successfully saved. Welcome to the group!
            Here are the commands you can use:
           /start - Start the registration process
           /invite - Get your referral link
           /referrals - View your referrals and their details
           /help - Show this help message`
      );

      registeredUsers.add(userId);

      bot.sendMessage(
        msg.chat.id,
        `Here is your invite link to join the group:\n
        <b>GROUP LINK</b>\n
        https://t.me/+Kpfa4X6iLTZiOWE0\n\n
        Join the Channel also through this link:\n
        <b>CHANNEL LINK</b>\n
        https://t.me/SocratesNigeriaStudents`,
        { parse_mode: "HTML" }
      );

      delete userData[userId];
    } catch (err) {
      bot.sendMessage(
        msg.chat.id,
        "An error occurred while saving your data. Please try again."
      );
    }
  }
});

bot.onText(/\/invite/, async (msg) => {
  const userId = msg.from.id;
  console.log("Received /invite command from userId:", userId);

  try {
    // Check if the user is already registered
    const user = await User.findOne({ userId: userId });

    if (!user) {
      console.log(`User ${userId} is not registered.`);
      return bot.sendMessage(
        msg.chat.id,
        "You need to complete your registration before you can get your referral link."
      );
    }

    // Retrieve the stored referral code from the user's document
    const referralCode = user.referralCode;

    if (!referralCode) {
      // Generate a new referral code if it doesn't exist
      referralCode = uuidv4();
      user.referralCode = referralCode;
      await user.save();
    }

    // Generate a referral link
    const referralLink = `https://t.me/socra_tes_bot?start=${referralCode}`;

    bot.sendMessage(msg.chat.id, `Here is your referral link: ${referralLink}`);
  } catch (err) {
    console.error("Error handling /invite command:", err);
    bot.sendMessage(
      msg.chat.id,
      "An error occurred while generating your referral link. Please try again."
    );
  }
});

// Handle the /referrals command
bot.onText(/\/referrals/, async (msg) => {
  const userId = msg.from.id;

  try {
    // Check if the user is already registered
    const user = await User.findOne({ userId: userId });

    if (!user) {
      return bot.sendMessage(
        msg.chat.id,
        "You need to complete your registration before you can view your referrals."
      );
    }

    // Retrieve referred users (which are stored as usernames)
    const referredUsers = user.referredUsers;

    if (!referredUsers || referredUsers.length === 0) {
      return bot.sendMessage(msg.chat.id, "You have no referrals yet.");
    }

    // Format and send referral list (display usernames directly)
    let referralInfo = "Your referrals:\n";
    referredUsers.forEach((username, index) => {
      referralInfo += `${index + 1}. Username: @${username}\n`;
    });

    bot.sendMessage(msg.chat.id, referralInfo);
  } catch (err) {
    console.error("Error handling /referrals command:", err);
    bot.sendMessage(
      msg.chat.id,
      "An error occurred while retrieving your referrals. Please try again."
    );
  }
});

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Add the new `/all_users` command for admins
bot.onText(/\/all_users/, async (msg) => {
  const adminId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    // Fetch the user to check if they are an admin
    const adminUser = await User.findOne({ userId: adminId });

    if (!adminUser || !adminUser.isAdmin) {
      return bot.sendMessage(
        chatId,
        "You do not have permission to use this command. You can use the /help command to see available options."
      );
    }

    // Retrieve all users from MongoDB
    const allUsers = await User.find();

    if (allUsers.length === 0) {
      return bot.sendMessage(chatId, "No users found in the database.");
    }

    // Display users' information in a message with HTML formatting
    let response = `List of all registered users (${allUsers.length} users):\n\n`;

    // Iterate over users and fetch their Telegram details
    for (const [index, user] of allUsers.entries()) {
      try {
        const telegramUser = await bot.getChat(user.userId);
        const username = telegramUser.username || "Not provided";

        // Count the number of referrals (username entries in referredUsers array)
        const referralCount = user.referredUsers
          ? user.referredUsers.length
          : 0;

        response +=
          `${index + 1}. ${user.name} (@${username})\n` +
          `<b>Name:</b> ${user.name || "Not provided"}\n` +
          `<b>Email:</b> ${user.email || "Not provided"}\n` +
          `<b>University:</b> ${user.university || "Not provided"}\n` +
          `<b>Level:</b> ${user.level || "Not provided"}\n` +
          `<b>Wallet Address:</b> <code>${
            user.walletAddress || "Not provided"
          }</code>\n` +
          `<b>Referrals:</b> ${referralCount}\n`;
      } catch (err) {
        console.error(
          `Error fetching Telegram details for user ${user.userId}:`,
          err
        );
        response +=
          `${index + 1}. ${user.name} (@Unknown)\n` +
          `<b>Name:</b> ${user.name || "Not provided"}\n` +
          `<b>Email:</b> ${user.email || "Not provided"}\n` +
          `<b>University:</b> ${user.university || "Not provided"}\n` +
          `<b>Level:</b> ${user.level || "Not provided"}\n` +
          `<b>Wallet Address:</b> <code>${
            user.walletAddress || "Not provided"
          }</code>\n` +
          `<b>Referrals:</b> ${referralCount}\n`;
      }
    }

    // Send the formatted message with HTML parse mode
    bot.sendMessage(chatId, response, { parse_mode: "HTML" });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "An error occurred while retrieving users.");
  }
});

bot.onText(/\/users_wallet/, async (msg) => {
  const adminId = msg.from.id; // Use adminId to check if the user is an admin
  const chatId = msg.chat.id;

  try {
    // Fetch the admin user details from MongoDB to check permissions
    const adminUser = await User.findOne({ userId: adminId });

    if (!adminUser || !adminUser.isAdmin) {
      return bot.sendMessage(
        chatId,
        "You do not have permission to use this command. You can use the /help command to see available options."
      );
    }

    // Retrieve all users from MongoDB
    const allUsers = await User.find();

    if (allUsers.length === 0) {
      return bot.sendMessage(chatId, "No users found in the database.");
    }

    // Display users' information in a message with HTML formatting
    let response = "Wallets of all qualified users:\n\n";

    allUsers.forEach((user, index) => {
      // Fetch user details from Telegram using the userId
      bot
        .getChat(user.userId)
        .then((userDetails) => {
          const username = userDetails.username || "Not provided";

          // Count the number of referrals (username entries in referredUsers array)
          const referralCount = user.referredUsers
            ? user.referredUsers.length
            : 0;

          response +=
            `${index + 1}. ${user.name} (@${username})\n` +
            `<b>Wallet Address:</b> <code>${
              user.walletAddress || "Not provided"
            }</code>\n`;
          // Send the formatted message with HTML parse mode once all users are processed
          if (index === allUsers.length - 1) {
            bot.sendMessage(chatId, response, { parse_mode: "HTML" });
          }
        })
        .catch((err) => {
          console.error(err);
          bot.sendMessage(
            chatId,
            "An error occurred while retrieving users' information."
          );
        });
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(
      chatId,
      "An error occurred while retrieving users' information."
    );
  }
});

bot.onText(/\/leaderboard/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    // Fetch the user to check if they are authorized to use the command
    const user = await User.findOne({ userId });

    if (!user || !user.isAdmin) {
      return bot.sendMessage(
        chatId,
        "You do not have permission to use this command."
      );
    }

    // Retrieve all users from MongoDB and sort by number of referrals in descending order
    const allUsers = await User.find().sort({ referrals: -1 });

    if (allUsers.length === 0) {
      return bot.sendMessage(chatId, "No users found in the database.");
    }

    // Display users' information in a message with HTML formatting
    let response = "<b>Referral Leaderboard:</b>\n\n";

    // Iterate over sorted users and create a response
    for (const [index, user] of allUsers.entries()) {
      // Fetch user details from Telegram using the userId
      try {
        const chat = await bot.getChat(user.userId);
        const username = chat.username || "Not provided";

        response +=
          `${index + 1}. ${user.name} (@${username})\n` +
          `<b>Referrals:</b> ${user.referrals || 0}\n`;
      } catch (err) {
        console.error(`Failed to get details for user ${user.userId}:`, err);
        response +=
          `${index + 1}. ${user.name}\n` +
          `<b>Referrals:</b> ${user.referrals || 0}\n`;
      }
    }

    // Send the formatted message with HTML parse mode
    bot.sendMessage(chatId, response, { parse_mode: "HTML" });
  } catch (err) {
    console.error(err);
    bot.sendMessage(
      chatId,
      "An error occurred while retrieving the leaderboard."
    );
  }
});

// Define admin commands list
const adminCommands = `
/admin - List available admin commands
/all_users - List all registered users
/makeadmin - promote an admin
/removeadmin - remove an admin
/users_wallets - List all registered contestants
/leaderboard - Show the leaderboard
/help - Show help information
`;

// Handle the /admin command
bot.onText(/\/admin/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    // Fetch the user to check if they are an admin
    const user = await User.findOne({ userId });

    if (!user || !user.isAdmin) {
      return bot.sendMessage(
        chatId,
        "You do not have permission to use this command, You can use the /help command to see available options."
      );
    }

    // Send the list of admin commands if the user is an admin
    bot.sendMessage(
      chatId,
      `Here are the available admin commands:\n${adminCommands}`
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(
      chatId,
      "An error occurred while checking your admin status."
    );
  }
});

// Define user commands list
const userCommands = `
/start - Start the registration process
/invite - Get your referral link
/referrals - View your referrals and their details
/help - Show this help message
`;

// Handle the /help command
bot.onText(/\/help/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    // Check if the user is an admin
    const user = await User.findOne({ userId });

    if (user && user.isAdmin) {
      // Send the admin help message
      return bot.sendMessage(
        chatId,
        `Here are the available commands:\n${userCommands}\n${adminCommands}`
      );
    }

    // If not an admin, send the regular user help message
    bot.sendMessage(
      chatId,
      `Here are the available commands:\n${userCommands}`
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(
      chatId,
      "An error occurred while displaying the help message."
    );
  }
});

// Bot command to make another user an admin
// Store user states globally
const userStates = {};
const botOwner = 1808813567;
// Step 1: Handle /makeadmin command
bot.onText(/\/makeadmin/, async (msg) => {
  const requesterId = msg.from.id; 
  console.log(requesterId)
  try {

      if (requesterId !== botOwner) {
        return bot.sendMessage(
        msg.chat.id,
        "You do not have permission to make another user an admin."
      );
        }
    
    // Ask the requester for the user ID to make admin
    bot.sendMessage(
      msg.chat.id,
      "Please enter the ID of the user you want to make an admin."
    );

    // Store the state for the requester
    userStates[requesterId] = { waitingForUserId: true };

  } catch (err) {
    console.error("Error checking admin status:", err);
    bot.sendMessage(
      msg.chat.id,
      "An error occurred while checking your admin status."
    );
  }
});

// Step 2: Handle text responses after /makeadmin is invoked
bot.on("message", async (msg) => {
  const requesterId = msg.from.id;

  // Check if we're waiting for a user ID from this requester
  if (userStates[requesterId] && userStates[requesterId].waitingForUserId) {
    const targetUserId = msg.text; // The user ID the requester provided

    try {
      // Find the target user and make them an admin
      const updatedUser = await User.findOneAndUpdate(
        { userId: targetUserId },
        { isAdmin: true },
        { new: true } // Return the updated document
      );

      if (updatedUser) {
        bot.sendMessage(
          msg.chat.id,
          `User ${updatedUser.name || targetUserId} has been promoted to admin.`
        );
        bot.sendMessage(
          targetUserId,
          `You have been promoted to admin by @${msg.from.username || 'Admin'}.
            click /admin to get started
          `
        );
      } else {
        bot.sendMessage(
          msg.chat.id,
          `User with ID ${targetUserId} not found or could not be updated.`
        );
      }

    } catch (err) {
      console.error("Error making user admin:", err);
      bot.sendMessage(
        msg.chat.id,
        "An error occurred while trying to promote the user to admin."
      );
    }

    // Clear the state after processing the request
    delete userStates[requesterId];
  }
});

// Step 1: Handle /removeadmin command
bot.onText(/\/removeadmin/, async (msg) => {
  const requesterId = msg.from.id; // The user who issued the command

  try {
    // Check if the requester is an admin
    const requestingUser = await User.findOne({ userId: requesterId });

    if (!requestingUser || !requestingUser.isAdmin) {
      return bot.sendMessage(
        msg.chat.id,
        "You do not have permission to remove another admin."
      );
    }

    // Ask the requester for the user ID to remove admin rights
    bot.sendMessage(
      msg.chat.id,
      "Please enter the ID of the user you want to remove from admin."
    );

    // Store the state for the requester
    userStates[requesterId] = { waitingForUserIdToRemove: true };

  } catch (err) {
    console.error("Error checking admin status:", err);
    bot.sendMessage(
      msg.chat.id,
      "An error occurred while checking your admin status."
    );
  }
});

// Step 2: Handle text responses after /removeadmin is invoked
bot.on("message", async (msg) => {
  const requesterId = msg.from.id;

  // Check if we're waiting for a user ID to remove admin from this requester
  if (userStates[requesterId] && userStates[requesterId].waitingForUserIdToRemove) {
    const targetUserId = msg.text; // The user ID the requester provided

    try {
      // Find the target user and remove their admin status
      const updatedUser = await User.findOneAndUpdate(
        { userId: targetUserId },
        { isAdmin: false },
        { new: true } // Return the updated document
      );

      if (updatedUser) {
        bot.sendMessage(
          msg.chat.id,
          `User ${updatedUser.name || targetUserId} has been removed from admin status.`
        );
      } else {
        bot.sendMessage(
          msg.chat.id,
          `User with ID ${targetUserId} not found or could not be updated.`
        );
      }

    } catch (err) {
      console.error("Error removing admin status:", err);
      bot.sendMessage(
        msg.chat.id,
        "An error occurred while trying to remove the user's admin status."
      );
    }

    // Clear the state after processing the request
    delete userStates[requesterId];
  }
});

// Export the app for serverless function
module.exports = (req, res) => {
  return app(req, res);
};
