import { firestore } from '../lib/db';

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
      const snapshot = await this.collection
        .where('user', '==', query.user)
        .orderBy('updatedAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
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
