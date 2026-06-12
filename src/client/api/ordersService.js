import { getToken } from './authService';

const authHeaders = async () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${await getToken()}`,
});

// List orders (+ KPI stats), optionally filtered by status/search query.
export const getOrders = async ({ status, q } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  const response = await fetch(`/api/orders${qs ? `?${qs}` : ''}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to fetch orders');
  return data; // { orders, stats }
};

export const createOrder = async (payload) => {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to create order');
  return data.order;
};

export const updateOrder = async (id, updates) => {
  const response = await fetch(`/api/orders/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to update order');
  return data.order;
};

export const deleteOrder = async (id) => {
  const response = await fetch(`/api/orders/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete order');
  return data.success;
};
