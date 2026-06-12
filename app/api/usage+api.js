import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
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

// Live account usage/limits straight from OpenRouter (no assumptions).
async function fetchOpenRouterKeyInfo(openRouterKey) {
  if (!openRouterKey) return null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${openRouterKey}` },
    });
    if (!r.ok) return { error: `OpenRouter responded ${r.status}` };
    const d = await r.json();
    const k = d.data || {};
    return {
      label: k.label ?? null,
      isFreeTier: !!k.is_free_tier,
      usage: k.usage ?? null,               // credits used
      limit: k.limit ?? null,               // credit limit (null = unlimited)
      limitRemaining: k.limit_remaining ?? null,
      rateLimit: k.rate_limit ?? null,      // { requests, interval }
    };
  } catch (e) {
    return { error: 'Could not reach OpenRouter' };
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await User.findById(decoded.id);
    const today = new Date().toISOString().slice(0, 10);
    const counts = user?.usageDate === today && user?.usageCounts ? user.usageCounts : {};
    const totalToday = Object.values(counts).reduce((a, b) => a + b, 0);

    // Resets at the next UTC midnight.
    const now = new Date();
    const resetAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
    ).toISOString();

    const openrouter = await fetchOpenRouterKeyInfo(user?.openRouterKey);

    // OpenRouter's published free-model request cap, keyed off the account's real
    // tier flag (free tier = 50/day, otherwise 1000/day). Null when we can't tell,
    // so the UI falls back to a relative gauge rather than inventing a number.
    let dailyLimit = null;
    if (openrouter && !openrouter.error) {
      dailyLimit = openrouter.isFreeTier ? 50 : 1000;
    }

    return Response.json({ counts, totalToday, resetAt, date: today, openrouter, dailyLimit }, { status: 200 });
  } catch (error) {
    console.error('Usage API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
