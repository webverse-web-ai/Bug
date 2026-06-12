import { firestore } from '../lib/db';

const OTP = {
  collection: firestore.collection('otps'),

  async create(data) {
    const otpData = {
      ...data,
      email: data.email.toLowerCase(),
      otp: String(data.otp),
      createdAt: new Date()
    };
    const docRef = await this.collection.add(otpData);
    return { _id: docRef.id, ...otpData };
  },

  async findOne(query) {
    if (query.email && query.otp) {
      const snapshot = await this.collection
        .where('email', '==', query.email.toLowerCase())
        .where('otp', '==', String(query.otp))
        .limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { _id: doc.id, ...doc.data() };
    }
    return null;
  },

  async deleteMany(query) {
    if (query.email) {
      const snapshot = await this.collection.where('email', '==', query.email.toLowerCase()).get();
      const batch = firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  }
};

export default OTP;
