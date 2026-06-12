import { firestore, toMillis } from '../lib/db';

const Knowledge = {
  collection: firestore.collection('knowledge'),

  // List all knowledge entries owned by a user, newest first.
  async find(query) {
    if (query.user) {
      // No .orderBy() — sorting in memory avoids a required composite index.
      const snapshot = await this.collection.where('user', '==', query.user).get();
      const docs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
      docs.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
      return docs;
    }
    return [];
  },

  // Fetch a single entry, scoped to its owner.
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
    const entry = {
      user: data.user,
      title: data.title || '',
      content: data.content || '',
      source: data.source || 'manual', // 'manual' | 'ai'
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await this.collection.add(entry);
    return { _id: docRef.id, ...entry };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  },

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },
};

export default Knowledge;
