import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    await connectToDatabase();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify backend JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    } catch (err) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { username, path } = body;

    if (!username || username.trim().length < 3) {
      return Response.json({ error: 'Valid username is required' }, { status: 400 });
    }

    if (!path) {
      return Response.json({ error: 'Path is required' }, { status: 400 });
    }

    // Check if username is already taken by someone else
    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });

    if (existingUser && existingUser._id !== decoded.id) {
      return Response.json({ error: 'Username is already taken' }, { status: 400 });
    }

    // Update user
    const updatedUserDoc = await User.findById(decoded.id);
    if (!updatedUserDoc) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    await User.update(decoded.id, { 
      username: username.trim().toLowerCase(),
      path: path
    });
    
    // Merge for response
    const updatedUser = { ...updatedUserDoc, username: username.trim().toLowerCase() };

    // In a real app, you might also want to save the `path` (create/join team)
    // For now, we just save the username successfully.
    
    return Response.json({ 
      success: true, 
      message: 'Setup completed successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        email: updatedUser.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Complete Setup Error:', error);
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
