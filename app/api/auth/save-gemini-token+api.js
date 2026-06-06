import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function POST(request) {
  try {
    await connectToDatabase();
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized, no token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const body = await request.json();
      const { accessToken } = body;
      
      if (!accessToken) {
        return Response.json({ error: 'Access token is required' }, { status: 400 });
      }

      const user = await User.findByIdAndUpdate(
        decoded.id, 
        { geminiToken: accessToken },
        { new: true }
      );

      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      return Response.json({
        success: true,
        message: 'Token saved successfully'
      });
      
    } catch (err) {
      return Response.json({ error: 'Unauthorized, invalid token' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Save Token Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
