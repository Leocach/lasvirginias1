/* POST /api/save — guarda el menú (requiere la contraseña del dueño) */
'use strict';
const crypto = require('crypto');
const store = require('./_store');

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
  if (!pass) { res.status(503).json({ ok: false, configured: false, error: 'no_password' }); return; }

  const body = await readBody(req);
  if (!body || typeof body.password !== 'string' || !safeEqual(body.password, pass)) {
    res.status(401).json({ ok: false, error: 'bad_password' }); return;
  }
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    res.status(400).json({ ok: false, error: 'bad_data' }); return;
  }
  if (!store.configured()) {
    res.status(503).json({ ok: false, configured: false, error: 'no_store' }); return;
  }
  try {
    await store.writeMenu(body.data);
    res.status(200).json({ ok: true, savedAt: Date.now() });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'write_failed' });
  }
};
