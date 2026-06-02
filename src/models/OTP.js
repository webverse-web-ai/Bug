import mongoose from 'mongoose';

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // The document will be automatically deleted after 10 minutes
  },
});

export default mongoose.models.OTP || mongoose.model('OTP', OTPSchema);
