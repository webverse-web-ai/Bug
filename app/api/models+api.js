import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

// Returns all FREE OpenRouter models (proxied server-side to avoid CORS).
export async function GET(request) {
  try {
    if (!authenticate(request)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch models from OpenRouter' }, { status: 502 });
    }

    const data = await res.json();
    const models = (data.data || [])
      .filter((m) => {
        const p = m.pricing || {};
        const isFree = String(p.prompt) === '0' && String(p.completion) === '0';
        if (!isFree && !String(m.id).endsWith(':free')) return false;

        // Only chat models: must OUTPUT text. This excludes image/audio/video
        // generators (e.g. riverflow) that can't serve a chat completion and
        // would otherwise hang or error when picked in the chat UI.
        const out = m.architecture?.output_modalities;
        return !Array.isArray(out) || out.includes('text');
      })
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        context: m.context_length || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ models }, { status: 200 });
  } catch (error) {
    console.error('Models API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
