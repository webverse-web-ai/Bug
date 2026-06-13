import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import { GEMINI_MODELS } from '@/server/lib/geminiModels';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

// Gemini chat models the user can pick — only when their account is connected
// to Google Gemini (otherwise these wouldn't work, so we hide them).
export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await User.findById(decoded.id);
    const connected = !!user?.geminiToken;
    return Response.json({ connected, models: connected ? GEMINI_MODELS : [] }, { status: 200 });
  } catch (error) {
    console.error('Gemini Models API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
