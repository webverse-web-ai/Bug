import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import OTP from '@/server/models/OTP';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return Response.json({ error: 'Please provide email, OTP, and new password' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check OTP
    const validOtp = await OTP.findOne({ email, otp });
    if (!validOtp) {
      return Response.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Update password (User.update re-hashes when `password` is present)
    // and ensure the user is verified since they validated an OTP.
    await User.update(user._id, { password: newPassword, isVerified: true });

    // Delete OTP
    await OTP.deleteMany({ email });

    return Response.json({ 
      success: true, 
      message: 'Password reset successfully'
    });
    
  } catch (error) {
    console.error('Reset Password Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
