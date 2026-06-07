import connectToDatabase from '@/server/lib/db';
import Knowledge from '@/server/models/Knowledge';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// List the current user's knowledge entries
export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entries = await Knowledge.find({ user: decoded.id });
    const formatted = entries.map(e => ({
      id: e._id.toString(),
      title: e.title,
      content: e.content,
      source: e.source,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return Response.json({ entries: formatted }, { status: 200 });
  } catch (error) {
    console.error('Knowledge GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new knowledge entry
export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, content } = await request.json();
    if (!content || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    const entry = await Knowledge.create({
      user: decoded.id,
      title: (title || '').trim(),
      content: content.trim(),
      source: 'manual',
    });

    return Response.json({
      entry: {
        id: entry._id.toString(),
        title: entry.title,
        content: entry.content,
        source: entry.source,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Knowledge POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
