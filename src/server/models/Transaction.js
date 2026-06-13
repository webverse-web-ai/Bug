import { firestore, toMillis } from '../lib/db';

// A single accounting entry in Tally's daybook (single-entry cashbook style).
export const TXN_TYPES = ['in', 'out']; // money in (income) | money out (expense)
export const TXN_ACCOUNTS = ['Cash', 'Bank'];
export const TXN_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'];

// Category → accounting group. Drives P&L and the balance sheet.
//   income/expense → Profit & Loss · capital/asset/liability → Balance Sheet only
export const CATEGORY_GROUPS = {
  // income (money in)
  Sales: 'income', Service: 'income', Interest: 'income', 'Other Income': 'income',
  Capital: 'capital', Loan: 'liability',
  // expense (money out)
  Purchase: 'expense', Salaries: 'expense', Rent: 'expense', Utilities: 'expense',
  Marketing: 'expense', Infrastructure: 'expense', Software: 'expense', Equipment: 'asset',
  Tax: 'expense', Logistics: 'expense', 'Other Expense': 'expense', Drawings: 'capital',
};
export const INCOME_CATEGORIES = Object.keys(CATEGORY_GROUPS).filter(k => CATEGORY_GROUPS[k] === 'income').concat(['Capital', 'Loan']);
export const EXPENSE_CATEGORIES = Object.keys(CATEGORY_GROUPS).filter(k => CATEGORY_GROUPS[k] === 'expense').concat(['Equipment', 'Drawings']);

const Transaction = {
  collection: firestore.collection('transactions'),

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
    const txn = {
      user: data.user,
      type: TXN_TYPES.includes(data.type) ? data.type : 'out',
      amount: Math.max(0, Number(data.amount) || 0),
      category: data.category || (data.type === 'in' ? 'Sales' : 'Other Expense'),
      account: TXN_ACCOUNTS.includes(data.account) ? data.account : 'Cash',
      method: TXN_METHODS.includes(data.method) ? data.method : 'Cash',
      partyId: data.partyId || '',
      partyName: data.partyName || '',
      partyType: data.partyType || '', // 'customer' | 'supplier' | ''
      description: data.description || '',
      date: data.date ? new Date(data.date) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ref = await this.collection.add(txn);
    return { _id: ref.id, ...txn };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    if (data.date) data.date = new Date(data.date);
    await this.collection.doc(id).update(data);
  },

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },
};

export default Transaction;
