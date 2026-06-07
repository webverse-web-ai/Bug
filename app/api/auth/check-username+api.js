import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');

    if (!username || username.trim().length < 3) {
      return Response.json({ error: 'Valid username required' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if user already exists with this username
    // User.findOne handles case-insensitivity internally
    const existingUser = await User.findOne({ 
      username: username.trim()
    });

    return Response.json({ 
      available: !existingUser 
    });
    
  } catch (error) {
    console.error('Check Username Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
