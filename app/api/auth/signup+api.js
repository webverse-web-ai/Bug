import connectToDatabase from '../../../src/utils/db';
import User from '../../../src/models/User';
import OTP from '../../../src/models/OTP';
import { sendVerificationEmail } from '../../../src/utils/emailService';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { fullName, email, password } = body;

    if (!fullName || !email || !password) {
      return Response.json({ error: 'Please provide all fields' }, { status: 400 });
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user && user.isVerified) {
      return Response.json({ error: 'User already exists and is verified. Please log in.' }, { status: 400 });
    }

    if (!user) {
      // Create new unverified user
      user = new User({ fullName, email, password });
      await user.save();
    } else {
      // User exists but unverified, update their password and name
      user.fullName = fullName;
      user.password = password;
      await user.save();
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove any existing OTP for this email
    await OTP.deleteMany({ email });

    // Save new OTP
    await OTP.create({ email, otp: otpCode });

    // Send email
    const previewUrl = await sendVerificationEmail(email, otpCode);

    return Response.json({ 
      success: true, 
      message: 'OTP sent successfully',
      previewUrl // Providing this back for easy testing with Ethereal
    });
    
  } catch (error) {
    console.error('Signup Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
