/* GET /api/menu — lectura pública del menú (lo ven todos los clientes) */
'use strict';
const store = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'method' }); return; }

  if (!store.configured()) {
    // Backend aún sin base de datos: el cliente usa sus valores por defecto.
    res.status(200).json({ ok: true, configured: false, data: null });
    return;
  }
  try {
    const data = await store.readMenu();
    res.status(200).json({ ok: true, configured: true, data: data });
  } catch (e) {
    res.status(200).json({ ok: false, configured: true, error: 'read_failed', data: null });
  }
};
