import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { provider, accessToken } = body;

    if (!provider || !accessToken) {
      return Response.json({ error: 'Provider and accessToken are required' }, { status: 400 });
    }

    let userInfo = {};

    if (provider === 'google') {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return Response.json({ error: 'Invalid Google access token' }, { status: 401 });
      }
      const data = await response.json();
      userInfo = {
        email: data.email,
        fullName: data.name,
        providerId: data.sub, // Google unique ID
        isEmailVerified: data.email_verified,
      };
    } else if (provider === 'facebook') {
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
      if (!response.ok) {
        return Response.json({ error: 'Invalid Facebook access token' }, { status: 401 });
      }
      const data = await response.json();
      userInfo = {
        email: data.email,
        fullName: data.name,
        providerId: data.id,
      };
      
      if (!userInfo.email) {
         return Response.json({ error: 'Facebook did not provide an email address' }, { status: 400 });
      }
    } else {
      return Response.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    // Check if user exists
    let user = await User.findOne({ email: userInfo.email });

    if (user) {
      // If the user already exists, we log them in and ensure they are marked as verified.
      // We don't overwrite their local password if they have one.
      user.isVerified = true;
      if (!user.providerId && user.authProvider !== 'local') {
        user.authProvider = provider;
        user.providerId = userInfo.providerId;
      }
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email: userInfo.email,
        fullName: userInfo.fullName,
        authProvider: provider,
        providerId: userInfo.providerId,
        isVerified: true, // OAuth emails are generally considered verified
      });
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
        isVerified: user.isVerified,
        authProvider: user.authProvider,
        username: user.username,
        path: user.path,
        hasGeminiToken: !!user.geminiToken,
        hasOpenRouterKey: !!user.openRouterKey
      }
    });

  } catch (error) {
    console.error('OAuth Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
