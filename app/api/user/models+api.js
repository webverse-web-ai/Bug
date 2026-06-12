import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import { BUG_MODEL, isBugId } from '@/server/lib/bugModel';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Default chat models if the user hasn't picked any yet.
// Curated from a live responsiveness probe — these consistently return content
// on the free tier (others were 429-throttled or are image/empty models).
export const DEFAULT_MODELS = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT OSS 20B' },
  { id: 'nex-agi/nex-n2-pro:free', name: 'Nex N2 Pro' },
];

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// Get the user's selected chat models (max 5).
export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await User.findById(decoded.id);
    const picks = user?.selectedModels?.length ? user.selectedModels : DEFAULT_MODELS;
    // Bug is always first and always present — it can't be removed.
    const models = [BUG_MODEL, ...picks.filter((m) => !isBugId(m.id))];
    return Response.json({ models }, { status: 200 });
  } catch (error) {
    console.error('User Models GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Save the user's selected chat models (capped at 5).
export async function PUT(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { models } = await request.json();
    if (!Array.isArray(models)) {
      return Response.json({ error: 'models must be an array' }, { status: 400 });
    }

    // Never persist the virtual Bug entry — it's re-added on read.
    const clean = models
      .filter((m) => m && m.id && !isBugId(m.id))
      .slice(0, 5)
      .map((m) => ({ id: String(m.id), name: String(m.name || m.id) }));

    await User.update(decoded.id, { selectedModels: clean });
    return Response.json({ models: [BUG_MODEL, ...clean] }, { status: 200 });
  } catch (error) {
    console.error('User Models PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
