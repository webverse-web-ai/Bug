import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  attachments: [{
    type: String // base64 or URL
  }]
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One main memory chat per user for now
  },
  messages: [messageSchema]
}, { timestamps: true });

// Avoid OverwriteModelError in Next.js/Expo API hot reloads
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

export default Chat;
