import connectToDatabase from '../../../src/utils/db';
import User from '../../../src/models/User';
import OTP from '../../../src/models/OTP';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return Response.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    // Find the latest OTP for the email
    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return Response.json({ error: 'OTP expired or not found' }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      return Response.json({ error: 'Invalid OTP code' }, { status: 400 });
    }

    // OTP is valid! Find user and mark as verified
    const user = await User.findOne({ email });
    
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    user.isVerified = true;
    await user.save();

    // Delete the OTP as it's been used
    await OTP.deleteMany({ email });

    // Generate JWT
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    return Response.json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
