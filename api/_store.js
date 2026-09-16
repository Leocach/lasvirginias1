/* ============================================================
   LAS VIRGINIAS — Almacén del menú (Upstash Redis REST vía fetch)
   Sin dependencias: usa el fetch global de Node en Vercel.
   Las variables de entorno las crea la integración de Storage
   (Redis / KV / Upstash) al conectarla al proyecto.
   ============================================================ */
'use strict';

const KEY = 'lasvirginias:menu:v1';

function creds() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_API_URL ||
    '';
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_API_TOKEN ||
    '';
  return { url: url.replace(/\/+$/, ''), token };
}

function configured() {
  const { url, token } = creds();
  return !!(url && token);
}

async function cmd(args) {
  const { url, token } = creds();
  if (!url || !token) throw new Error('kv_not_configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('kv_http_' + r.status);
  const j = await r.json();
  return j.result;
}

async function readMenu() {
  const raw = await cmd(['GET', KEY]);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function writeMenu(data) {
  await cmd(['SET', KEY, JSON.stringify(data)]);
}

module.exports = { configured, readMenu, writeMenu, KEY };
