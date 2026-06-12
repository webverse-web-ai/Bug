import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({ email: String, geminiToken: String }, { strict: false });
const User = mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'devaman.net@gmail.com' });
  console.log('Token length:', user.geminiToken.length);
  console.log('Token snippet:', user.geminiToken.substring(0, 10));
  process.exit(0);
}
run();
