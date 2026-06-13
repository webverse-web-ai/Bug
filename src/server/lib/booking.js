import Party from '../models/Party';
import Transaction from '../models/Transaction';

// Find (or create) the Tally customer party that matches an order's customer,
// so orders and accounting share one source of truth for who owes what.
export async function ensureCustomerParty(userId, customer) {
  const name = (customer?.name || '').trim();
  if (!name) return { id: '', name: '' };
  const all = await Party.find({ user: userId });
  const match = all.find(p => p.type === 'customer' && p.name.toLowerCase() === name.toLowerCase());
  if (match) return { id: match._id, name: match.name };
  const created = await Party.create({
    user: userId, name, type: 'customer',
    email: customer.email || '', phone: customer.phone || '', openingBalance: 0,
  });
  return { id: created._id, name: created.name };
}

// Booking a sale raises the customer's receivable (what they still owe us).
export async function recordSale(userId, partyId, dealAmount) {
  if (!partyId || !(Number(dealAmount) > 0)) return;
  const p = await Party.findOne({ _id: partyId, user: userId });
  if (!p) return;
  await Party.update(partyId, { openingBalance: (Number(p.openingBalance) || 0) + Number(dealAmount) });
}

// Booking a received payment posts Tally income (Sales) linked to the customer,
// so the cash shows up in the daybook, cash flow, P&L and reduces the receivable.
export async function bookIncome(userId, { amount, partyId, partyName, description, account = 'Bank' }) {
  if (!(Number(amount) > 0)) return;
  await Transaction.create({
    user: userId, type: 'in', amount: Number(amount), category: 'Sales', account, method: 'Bank Transfer',
    partyId: partyId || '', partyName: partyName || '', partyType: partyId ? 'customer' : '',
    description: description || 'Order payment', date: new Date(),
  });
}
