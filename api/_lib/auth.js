import crypto from 'crypto';
import { ensureBootstrapAdmin, findAdminByUsername, verifyPassword } from './admins.js';

function secret() {
  return String(process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'change-me').trim();
}

export function createToken(admin) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    adminId: admin.id,
    username: admin.username,
    exp,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.role !== 'admin' || typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function authenticate(username, password) {
  await ensureBootstrapAdmin();
  const admin = await findAdminByUsername(username);
  if (!admin) return null;
  if (!verifyPassword(password, admin.passwordHash)) return null;
  return admin;
}

export function getBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function requireAdmin(req, res) {
  const token = getBearer(req);
  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: 'Non autorisé' });
    return null;
  }
  return session;
}
