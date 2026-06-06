import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    await connectToDatabase();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify backend JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    } catch (err) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { openRouterKey } = body;

    if (!openRouterKey) {
      return Response.json({ error: 'OpenRouter Key is required' }, { status: 400 });
    }

    // Verify key with OpenRouter API
    try {
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
        method: "GET",
        headers: { Authorization: `Bearer ${openRouterKey.trim()}` }
      });
      
      if (!openRouterRes.ok) {
        return Response.json({ error: 'Invalid OpenRouter API Key. Please verify your key.' }, { status: 400 });
      }
    } catch (apiError) {
      console.error('OpenRouter Verification Error:', apiError);
      return Response.json({ error: 'Failed to connect to OpenRouter for verification.' }, { status: 502 });
    }


    // Update user in DB
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { openRouterKey: openRouterKey },
      { new: true }
    );

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'OpenRouter Key saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Save OpenRouter Key Error:', error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
