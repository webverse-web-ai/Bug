import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Chat from '@/server/models/Chat';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

const SYSTEM_PROMPT = `You are Bug, the friendly, brilliant, and visionary CEO of Bug AI. You communicate with the intelligence of Hermes AI or OpenClaw, but you must be extremely concise, highly human-like, and warm. CRITICAL RULES: 1. You MUST give extremely short answers (1 or 2 sentences MAX) no matter what model is being used, UNLESS the user explicitly asks for a long format or you receive permission. 2. If a longer response is required, you MUST ask the user for permission first. 3. When you DO generate a longer response, you MUST use rich Markdown formatting (Headings, subheadings, paragraphs, bulleted lists, and quotes) where necessary to make it highly readable. 4. Be super friendly and conversational. 5. Always use emojis naturally in your responses. You have access to user chat history and must remember past interactions when responding.`;

// Sanitize an AI-generated title: strip quotes/markdown, drop trailing punctuation, cap length.
function cleanTitle(raw) {
  let t = (raw || '').replace(/["'`*#\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/[.!?,;:]+$/, '').trim();
  if (t.length > 48) t = t.slice(0, 48).trim() + '…';
  return t;
}

// Instant, free fallback: first few words of the user's message.
function fallbackTitle(userText) {
  const cleaned = (userText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  const words = cleaned.split(' ').slice(0, 6).join(' ');
  return words.length > 48 ? words.slice(0, 48).trim() + '…' : words;
}

// Generate a short conversation title from the first user message. Falls back gracefully.
async function generateChatTitle(userText, user, modelId) {
  const prompt = `Generate a very short, concise title (3 to 5 words maximum) summarizing the topic of this message. Respond with ONLY the title text — no quotes, no punctuation, no prefixes.\n\nMessage: ${userText}`;

  try {
    if (user.openRouterKey) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bugai.com',
          'X-Title': 'Bug AI'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 20
        })
      });
      if (res.ok) {
        const data = await res.json();
        const t = cleanTitle(data.choices?.[0]?.message?.content);
        if (t) return t;
      }
    } else if (user.geminiToken) {
      const apiKey = process.env.GEMINI_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/antigravity-preview-05-2026:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const t = cleanTitle(data.candidates?.[0]?.content?.parts?.[0]?.text);
        if (t) return t;
      }
    }
  } catch (err) {
    console.error('Title generation failed, using fallback:', err);
  }

  return fallbackTitle(userText);
}

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
    const { contents, modelId = 'openrouter/auto', attachments = [], webSearch = false, sessionId } = body;

    if (!contents || !Array.isArray(contents)) {
      return Response.json({ error: 'Invalid contents format' }, { status: 400 });
    }

    // Web-search guard: keep the model honest about whether it actually has internet access.
    const webSearchClause = webSearch
      ? ' WEB SEARCH IS ON: You have live internet access for this message. Use the search results to answer with current information, and you may mention that you searched the web when relevant.'
      : ' WEB SEARCH IS OFF: You do NOT have internet access for this message. Answer ONLY from your existing training knowledge. NEVER claim, state, or imply that you searched, browsed, looked up, or accessed the internet or any live/real-time source. If the user needs current or real-time information, tell them to enable web search using the globe icon.';
    const systemPrompt = SYSTEM_PROMPT + webSearchClause;

    // Get the latest user message text
    const latestUserMessageText = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // 3. Persistent Memory: Load or Create Chat Document
    let chat;
    let isNewChat = false;
    if (sessionId) {
      chat = await Chat.findOne({ _id: sessionId, user: user._id });
      if (!chat) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
    } else {
      chat = { user: user._id, title: 'New Chat', messages: [] };
      isNewChat = true;
    }

    // Save incoming user message to memory
    chat.messages.push({
      role: 'user',
      text: latestUserMessageText,
      attachments: attachments
    });
    
    if (isNewChat) {
      chat = await Chat.create(chat);
    } else {
      await Chat.update(chat._id, { messages: chat.messages });
    }

    // Reconstruct full chat history for the AI Context
    const fullHistory = chat.messages.map(msg => ({
      role: msg.role,
      text: msg.text
    }));

    // 4. Route to OpenRouter or Gemini
    if (user.openRouterKey && modelId !== 'google/gemini-fallback') {
      console.log(`Routing to OpenRouter with model: ${modelId}`);
      
      const openRouterMessages = [
        { role: 'system', content: systemPrompt },
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
            // OpenRouter performs real web search via the "web" plugin (not a tool).
            ...(webSearch && { plugins: [{ id: 'web', max_results: 5 }] })
          })
        });

        if (orResponse.ok) {
          const data = await orResponse.json();
          const textResponse = data.choices?.[0]?.message?.content
            || "⚠️ The model returned an empty response. Please try again or switch models.";

          // Save AI Response to memory
          chat.messages.push({ role: 'model', text: textResponse });
          if (isNewChat) {
            chat.title = await generateChatTitle(latestUserMessageText, user, modelId);
            await Chat.update(chat._id, { messages: chat.messages, title: chat.title });
            isNewChat = false;
          } else {
            await Chat.update(chat._id, { messages: chat.messages });
          }

          return Response.json({
            candidates: [
              {
                content: {
                  parts: [{ text: textResponse }],
                  role: 'model'
                }
              }
            ],
            sessionId: chat._id.toString(),
            title: chat.title
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
      parts: [{ text: `SYSTEM DIRECTIVE: ${systemPrompt}\n\nAcknowledge this and begin.` }]
    });
    geminiHistory.splice(1, 0, {
      role: 'model',
      parts: [{ text: 'Understood. I am Bug, CEO of Bug AI.' }]
    });

    const geminiModel = 'antigravity-preview-05-2026';

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
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
        || "⚠️ The model returned an empty response. Please try again or switch models.";

      // Save AI Response to memory
      chat.messages.push({ role: 'model', text: textResponse });
      if (isNewChat) {
        chat.title = await generateChatTitle(latestUserMessageText, user, modelId);
        await Chat.update(chat._id, { messages: chat.messages, title: chat.title });
        isNewChat = false;
      } else {
        await Chat.update(chat._id, { messages: chat.messages });
      }

      data.sessionId = chat._id.toString();
      data.title = chat.title;
      return Response.json(data);
    } else {
      const errorData = await geminiResponse.json().catch(() => ({}));
      console.error('Gemini API failed:', errorData.error?.message);
      
      const fallbackText = "⚠️ I'm having trouble connecting to my AI brain right now, but your message was saved!";
      chat.messages.push({ role: 'model', text: fallbackText });
      
      if (isNewChat) {
        chat.title = fallbackTitle(latestUserMessageText);
        await Chat.update(chat._id, { messages: chat.messages, title: chat.title });
        isNewChat = false;
      } else {
        await Chat.update(chat._id, { messages: chat.messages });
      }

      return Response.json({
        candidates: [{ content: { parts: [{ text: fallbackText }], role: 'model' } }],
        sessionId: chat._id.toString(),
        title: chat.title || 'New Chat',
        error: errorData.error?.message || 'Gemini API Error'
      }, { status: 200 }); // Return 200 so the UI can show the fallback message
    }

  } catch (error) {
    console.error('Chat API Error:', error);
    return Response.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
