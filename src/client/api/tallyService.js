import { getToken } from './authService';

const authHeaders = async () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${await getToken()}`,
});

// Transactions + all computed reports in one call.
export const getTally = async () => {
  const r = await fetch('/api/tally', { headers: await authHeaders(), cache: 'no-store' });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load Tally');
  return d; // { transactions, reports }
};

export const createTransaction = async (payload) => {
  const r = await fetch('/api/tally', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to add transaction');
  return d.transaction;
};

export const updateTransaction = async (id, updates) => {
  const r = await fetch(`/api/tally/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(updates) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to update transaction');
  return d.success;
};

export const deleteTransaction = async (id) => {
  const r = await fetch(`/api/tally/${id}`, { method: 'DELETE', headers: await authHeaders() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to delete transaction');
  return d.success;
};

export const getParties = async () => {
  const r = await fetch('/api/parties', { headers: await authHeaders(), cache: 'no-store' });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load parties');
  return d.parties;
};

export const createParty = async (payload) => {
  const r = await fetch('/api/parties', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to add party');
  return d.party;
};

export const updateParty = async (id, updates) => {
  const r = await fetch(`/api/parties/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(updates) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to update party');
  return d.success;
};

export const deleteParty = async (id) => {
  const r = await fetch(`/api/parties/${id}`, { method: 'DELETE', headers: await authHeaders() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to delete party');
  return d.success;
};
