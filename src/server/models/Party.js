import { firestore, toMillis } from '../lib/db';

// A customer (owes us) or supplier (we owe them). openingBalance is what they
// owe / we owe at the start; payments recorded in Transactions adjust it.
export const PARTY_TYPES = ['customer', 'supplier'];

const Party = {
  collection: firestore.collection('parties'),

  async find(query) {
    if (query.user) {
      const snapshot = await this.collection.where('user', '==', query.user).get();
      const docs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
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
    const party = {
      user: data.user,
      name: (data.name || '').trim(),
      type: PARTY_TYPES.includes(data.type) ? data.type : 'customer',
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      panNo: (data.panNo || '').toString().trim(),
      address: (data.address || '').toString().trim(),
      openingBalance: Number(data.openingBalance) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ref = await this.collection.add(party);
    return { _id: ref.id, ...party };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  },

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },
};

export default Party;
