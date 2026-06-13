// Selectable Google Gemini chat models. Unlike OpenRouter models (fetched live),
// Gemini models are a fixed, curated list. Ids are prefixed `gemini/` so the
// chat route can tell them apart from OpenRouter ids and route to the Gemini API.
// The actual API model name is whatever follows the prefix.
export const GEMINI_MODELS = [
  { id: 'gemini/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini/gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
];

export const isGeminiId = (id) => typeof id === 'string' && id.startsWith('gemini/');

// 'gemini/gemini-2.5-flash' → 'gemini-2.5-flash' (the name the Gemini API expects).
export const geminiApiModel = (id) => (isGeminiId(id) ? id.slice('gemini/'.length) : id);
