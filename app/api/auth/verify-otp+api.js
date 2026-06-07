import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import OTP from '@/server/models/OTP';
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
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return Response.json({ error: 'OTP expired, not found, or invalid' }, { status: 400 });
    }

    // OTP is valid! Find user and mark as verified
    const user = await User.findOne({ email });
    
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    await User.update(user._id, { isVerified: true });
    user.isVerified = true;

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
        isVerified: user.isVerified,
        username: user.username,
        path: user.path,
        hasGeminiToken: !!user.geminiToken,
        hasOpenRouterKey: !!user.openRouterKey
      }
    });
    
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
