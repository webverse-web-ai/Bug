import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Chat from '@/server/models/Chat';
import Knowledge from '@/server/models/Knowledge';
import { BUG_MODEL_ID, isBugId } from '@/server/lib/bugModel';
import { isGeminiId, geminiApiModel } from '@/server/lib/geminiModels';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Known broadly-available free models, used as a safety net when a user-selected
// model can't serve a request (data-policy 404s, rate limits, transient downtime).
const FALLBACK_MODELS = [
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/auto',
];

// Single OpenRouter chat call. Returns a normalized result so callers can decide
// whether to retry with a different model.
async function callOpenRouter({ key, model, messages, webSearch, timeout = 28000 }) {
  // Never let one slow/hung provider block the whole request.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bugai.com',
        'X-Title': 'Bug AI',
      },
      body: JSON.stringify({
        model,
        messages,
        // OpenRouter performs real web search via the "web" plugin (not a tool).
        ...(webSearch && { plugins: [{ id: 'web', max_results: 5 }] }),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, status: 200, text: data.choices?.[0]?.message?.content || '' };
    }
    const errorData = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, errorMessage: errorData.error?.message || `OpenRouter responded ${res.status}` };
  } catch (e) {
    // Timeout → treat as transient (504) so it can be retried / fail over.
    return { ok: false, status: e.name === 'AbortError' ? 504 : 0, errorMessage: e.name === 'AbortError' ? 'Model timed out' : 'Network error reaching OpenRouter' };
  } finally {
    clearTimeout(timer);
  }
}

// Free providers often return transient 429/502/503s. Retry the same model a
// couple of times with a short backoff before giving up on it.
const TRANSIENT = new Set([429, 502, 503, 504, 524]);
async function callOpenRouterResilient(args, attempts = 3) {
  let last = { ok: false, status: 0, errorMessage: 'No response' };
  for (let i = 0; i < attempts; i++) {
    last = await callOpenRouter(args);
    if (last.ok && last.text) return last;
    if (!TRANSIENT.has(last.status)) return last; // hard error — don't retry
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return last;
}

// ─── Bug model ───────────────────────────────────────────────────────────────
// Reliable free models the Bug model draws on when the user hasn't curated any.
const BUG_POOL_DEFAULT = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
  'nex-agi/nex-n2-pro:free',
];
const JUDGE_MODEL = 'openai/gpt-oss-120b:free';

// Try candidates in order; return the first one that actually answers.
// attempts=1 (fast) fails over instantly; higher values retry each model.
async function firstWorking({ key, candidates, messages, webSearch, attempts = 2 }) {
  const list = candidates.filter((m, i, a) => m && a.indexOf(m) === i);
  let error = 'No response';
  let authBlocked = false;
  for (const model of list) {
    let r;
    try {
      r = await callOpenRouterResilient({ key, model, messages, webSearch }, attempts);
    } catch {
      error = 'Network error reaching OpenRouter';
      continue;
    }
    if (r.ok && r.text) return { ok: true, text: r.text, usedModel: model };
    error = r.errorMessage;
    // Auth/billing failures won't be fixed by another model — stop retrying.
    if (r.status === 401 || r.status === 402 || r.status === 403) { authBlocked = true; break; }
  }
  return { ok: false, error, authBlocked };
}

// Fast mode: race the top candidates and return whoever answers FIRST. Falls
// back to the rest sequentially if the leaders all fail.
async function raceFirst({ key, candidates, messages, webSearch }) {
  const list = candidates.filter((m, i, a) => m && a.indexOf(m) === i);
  const head = list.slice(0, 3);
  const tail = list.slice(3);
  try {
    return await Promise.any(
      head.map(async (model) => {
        const r = await callOpenRouter({ key, model, messages, webSearch, timeout: 20000 });
        if (r.ok && r.text) return { ok: true, text: r.text, usedModel: model };
        throw new Error(r.errorMessage || 'failed');
      })
    );
  } catch {
    // Both leaders failed — try the remaining models one by one.
    return await firstWorking({ key, candidates: tail.length ? tail : head, messages, webSearch, attempts: 1 });
  }
}

