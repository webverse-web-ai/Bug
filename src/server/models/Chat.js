import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model'],
    required: true
  },
  text: {
    type: String,
    default: ''
  },
  attachments: [{
    type: String // base64 or URL
  }]
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  messages: [messageSchema]
}, { timestamps: true });

// Avoid OverwriteModelError in Next.js/Expo API hot reloads
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

export default Chat;
