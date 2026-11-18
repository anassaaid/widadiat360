import { handleOptions, readJson, setCors } from './_lib/http.js';
import { findByPresenceToken, markPresentByToken } from './_lib/store.js';

function publicView(item) {
  if (!item) return null;
  return {
    id: item.id,
    fullName: item.fullName,
    roomLabel: item.roomLabel,
    roomNumber: item.roomNumber || '',
    source: item.source,
    occupants: item.occupants,
    presentAt: item.presentAt || null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      const token = String(req.query.t || '').trim();
      if (!token) {
        res.status(400).json({ error: 'Token manquant' });
        return;
      }
      const item = await findByPresenceToken(token);
      if (!item) {
        res.status(404).json({ error: 'Réservation introuvable' });
        return;
      }
      res.status(200).json({ item: publicView(item) });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const token = String(body.t || body.token || req.query.t || '').trim();
      if (!token) {
        res.status(400).json({ error: 'Token manquant' });
        return;
      }
      const result = await markPresentByToken(token);
      if (!result) {
        res.status(404).json({ error: 'Réservation introuvable' });
        return;
      }
      res.status(200).json({
        item: publicView(result.item),
        already: result.already,
        confirmed: true,
      });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
