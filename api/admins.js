import { requireAdmin } from './_lib/auth.js';
import {
  createAdmin,
  ensureBootstrapAdmin,
  listAdmins,
  toPublicList,
} from './_lib/admins.js';
import { handleOptions, readJson, setCors } from './_lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    if (req.method === 'GET') {
      const admins = await ensureBootstrapAdmin();
      res.status(200).json({
        items: toPublicList(admins.length ? admins : await listAdmins()),
        me: {
          adminId: session.adminId,
          username: session.username,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const item = await createAdmin({
        username: body.username,
        password: body.password,
        name: body.name,
      });
      res.status(201).json({ item });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    const status = /existe déjà|trop court|invalide/i.test(err.message || '') ? 400 : 500;
    res.status(status).json({ error: err.message || 'Erreur serveur' });
  }
}
