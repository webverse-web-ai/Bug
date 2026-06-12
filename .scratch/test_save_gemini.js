import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  geminiToken: String
}, { strict: false });
const User = mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne();
  if (user) {
    console.log("Found user:", user.email);
    console.log("Has geminiToken?", user.geminiToken);
  } else {
    console.log("No users in DB");
  }
  process.exit(0);
}
run();
