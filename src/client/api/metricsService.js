import { getToken } from './authService';

const authHeaders = async () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${await getToken()}`,
});

// All free OpenRouter models.
export const getFreeModels = async () => {
  const response = await fetch('/api/models', { headers: await authHeaders(), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch models');
  return data.models;
};

// Google Gemini chat models (empty unless the user has Gemini connected).
export const getGeminiModels = async () => {
  const response = await fetch('/api/gemini-models', { headers: await authHeaders(), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch Gemini models');
  return data; // { connected, models }
};

// The user's selected chat models.
export const getSelectedModels = async () => {
  const response = await fetch('/api/user/models', { headers: await authHeaders(), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch selected models');
  return data.models;
};

export const saveSelectedModels = async (models) => {
  const response = await fetch('/api/user/models', {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ models }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to save selected models');
  return data.models;
};

// Today's per-model usage + reset time.
export const getUsage = async () => {
  const response = await fetch('/api/usage', { headers: await authHeaders(), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch usage');
  return data; // { counts, limit, resetAt, date }
};
