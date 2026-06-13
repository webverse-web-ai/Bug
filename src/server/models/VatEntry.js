import { firestore, toMillis } from '../lib/db';

// A single line in the VAT register (बिक्री/खरिद खाता).
//   sales    → output VAT collected on a sales invoice
//   purchase → input VAT paid on a purchase bill
// VAT in Nepal is 13% by default; the rate is stored per-entry so 0%/exempt
// lines (rate 0) are also supported.
export const VAT_TYPES = ['sales', 'purchase'];
export const VAT_DEFAULT_RATE = 13;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Normalize bill line items: [{ description, qty, rate, amount }]
function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map(it => {
    const qty = Math.max(0, Number(it.qty) || 0);
    const rate = Math.max(0, Number(it.rate) || 0);
    return {
      description: (it.description || '').toString().slice(0, 200),
      qty, rate,
      amount: round2(it.amount !== undefined ? it.amount : qty * rate),
    };
  });
}

// Derive vat + total from taxable + rate so the stored figures always agree.
export function computeVat(taxable, rate) {
  const t = Math.max(0, Number(taxable) || 0);
  const r = Math.max(0, Number(rate) || 0);
  const vat = round2((t * r) / 100);
  return { taxable: round2(t), vat, total: round2(t + vat) };
}

const VatEntry = {
  collection: firestore.collection('vat_entries'),

  async find(query) {
    if (query.user) {
      const snapshot = await this.collection.where('user', '==', query.user).get();
      const docs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      docs.sort((a, b) => toMillis(b.date) - toMillis(a.date) || toMillis(b.createdAt) - toMillis(a.createdAt));
      return docs;
    }
    return [];
  },

  async findOne(query) {
    if (query._id && query.user) {
      const doc = await this.collection.doc(query._id).get();
      if (!doc.exists) return null;
      const data = doc.data();
      if (data.user !== query.user) return null;
      return { _id: doc.id, ...data };
    }
    return null;
  },

  async create(data) {
    const rate = data.vatRate !== undefined ? Number(data.vatRate) : VAT_DEFAULT_RATE;
    const { taxable, vat, total } = computeVat(data.taxable, rate);
    const entry = {
      user: data.user,
      type: VAT_TYPES.includes(data.type) ? data.type : 'sales',
      billNo: (data.billNo || '').toString().trim(),
      partyName: (data.partyName || '').toString().trim(),
      partyPan: (data.partyPan || '').toString().trim(),
      address: (data.address || '').toString().trim(),
      taxable,
      vatRate: Math.max(0, rate),
      vat,
      total,
      // Optional line items when the entry was created by the bill generator.
      items: sanitizeItems(data.items),
      source: data.source === 'bill' ? 'bill' : 'manual',
      description: data.description || '',
      date: data.date ? new Date(data.date) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ref = await this.collection.add(entry);
    return { _id: ref.id, ...entry };
  },

  async update(id, data) {
    const updates = { ...data, updatedAt: new Date() };
    if (updates.date) updates.date = new Date(updates.date);
    // Recompute money fields whenever taxable or rate change.
    if (data.taxable !== undefined || data.vatRate !== undefined) {
      const cur = await this.collection.doc(id).get();
      const prev = cur.exists ? cur.data() : {};
      const taxable = data.taxable !== undefined ? data.taxable : prev.taxable;
      const rate = data.vatRate !== undefined ? data.vatRate : (prev.vatRate ?? VAT_DEFAULT_RATE);
      const c = computeVat(taxable, rate);
      updates.taxable = c.taxable; updates.vat = c.vat; updates.total = c.total;
      updates.vatRate = Math.max(0, Number(rate) || 0);
    }
    await this.collection.doc(id).update(updates);
  },

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },
};

export default VatEntry;
