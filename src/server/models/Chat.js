import { firestore, toMillis } from '../lib/db';

const Chat = {
  collection: firestore.collection('chats'),

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

  async findByIdAndDelete(id) {
    await this.collection.doc(id).delete();
  },

  async create(data) {
    const chatData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await this.collection.add(chatData);
    return { _id: docRef.id, ...chatData };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  }
};

export default Chat;
