import { firestore, toMillis } from '../lib/db';

// Order lifecycle managed by Pulse (the operational-manager subagent).
export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const ORDER_PRIORITIES = ['low', 'normal', 'high'];
export const ORDER_CHANNELS = ['Direct Web', 'Mobile App', 'API Integration', 'Phone', 'In-Store'];

const Order = {
  collection: firestore.collection('orders'),

  // List all orders owned by a user, newest first (in-memory sort = no index).
  async find(query) {
    if (query.user) {
      const snapshot = await this.collection.where('user', '==', query.user).get();
      const docs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      return docs;
    }
    return [];
  },

  // Fetch a single order, scoped to its owner.
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

  // Per-user incrementing order number (PLS-0001). Padded for sortable display.
  async nextOrderNumber(userId) {
    const snapshot = await this.collection.where('user', '==', userId).get();
    const seq = snapshot.size + 1;
    return `PLS-${String(seq).padStart(4, '0')}`;
  },

  async create(data) {
    const order = {
      user: data.user,
      orderNumber: data.orderNumber,
      customer: {
        name: data.customer?.name || '',
        email: data.customer?.email || '',
        phone: data.customer?.phone || '',
      },
      items: Array.isArray(data.items) ? data.items : [],
      total: Number(data.total) || 0,
      dealAmount: Number(data.dealAmount) || Number(data.total) || 0, // headline deal value
      amountPaid: Math.max(0, Number(data.amountPaid) || 0),          // received so far (incl. advance)
      status: ORDER_STATUSES.includes(data.status) ? data.status : 'pending',
      priority: ORDER_PRIORITIES.includes(data.priority) ? data.priority : 'normal',
      channel: ORDER_CHANNELS.includes(data.channel) ? data.channel : 'Direct Web',
      partyId: data.partyId || '',  // linked Tally customer
      notes: data.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await this.collection.add(order);
    return { _id: docRef.id, ...order };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  },

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },
};

export default Order;
