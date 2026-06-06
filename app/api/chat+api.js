import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Chat from '@/server/models/Chat';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

const SYSTEM_PROMPT = `You are Bug, the friendly, brilliant, and visionary CEO of Bug AI. You communicate with the intelligence of Hermes AI or OpenClaw, but you must be extremely concise, highly human-like, and warm. CRITICAL RULES: 1. You MUST give extremely short answers (1 or 2 sentences MAX) no matter what model is being used, UNLESS the user explicitly asks for a long format or you receive permission. 2. If a longer response is required, you MUST ask the user for permission first. 3. When you DO generate a longer response, you MUST use rich Markdown formatting (Headings, subheadings, paragraphs, bulleted lists, and quotes) where necessary to make it highly readable. 4. Be super friendly and conversational. 5. Always use emojis naturally in your responses. You have access to user chat history and must remember past interactions when responding.`;

export async function POST(request) {
  try {
    await connectToDatabase();

    // 1. Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Missing Authorization header. Please login.' }, { status: 401 });
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

    // 2. Parse Request
    const body = await request.json();
    const { contents, modelId = 'openrouter/auto', attachments = [], webSearch = false } = body;

    if (!contents || !Array.isArray(contents)) {
      return Response.json({ error: 'Invalid contents format' }, { status: 400 });
    }

    // Get the latest user message text
    const latestUserMessageText = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // 3. Persistent Memory: Load or Create Chat Document
    let chat = await Chat.findOne({ user: user._id });
    if (!chat) {
      chat = new Chat({ user: user._id, messages: [] });
    }

    // Save incoming user message to memory
    chat.messages.push({
      role: 'user',
      text: latestUserMessageText,
      attachments: attachments
    });
    await chat.save();

    // Reconstruct full chat history for the AI Context
    const fullHistory = chat.messages.map(msg => ({
      role: msg.role,
      text: msg.text
    }));

    // 4. Route to OpenRouter or Gemini
    if (user.openRouterKey && modelId !== 'google/gemini-fallback') {
      console.log(`Routing to OpenRouter with model: ${modelId}`);
      
      const openRouterMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...fullHistory.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text
        }))
      ];

      // Handle attachments if present for vision models (OpenRouter format)
      if (attachments && attachments.length > 0) {
        const lastMsg = openRouterMessages[openRouterMessages.length - 1];
        lastMsg.content = [
          { type: 'text', text: lastMsg.content },
          ...attachments.map(base64 => ({
            type: 'image_url',
            image_url: { url: base64 }
          }))
        ];
      }

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
            model: modelId,
            messages: openRouterMessages,
            ...(webSearch && { tools: [{ type: 'openrouter:web_search' }] })
          })
        });

        if (orResponse.ok) {
          const data = await orResponse.json();
          const textResponse = data.choices[0]?.message?.content || '';
          
          // Save AI Response to memory
          chat.messages.push({ role: 'model', text: textResponse });
          await chat.save();

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
          if (!user.geminiToken) {
            return Response.json({ error: errorData.error?.message || 'OpenRouter error' }, { status: orResponse.status });
          }
        }
      } catch (err) {
        console.error('OpenRouter Network Error:', err);
        if (!user.geminiToken) {
          return Response.json({ error: 'Network error reaching OpenRouter' }, { status: 500 });
        }
      }
    }

    // 5. Fallback or Gemini specific routing
    if (!user.geminiToken) {
      return Response.json({ error: 'OpenRouter failed and Gemini is not connected.' }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const geminiHistory = fullHistory.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    // Inject system prompt into Gemini (as first message)
    geminiHistory.unshift({
      role: 'user',
      parts: [{ text: `SYSTEM DIRECTIVE: ${SYSTEM_PROMPT}\n\nAcknowledge this and begin.` }]
    });
    geminiHistory.splice(1, 0, {
      role: 'model',
      parts: [{ text: 'Understood. I am Bug, CEO of Bug AI.' }]
    });

    const geminiModel = 'gemini-1.5-flash';

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          contents: geminiHistory,
          ...(webSearch && { tools: [{ googleSearch: {} }] })
        })
      }
    );

    if (geminiResponse.ok) {
      const data = await geminiResponse.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Save AI Response to memory
      chat.messages.push({ role: 'model', text: textResponse });
      await chat.save();

      return Response.json(data);
    } else {
      const errorData = await geminiResponse.json().catch(() => ({}));
      return Response.json(
        { error: errorData.error?.message || 'Gemini API Error' },
        { status: geminiResponse.status }
      );
    }

  } catch (error) {
    console.error('Chat API Error:', error);
    return Response.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
