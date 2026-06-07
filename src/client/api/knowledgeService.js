import { getToken } from './authService';

export const getKnowledge = async () => {
  const token = await getToken();
  const response = await fetch('/api/knowledge', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch knowledge');
  return data.entries;
};

export const createKnowledge = async (title, content) => {
  const token = await getToken();
  const response = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ title, content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create entry');
  return data.entry;
};

export const updateKnowledge = async (id, { title, content }) => {
  const token = await getToken();
  const response = await fetch(`/api/knowledge/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ title, content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update entry');
  return data.entry;
};

export const deleteKnowledge = async (id) => {
  const token = await getToken();
  const response = await fetch(`/api/knowledge/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete entry');
  return data.success;
};
