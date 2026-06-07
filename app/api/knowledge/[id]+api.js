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

// Edit a knowledge entry
export async function PUT(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, content } = await request.json();
    if (content !== undefined && !content.trim()) {
      return Response.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    const entry = await Knowledge.findOne({ _id: id, user: decoded.id });
    if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();
    await Knowledge.update(id, updates);

    return Response.json({
      entry: { id, title: updates.title ?? entry.title, content: updates.content ?? entry.content },
    }, { status: 200 });
  } catch (error) {
    console.error('Knowledge PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a knowledge entry
export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Knowledge.findOne({ _id: id, user: decoded.id });
    if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });

    await Knowledge.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Knowledge DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
