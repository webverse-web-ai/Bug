import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function POST(request) {
  try {
    console.log('API Route Hit: login');
    console.log('MONGODB_URI starts with:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 15) : 'undefined');
    
    await connectToDatabase();
    console.log('MongoDB connected state:', mongoose.connection.readyState);
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json({ error: 'Please provide email and password' }, { status: 400 });
    }

    // Find user by email and explicitly select the password field so we can compare it
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return Response.json({ error: "You don't have a registered account yet. Please create one." }, { status: 401 });
    }

    // Check if user has verified their email
    if (!user.isVerified) {
      return Response.json({ 
        error: 'Please verify your email address before logging in.',
        needsVerification: true
      }, { status: 403 });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

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
    console.error('Login Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
