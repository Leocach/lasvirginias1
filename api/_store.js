/* ============================================================
   LAS VIRGINIAS — Almacén del menú (Redis por TCP, protocolo RESP)
   Sin dependencias: usa los módulos nativos de Node (net / tls).
   Funciona con una cadena de conexión redis:// o rediss://
   (Redis Cloud, Upstash, Vercel KV, etc.).
   La conexión llega SIEMPRE por variable de entorno (REDIS_URL),
   que la integración de Redis en Vercel inyecta al proyecto.
   Nunca se incrustan credenciales en el código.
   ============================================================ */
'use strict';

const net = require('net');
const tls = require('tls');

const KEY = 'lasvirginias:menu:v1';

function rawUrl() {
  return (
    process.env.REDIS_URL ||
    process.env.REDIS_TCP_URL ||
    process.env.KV_URL ||
    process.env.STORAGE_REDIS_URL ||
    ''
  );
}

function parseUrl(u) {
  try {
    const p = new URL(u);
    return {
      host: p.hostname,
      port: Number(p.port || 6379),
      user: decodeURIComponent(p.username || ''),
      pass: decodeURIComponent(p.password || ''),
      tls: p.protocol === 'rediss:'
    };
  } catch (e) {
    return null;
  }
}

function configured() {
  const c = parseUrl(rawUrl());
  return !!(c && c.host);
}

/* --- RESP: codificar un comando como arreglo de bulk strings --- */
function encodeCommand(args) {
  const parts = [Buffer.from('*' + args.length + '\r\n')];
  for (const a of args) {
    const buf = Buffer.from(String(a));
    parts.push(Buffer.from('$' + buf.length + '\r\n'));
    parts.push(buf);
    parts.push(Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}

/* --- RESP: parsear UNA respuesta desde el buffer en offset --- */
function parseReply(buf, off) {
  if (off >= buf.length) return null;
  const type = String.fromCharCode(buf[off]);
  const nl = buf.indexOf('\r\n', off);
  if (nl < 0) return null;
  const line = buf.toString('utf8', off + 1, nl);

  if (type === '+' || type === ':') return { val: line, next: nl + 2 };
  if (type === '-') return { err: line, next: nl + 2 };
  if (type === '$') {
    const len = parseInt(line, 10);
    if (len === -1) return { val: null, next: nl + 2 };
    const start = nl + 2;
    const end = start + len;
    if (buf.length < end + 2) return null; // incompleto
    return { val: buf.toString('utf8', start, end), next: end + 2 };
  }
  if (type === '*') {
    const len = parseInt(line, 10);
    if (len === -1) return { val: null, next: nl + 2 };
    let cur = nl + 2;
    const arr = [];
    for (let i = 0; i < len; i++) {
      const r = parseReply(buf, cur);
      if (!r) return null;
      arr.push(r.err ? null : r.val);
      cur = r.next;
    }
    return { val: arr, next: cur };
  }
  return { val: line, next: nl + 2 };
}

/* --- Ejecutar un comando (con AUTH previo si hay contraseña) --- */
function run(commandArgs) {
  const c = parseUrl(rawUrl());
  if (!c || !c.host) return Promise.reject(new Error('redis_not_configured'));

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, x) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (e) {}
      fn(x);
    };

    const opts = { host: c.host, port: c.port };
    const sock = c.tls
      ? tls.connect({ ...opts, servername: c.host, rejectUnauthorized: false })
      : net.connect(opts);

    const authArgs = c.pass
      ? (c.user && c.user !== 'default' ? ['AUTH', c.user, c.pass] : ['AUTH', 'default', c.pass])
      : null;
    const expected = authArgs ? 2 : 1;

    const bufs = [];
    if (authArgs) bufs.push(encodeCommand(authArgs));
    bufs.push(encodeCommand(commandArgs));
    const payload = Buffer.concat(bufs);

    let chunks = Buffer.alloc(0);
    const tryParse = () => {
      let off = 0;
      const replies = [];
      for (let i = 0; i < expected; i++) {
        const r = parseReply(chunks, off);
        if (!r) return; // esperar más datos
        replies.push(r);
        off = r.next;
      }
      if (authArgs && replies[0].err) return finish(reject, new Error('auth_failed: ' + replies[0].err));
      const last = replies[expected - 1];
      if (last.err) return finish(reject, new Error('redis_err: ' + last.err));
      finish(resolve, last.val);
    };

    const onReady = () => { try { sock.write(payload); } catch (e) { finish(reject, e); } };
    sock.on(c.tls ? 'secureConnect' : 'connect', onReady);
    sock.on('data', (d) => { chunks = Buffer.concat([chunks, d]); tryParse(); });
    sock.on('error', (e) => finish(reject, e));
    sock.setTimeout(8000, () => finish(reject, new Error('redis_timeout')));
  });
}

async function readMenu() {
  const raw = await run(['GET', KEY]);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function writeMenu(data) {
  await run(['SET', KEY, JSON.stringify(data)]);
}

module.exports = { configured, readMenu, writeMenu, KEY };
