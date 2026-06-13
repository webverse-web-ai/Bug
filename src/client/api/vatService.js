import { getToken } from './authService';

const authHeaders = async () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${await getToken()}`,
});

// VAT register entries + computed return summary in one call.
export const getVat = async () => {
  const r = await fetch('/api/vat', { headers: await authHeaders(), cache: 'no-store' });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to load VAT register');
  return d; // { entries, summary }
};

export const createVatEntry = async (payload) => {
  const r = await fetch('/api/vat', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to add VAT entry');
  return d.entry;
};

export const updateVatEntry = async (id, updates) => {
  const r = await fetch(`/api/vat/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(updates) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to update VAT entry');
  return d.success;
};

export const deleteVatEntry = async (id) => {
  const r = await fetch(`/api/vat/${id}`, { method: 'DELETE', headers: await authHeaders() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to delete VAT entry');
  return d.success;
};
