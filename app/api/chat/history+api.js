import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Chat from '@/server/models/Chat';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function GET(request) {
  try {
    await connectToDatabase();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing Authorization header.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return Response.json({ error: 'Unauthorized, invalid token' }, { status: 401 });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    let chat;
    if (sessionId) {
      chat = await Chat.findOne({ _id: sessionId, user: user._id });
    } else {
      // For backward compatibility, fetch the latest or simply return empty
      // Actually if no sessionId is passed, it means we are in "New Chat" state before first message.
      return Response.json({ messages: [] }, { status: 200 });
    }
    
    if (!chat) {
      return Response.json({ messages: [] }, { status: 200 });
    }

    // Format for frontend
    const formattedMessages = chat.messages.map((msg, idx) => ({
      id: msg._id ? msg._id.toString() : msg.id ? msg.id.toString() : idx.toString(),
      role: msg.role,
      text: msg.text,
      attachments: msg.attachments || []
    }));

    return Response.json({ messages: formattedMessages }, { status: 200 });

  } catch (error) {
    console.error('Chat History API Error:', error);
    return Response.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