// Thinking mode: synthesize the single best answer from several candidates.
async function judgeBest({ key, question, answers }) {
  const list = answers
    .map((a, i) => `--- Candidate ${i + 1} (${a.model}) ---\n${a.text}`)
    .join('\n\n');
  const prompt = `You are an expert answer synthesizer. The user asked:\n"""${question}"""\n\nHere are ${answers.length} candidate answers from different AI models:\n\n${list}\n\nWrite the single best possible answer: merge the strongest and most correct points, fix any mistakes, and keep it clear and well-formatted with Markdown. Output ONLY the final answer — no commentary about the candidates.`;
  const r = await callOpenRouterResilient({ key, model: JUDGE_MODEL, messages: [{ role: 'user', content: prompt }] }, 2);
  if (r.ok && r.text) return { ok: true, text: r.text, usedModel: 'bug/thinking' };
  // Judge failed — fall back to the most substantial candidate.
  const best = answers.slice().sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))[0];
  return { ok: true, text: best.text, usedModel: best.model };
}

// The Bug model. Fast = quickest good answer; Thinking = best of several models.
async function runBugModel({ key, messages, webSearch, mode, pool, question }) {
  const candidates = (pool && pool.length ? pool : BUG_POOL_DEFAULT).filter((m, i, a) => a.indexOf(m) === i);

  if (mode === 'thinking') {
    // Query several models in parallel (single attempt each — redundancy covers
    // a 429), then synthesize the best answer from whoever responded.
    const chosen = candidates.slice(0, 3);
    const results = await Promise.all(
      chosen.map((model) =>
        callOpenRouter({ key, model, messages, webSearch, timeout: 22000 })
          .then((r) => ({ model, ok: r.ok, text: r.text }))
          .catch(() => ({ model, ok: false }))
      )
    );
    const good = results.filter((r) => r.ok && r.text);
    if (good.length === 0) return await firstWorking({ key, candidates, messages, webSearch });
    if (good.length === 1) return { ok: true, text: good[0].text, usedModel: good[0].model };
    return await judgeBest({ key, question, answers: good });
  }

  // Fast mode: race the leaders, take the first to answer.
  return await raceFirst({ key, candidates, messages, webSearch });
}

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

// Normalize text for cheap duplicate detection.
function normalizeFact(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Best-effort parse of a JSON array of {title, content} from model output.
function parseFacts(raw) {
  if (!raw) return [];
  let text = raw.trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr.filter(f => f && f.content);
  } catch {
    /* not valid JSON */
  }
  return [];
}

// Self-learning: extract durable facts about the user from their message and
// save any that aren't already known (tagged source: 'ai'). Fire-and-forget.
async function learnFromMessage(user, userText, modelId) {
  if (!userText || userText.trim().length < 4) return;

  const prompt = `From the user's message, extract durable, long-term facts about the USER that are worth remembering across future conversations — for example their name, username, location, job/role, and stable preferences. Ignore questions, requests, opinions about others, and small talk. Return ONLY a compact JSON array like [{"title":"Name","content":"The user's name is Devaman"}]. Return [] if there is nothing durable to remember.\n\nUser message: """${userText}"""`;

  let raw = '';
  try {
    if (user.openRouterKey) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bugai.com',
          'X-Title': 'Bug AI',
        },
        body: JSON.stringify({
          model: modelId && !isBugId(modelId) && modelId !== 'google/gemini-fallback' ? modelId : 'openai/gpt-oss-120b:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        }),
      });
      if (res.ok) { const d = await res.json(); raw = d.choices?.[0]?.message?.content || ''; }
    } else if (user.geminiToken) {
      const apiKey = process.env.GEMINI_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        }
      );
      if (res.ok) { const d = await res.json(); raw = d.candidates?.[0]?.content?.parts?.[0]?.text || ''; }
    }
  } catch (e) {
    console.error('Auto-learn model call failed:', e);
    return;
  }

  const facts = parseFacts(raw);
  if (!facts.length) return;

  const existing = await Knowledge.find({ user: user._id });
  const seen = existing.map(e => normalizeFact(e.content)).filter(Boolean);

  for (const f of facts.slice(0, 5)) {
    const content = (f.content || '').toString().trim();
    if (!content) continue;
    const norm = normalizeFact(content);
    if (!norm) continue;
    // Skip near-duplicates of anything already stored or added this run.
    const dup = seen.some(e => e === norm || e.includes(norm) || norm.includes(e));
    if (dup) continue;
    seen.push(norm);
    await Knowledge.create({
      user: user._id,
      title: (f.title || '').toString().trim(),
      content,
      source: 'ai',
    });
  }
}

