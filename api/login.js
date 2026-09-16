/* POST /api/login — valida la contraseña del dueño (env OWNER_PASSWORD) */
'use strict';
const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ab, bb); } catch (e) { return false; }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method' }); return; }

  // Contraseña del dueño: la variable OWNER_PASSWORD manda; si no está, usa la fijada.
  const pass = process.env.OWNER_PASSWORD || 'Trinkete';
  if (!pass) { res.status(200).json({ ok: false, configured: false }); return; }

  const body = await readBody(req);
  if (body && typeof body.password === 'string' && safeEqual(body.password, pass)) {
    res.status(200).json({ ok: true, configured: true });
  } else {
    res.status(401).json({ ok: false, configured: true, error: 'bad_password' });
  }
};
