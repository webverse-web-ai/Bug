import connectToDatabase from '@/server/lib/db';
import Chat from '@/server/models/Chat';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

async function authenticate(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function PUT(request, { id }) {
  try {
    await connectToDatabase();
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title } = await request.json();
    if (!title || typeof title !== 'string') {
      return Response.json({ error: 'Invalid title' }, { status: 400 });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: id, user: user.id },
      { title },
      { new: true }
    );
    
    if (!chat) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json({ session: { id: chat._id.toString(), title: chat.title } }, { status: 200 });
  } catch (error) {
    console.error('Session PUT API Error:', error);
    return Response.json({ error: 'Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const user = await authenticate(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const chat = await Chat.findOneAndDelete({ _id: id, user: user.id });
    if (!chat) return Response.json({ error: 'Session not found' }, { status: 404 });
    
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Session DELETE API Error:', error);
    return Response.json({ error: 'Server Error' }, { status: 500 });
  }
}
