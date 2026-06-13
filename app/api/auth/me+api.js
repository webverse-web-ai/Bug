import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Team from '@/server/models/Team';
import { serializeTeam } from '../team+api';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export async function GET(request) {
  try {
    await connectToDatabase();
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized, no token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      let team = null;
      if (user.teamId) {
        const t = await Team.findById(user.teamId);
        if (t) team = serializeTeam(t, user._id);
      }

      return Response.json({
        success: true,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          authProvider: user.authProvider,
          username: user.username,
          path: user.path,
          hasGeminiToken: !!user.geminiToken,
          hasOpenRouterKey: !!user.openRouterKey,
          team,
          teamStatus: user.teamStatus || (team ? team.myStatus : null),
          role: user.role || (team ? team.myRole : null),
        }
      }, { status: 200 });
      
    } catch (err) {
      return Response.json({ error: 'Unauthorized, invalid token' }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Fetch Me Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
