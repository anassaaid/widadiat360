import { requireAdmin } from '../_lib/auth.js';
import { deleteAdmin, updateAdmin } from '../_lib/admins.js';
import { handleOptions, readJson, setCors } from '../_lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  const session = requireAdmin(req, res);
  if (!session) return;

  const id = req.query.id;
  if (!id) {
    res.status(400).json({ error: 'Identifiant manquant' });
    return;
  }

  try {
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const item = await updateAdmin(id, body);
      if (!item) {
        res.status(404).json({ error: 'Administrateur introuvable' });
        return;
      }
      res.status(200).json({ item });
      return;
    }

    if (req.method === 'DELETE') {
      const ok = await deleteAdmin(id, session.adminId);
      if (!ok) {
        res.status(404).json({ error: 'Administrateur introuvable' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    const status = /Impossible|propre compte|trop court|invalide|existe déjà/i.test(err.message || '')
      ? 400
      : 500;
    res.status(status).json({ error: err.message || 'Erreur serveur' });
  }
}
