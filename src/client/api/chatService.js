import { getToken } from './authService';

export const getSessions = async () => {
  const token = await getToken();
  const response = await fetch('/api/chat/sessions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch sessions');
  return data.sessions;
};

export const renameSession = async (id, title) => {
  const token = await getToken();
  const response = await fetch(`/api/chat/session/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to rename session');
  return data.session;
};

export const deleteSession = async (id) => {
  const token = await getToken();
  const response = await fetch(`/api/chat/session/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete session');
  return data.success;
};
