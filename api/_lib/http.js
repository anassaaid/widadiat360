export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export async function readJson(req) {
  if (req.body != null) {
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8').trim();
      return raw ? JSON.parse(raw) : {};
    }
    if (typeof req.body === 'string') {
      const raw = req.body.trim();
      return raw ? JSON.parse(raw) : {};
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
