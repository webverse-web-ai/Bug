require('dotenv').config();
const { default: connectToDatabase } = require('./src/server/lib/db');
const User = require('./src/server/models/User').default;

async function run() {
  try {
    await connectToDatabase();
    const existingUser = await User.findOne({ username: 'testuser' });
    console.log("Existing user:", existingUser);
  } catch (error) {
    console.error("Error during findOne:", error);
  }
}

run();
