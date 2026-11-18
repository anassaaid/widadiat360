import { put, list, del, get } from '@vercel/blob';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const PREFIX = 'admins/';

async function readStream(stream) {
  return new Response(stream).text();
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(String(password), salt, 64);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function publicAdmin(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    username: admin.username,
    name: admin.name || '',
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

export async function listAdmins() {
  const items = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      try {
        const result = await get(blob.pathname, { access: 'private', useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) continue;
        items.push(JSON.parse(await readStream(result.stream)));
      } catch {
        // skip
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return items.sort((a, b) => String(a.username).localeCompare(String(b.username)));
}

export async function getAdmin(id) {
  const result = await get(`${PREFIX}${id}.json`, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await readStream(result.stream));
}

export async function findAdminByUsername(username) {
  const needle = String(username || '').trim().toLowerCase();
  if (!needle) return null;
  const admins = await listAdmins();
  return admins.find((a) => String(a.username).toLowerCase() === needle) || null;
}

async function saveAdmin(admin) {
  await put(`${PREFIX}${admin.id}.json`, JSON.stringify(admin, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return admin;
}

export async function ensureBootstrapAdmin() {
  const existing = await listAdmins();
  if (existing.length > 0) return existing;

  const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || 'admin360').trim();
  const now = new Date().toISOString();
  const admin = {
    id: randomUUID(),
    username,
    name: 'Administrateur',
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
  await saveAdmin(admin);
  return [admin];
}

export async function createAdmin({ username, password, name }) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');
  if (!cleanUser || cleanUser.length < 3) {
    throw new Error('Identifiant trop court (min. 3 caractères)');
  }
  if (!/^[a-z0-9._-]+$/i.test(cleanUser)) {
    throw new Error('Identifiant invalide (lettres, chiffres, . _ -)');
  }
  if (!cleanPass || cleanPass.length < 6) {
    throw new Error('Mot de passe trop court (min. 6 caractères)');
  }

  await ensureBootstrapAdmin();
  const duplicate = await findAdminByUsername(cleanUser);
  if (duplicate) throw new Error('Cet identifiant existe déjà');

  const now = new Date().toISOString();
  const admin = {
    id: randomUUID(),
    username: cleanUser,
    name: String(name || '').trim(),
    passwordHash: hashPassword(cleanPass),
    createdAt: now,
    updatedAt: now,
  };
  await saveAdmin(admin);
  return publicAdmin(admin);
}

export async function updateAdmin(id, patch) {
  const current = await getAdmin(id);
  if (!current) return null;

  if (patch.username != null) {
    const cleanUser = String(patch.username).trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3) throw new Error('Identifiant trop court (min. 3 caractères)');
    if (!/^[a-z0-9._-]+$/i.test(cleanUser)) throw new Error('Identifiant invalide');
    const other = await findAdminByUsername(cleanUser);
    if (other && other.id !== id) throw new Error('Cet identifiant existe déjà');
    current.username = cleanUser;
  }

  if (patch.name != null) current.name = String(patch.name).trim();

  if (patch.password != null && String(patch.password).length > 0) {
    if (String(patch.password).length < 6) throw new Error('Mot de passe trop court (min. 6 caractères)');
    current.passwordHash = hashPassword(patch.password);
  }

  current.updatedAt = new Date().toISOString();
  await saveAdmin(current);
  return publicAdmin(current);
}

export async function deleteAdmin(id, currentAdminId) {
  const admins = await listAdmins();
  if (admins.length <= 1) throw new Error('Impossible de supprimer le dernier administrateur');
  if (id === currentAdminId) throw new Error('Vous ne pouvez pas supprimer votre propre compte');
  const target = admins.find((a) => a.id === id);
  if (!target) return false;
  await del(`${PREFIX}${id}.json`);
  return true;
}

export function toPublicList(admins) {
  return admins.map(publicAdmin);
}

export { publicAdmin };
