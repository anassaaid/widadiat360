import { requireAdmin } from '../_lib/auth.js';
import { handleOptions, readJson, setCors } from '../_lib/http.js';
import { deleteReservation, getReservation, updateReservation } from '../_lib/store.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (!requireAdmin(req, res)) return;

  const id = req.query.id;
  if (!id) {
    res.status(400).json({ error: 'Identifiant manquant' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const item = await getReservation(id);
      if (!item) {
        res.status(404).json({ error: 'Réservation introuvable' });
        return;
      }
      res.status(200).json({ item });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const item = await updateReservation(id, body);
      if (!item) {
        res.status(404).json({ error: 'Réservation introuvable' });
        return;
      }
      res.status(200).json({ item });
      return;
    }

    if (req.method === 'DELETE') {
      const ok = await deleteReservation(id);
      if (!ok) {
        res.status(404).json({ error: 'Réservation introuvable' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
