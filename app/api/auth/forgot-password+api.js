import connectToDatabase from '../../../src/utils/db';
import User from '../../../src/models/User';
import OTP from '../../../src/models/OTP';
import { sendVerificationEmail } from '../../../src/utils/emailService';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: 'Please provide an email address' }, { status: 400 });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't leak whether the user exists or not for security reasons
      // Just say it was sent. Wait, the user requested an error message "you don't have a registered account" earlier.
      // So let's return an error if they don't exist to be helpful to the user.
      return Response.json({ error: "No account found with this email." }, { status: 404 });
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
      message: 'Recovery email sent successfully',
      previewUrl // Providing this back for easy testing with Ethereal
    });
    
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