// Track per-model request usage for the day (powers the System Metrics page).
async function incrementUsage(userId, modelId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const u = await User.findById(userId);
    if (!u) return;
    const counts = u.usageDate === today && u.usageCounts ? { ...u.usageCounts } : {};
    counts[modelId] = (counts[modelId] || 0) + 1;
    await User.update(userId, { usageDate: today, usageCounts: counts });
  } catch (e) {
    console.error('Usage increment failed:', e);
  }
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
    const { contents, modelId = 'openrouter/auto', attachments = [], webSearch = false, sessionId, mode = 'fast' } = body;

    if (!contents || !Array.isArray(contents)) {
      return Response.json({ error: 'Invalid contents format' }, { status: 400 });
    }

    // Web-search guard: keep the model honest about whether it actually has internet access.
    const webSearchClause = webSearch
      ? ' WEB SEARCH IS ON: You have live internet access for this message. Use the search results to answer with current information, and you may mention that you searched the web when relevant.'
      : ' WEB SEARCH IS OFF: You do NOT have internet access for this message. Answer ONLY from your existing training knowledge. NEVER claim, state, or imply that you searched, browsed, looked up, or accessed the internet or any live/real-time source. If the user needs current or real-time information, tell them to enable web search using the globe icon.';

    // Self-learning context: inject the user's saved knowledge base so the AI
    // "remembers" persistent facts across all chats.
    let knowledgeClause = '';
    try {
      const entries = await Knowledge.find({ user: user._id });
      if (entries.length > 0) {
        const lines = entries
          .slice(0, 40)
          .map(k => `- ${k.title ? `${k.title}: ` : ''}${k.content}`)
          .join('\n');
        knowledgeClause = `\n\nKNOWLEDGE BASE — persistent facts you have learned about this user or their work. Treat these as true and use them when relevant:\n${lines}`;
      }
    } catch (e) {
      console.error('Failed to load knowledge base:', e);
    }

    // Response-mode steer: Fast favors a quick, terse reply; Thinking allows a
    // deeper, longer, more thorough answer (overriding the default brevity rule).
    const modeClause = mode === 'thinking'
      ? '\n\nRESPONSE MODE — THINKING: Prioritize accuracy and depth. Reason carefully and give the most correct, complete answer. You MAY exceed the usual brevity limit and use rich Markdown formatting when it genuinely improves the answer.'
      : '\n\nRESPONSE MODE — FAST: Prioritize speed. Give the most direct, concise answer possible.';

    const systemPrompt = SYSTEM_PROMPT + webSearchClause + knowledgeClause + modeClause;

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

    // Self-learning (fire-and-forget): capture durable facts about the user in
    // the background so it never adds latency to the chat response.
    learnFromMessage(user, latestUserMessageText, modelId).catch(err => console.error('Auto-learn failed:', err));

    // Generate the chat title IN PARALLEL with the main answer (new chats only),
    // so the second model call overlaps the response instead of adding latency.
    const titlePromise = isNewChat
      ? generateChatTitle(latestUserMessageText, user, JUDGE_MODEL).catch(() => fallbackTitle(latestUserMessageText))
      : null;

    // Reconstruct full chat history for the AI Context
    const fullHistory = chat.messages.map(msg => ({
      role: msg.role,
      text: msg.text
    }));

    // Persist the assistant reply (+ auto-title on first turn) and count usage.
    // usageModelId is what the picker tracks (the Bug id when Bug answered);
    // virtual bug/* ids are never used for the title-generation API call.
    const finishChat = async (textResponse, usageModelId) => {
      chat.messages.push({ role: 'model', text: textResponse });
      if (isNewChat) {
        // Title was generated in parallel above — already resolved by now.
        chat.title = titlePromise ? await titlePromise : fallbackTitle(latestUserMessageText);
        await Chat.update(chat._id, { messages: chat.messages, title: chat.title });
        isNewChat = false;
      } else {
        await Chat.update(chat._id, { messages: chat.messages });
      }
      incrementUsage(user._id, usageModelId).catch(err => console.error('Usage increment failed:', err));
      return { sessionId: chat._id.toString(), title: chat.title };
    };

    // 4. Route to OpenRouter (Bug meta-model or resilient single model) or Gemini.
    // A `gemini/*` pick is explicit Gemini — skip OpenRouter entirely so the
    // user's chosen Gemini model actually answers.
    if (user.openRouterKey && !isGeminiId(modelId) && modelId !== 'google/gemini-fallback') {
      const openRouterMessages = [
        { role: 'system', content: systemPrompt },
        ...fullHistory.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text
        }))
      ];

      // Vision attachments (OpenRouter format) attach to the latest message.
      if (attachments && attachments.length > 0) {
        const lastMsg = openRouterMessages[openRouterMessages.length - 1];
        lastMsg.content = [
          { type: 'text', text: lastMsg.content },
          ...attachments.map(base64 => ({ type: 'image_url', image_url: { url: base64 } }))
        ];
      }

      const isBug = isBugId(modelId);
      let outcome;
      if (isBug) {
        // Bug draws on the user's curated working models (minus Bug itself).
        const pool = (user.selectedModels || []).map(m => m.id).filter(id => id && !isBugId(id) && !isGeminiId(id));
        outcome = await runBugModel({
          key: user.openRouterKey, messages: openRouterMessages, webSearch,
          mode, pool, question: latestUserMessageText,
        });
      } else {
        // Specific model: try the pick first, then known-good free models. This
        // turns an unavailable model from a hard error into a seamless answer.
        outcome = await firstWorking({
          key: user.openRouterKey, candidates: [modelId, ...FALLBACK_MODELS],
          messages: openRouterMessages, webSearch,
        });
      }

      if (outcome.ok && outcome.text) {
        // Transparency note only when a specific (non-Bug) pick had to fall back.
        const switched = !isBug && outcome.usedModel !== modelId
          ? `\n\n> ⚠️ *Your selected model was unavailable, so I answered with \`${outcome.usedModel.replace(':free', '')}\`.*`
          : '';
        const text = outcome.text + switched;
        const saved = await finishChat(text, isBug ? BUG_MODEL_ID : outcome.usedModel);
        return Response.json({
          candidates: [{ content: { parts: [{ text }], role: 'model' } }],
          sessionId: saved.sessionId,
          title: saved.title,
        });
      }

      // Every OpenRouter attempt failed. Use Gemini if connected, else return a
      // clear, friendly message instead of a raw error string.
      if (!user.geminiToken) {
        const msg = outcome.authBlocked
          ? `OpenRouter rejected your key: ${outcome.error}. Check it in Setup.`
          : `All available models are busy or unavailable right now (${outcome.error}). Please try again in a moment.`;
        return Response.json({ error: msg }, { status: 502 });
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

    // Honour an explicitly-selected Gemini model; otherwise use a fast default.
    const geminiModel = isGeminiId(modelId) ? geminiApiModel(modelId) : 'gemini-1.5-flash';
    const geminiUsageId = isGeminiId(modelId) ? modelId : `google/${geminiModel}`;

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
        chat.title = titlePromise ? await titlePromise : fallbackTitle(latestUserMessageText);
        await Chat.update(chat._id, { messages: chat.messages, title: chat.title });
        isNewChat = false;
      } else {
        await Chat.update(chat._id, { messages: chat.messages });
      }

      incrementUsage(user._id, geminiUsageId).catch(err => console.error('Usage increment failed:', err));
      data.sessionId = chat._id.toString();
      data.title = chat.title;
      return Response.json(data);
    } else {
      const errorData = await geminiResponse.json().catch(() => ({}));
      const reason = errorData.error?.message || `Gemini responded ${geminiResponse.status}`;
      console.error('Gemini API failed:', reason);

      // Surface the actual cause so the user can act on it (bad/leaked key,
      // model not available, quota, etc.) instead of a vague "brain" message.
      const low = reason.toLowerCase();
      let fallbackText;
      if (low.includes('leaked') || low.includes('api key not valid') || low.includes('api_key_invalid') || geminiResponse.status === 403 || geminiResponse.status === 400) {
        fallbackText = `⚠️ Gemini rejected the request: ${reason}\n\nThe server's Google Gemini API key looks invalid or disabled. Set a fresh \`GEMINI_API_KEY\` (from Google AI Studio) and restart the server, or use an OpenRouter model in the meantime.`;
      } else if (geminiResponse.status === 404) {
        fallbackText = `⚠️ Gemini couldn't find the model \`${geminiModel}\`. Pick a different Gemini model — this one isn't available to your key.`;
      } else {
        fallbackText = `⚠️ Gemini couldn't respond right now: ${reason}\n\nYour message was saved — please try again or switch models.`;
      }
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
