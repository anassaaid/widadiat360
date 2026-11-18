import { handleOptions, setCors } from './_lib/http.js';
import { findByPresenceToken } from './_lib/store.js';
import { buildQrPng } from './_lib/email.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
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

    const png = await buildQrPng(token);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(png);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
