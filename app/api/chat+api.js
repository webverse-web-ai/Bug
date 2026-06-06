import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function POST(request) {
  try {
    await connectToDatabase();

    // Extract the user's backend JWT token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Missing Authorization header. Please login.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return Response.json({ error: 'Unauthorized, invalid token' }, { status: 401 });
    }

    const user = await User.findById(decoded.id);
    if (!user || (!user.geminiToken && !user.openRouterKey)) {
      return Response.json({ error: 'Not connected to Google Gemini or OpenRouter. Please go to Setup and connect your account.' }, { status: 403 });
    }

    const geminiToken = user.geminiToken;

    const body = await request.json();
    const { contents } = body;

    if (!contents || !Array.isArray(contents)) {
      return Response.json({ error: 'Invalid contents format' }, { status: 400 });
    }

    if (user.openRouterKey) {
      console.log('Using OpenRouter...');
      const openRouterMessages = contents.map(c => ({
        role: c.role === 'model' ? 'assistant' : 'user',
        content: c.parts.map(p => p.text).join('\n')
      }));

      try {
        const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://bugai.com', 
            'X-Title': 'Bug AI'
          },
          body: JSON.stringify({
            model: 'openrouter/auto',
            messages: openRouterMessages
          })
        });

        if (orResponse.ok) {
          const data = await orResponse.json();
          // Map OpenRouter response back to Gemini format for the frontend
          const textResponse = data.choices[0]?.message?.content || '';
          return Response.json({
            candidates: [
              {
                content: {
                  parts: [{ text: textResponse }],
                  role: 'model'
                }
              }
            ]
          });
        } else {
          const errorData = await orResponse.json().catch(() => ({}));
          console.error('OpenRouter API Error:', orResponse.status, errorData);
          // Fall through to Gemini below if OpenRouter fails
        }
      } catch (err) {
        console.error('OpenRouter Network Error:', err);
        // Fall through to Gemini below
      }
    }

    if (!user.geminiToken) {
      return Response.json({ error: 'OpenRouter failed and Gemini is not connected.' }, { status: 403 });
    }

    // Call the Gemini REST API using Developer API Key
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'antigravity-preview-05-2026'];
    let lastError = null;

    const apiKey = process.env.GEMINI_API_KEY;

    for (const model of models) {
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contents })
          }
        );

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          console.log(`Chat success with model: ${model}`);
          return Response.json(data);
        }

        const errorData = await geminiResponse.json().catch(() => ({}));
        
        // If it's 404 (model not found), try the next model
        if (geminiResponse.status === 404) {
          console.log(`Model ${model} not found, trying next...`);
          lastError = errorData;
          continue;
        }

        // For other errors (auth, quota, etc.), return immediately
        console.error(`Gemini API Error (${model}):`, geminiResponse.status, JSON.stringify(errorData));
        return Response.json(
          { error: errorData.error?.message || 'Gemini API Error', details: JSON.stringify(errorData) },
          { status: geminiResponse.status }
        );
      } catch (fetchErr) {
        lastError = fetchErr;
        continue;
      }
    }

    // All models failed
    return Response.json(
      { error: 'No available Gemini model found.', details: JSON.stringify(lastError) },
      { status: 500 }
    );

  } catch (error) {
    console.error('Chat API Error:', error);
    return Response.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
