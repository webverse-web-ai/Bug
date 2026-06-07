import { firestore } from '../lib/db';
import bcrypt from 'bcryptjs';

const User = {
  collection: firestore.collection('users'),

  async findOne(query) {
    if (query.email) {
      const snapshot = await this.collection.where('email', '==', query.email.toLowerCase()).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { _id: doc.id, ...doc.data() };
    }
    if (query.username) {
      const snapshot = await this.collection.where('username', '==', query.username.toLowerCase()).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { _id: doc.id, ...doc.data() };
    }
    return null;
  },

  async findById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  async create(data) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    
    const userData = {
      ...data,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      authProvider: data.authProvider || 'local',
      providerId: data.providerId || null,
      geminiToken: data.geminiToken || null,
      openRouterKey: data.openRouterKey || null,
      isVerified: data.isVerified || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const docRef = await this.collection.add(userData);
    return { _id: docRef.id, ...userData };
  },

  async update(id, data) {
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  },

  async matchPassword(enteredPassword, userHash) {
    return await bcrypt.compare(enteredPassword, userHash);
  }
};

export default User;
