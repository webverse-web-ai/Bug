import connectToDatabase from '@/server/lib/db';
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

    const sessions = await Chat.find({ user: decoded.id });

    // Ensure _id is sent as id for frontend convenience
    const formattedSessions = sessions.map(s => ({
      id: s._id.toString(),
      title: s.title,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt
    }));

    return Response.json({ sessions: formattedSessions }, { status: 200 });
  } catch (error) {
    console.error('Sessions API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
