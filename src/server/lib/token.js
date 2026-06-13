import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Single place that mints auth tokens, so the payload shape (id + teamId) stays
// consistent across login, OTP, OAuth, and team create/join. teamId lets the
// data APIs resolve the workspace without an extra DB read on every request.
export function signToken(userId, teamId) {
  return jwt.sign({ id: userId, teamId: teamId || null }, SECRET, { expiresIn: '7d' });
}
