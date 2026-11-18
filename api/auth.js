import { authenticate, createToken } from './_lib/auth.js';
import { handleOptions, readJson, setCors } from './_lib/http.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const body = await readJson(req);
    const username = body && body.username;
    const password = body && body.password;
    if (!username || !password) {
      res.status(400).json({ error: 'Identifiant et mot de passe requis' });
      return;
    }

    const admin = await authenticate(username, password);
    if (!admin) {
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      return;
    }

    res.status(200).json({
      token: createToken(admin),
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
