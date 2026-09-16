/* ============================================================
   LAS VIRGINIAS — Datos del menú + almacenamiento (compartido)
   Cara pública y panel privado leen/escriben el MISMO store.
   Sitio autónomo: se guarda en el navegador (localStorage).
   ============================================================ */
(function () {
  'use strict';

  const STORE_KEY = 'lasvirginias_data_v1';

  /* ---------- Datos por defecto (semilla) ----------
     Fuente: Brief-Menu-Digital-IA.md (anexo 8). Precios en USD. */
  const DEFAULT = {
    contacto: {
      whatsapp: '584140000000',                 // ← EDITAR: número real con código de país, sin +
      whatsappMsg: 'Hola Las Virginias 👋 quiero hacer un pedido:',
      instagram: 'lasvirginias.pizza',
      telefono: '+58 414 000 0000',              // ← EDITAR
      horario: 'Mar a Dom · 5:00 pm – 10:00 pm',
      zona: 'Lagunillas, Zulia · Delivery y take away'
    },
    bordeNota: 'Cualquier pizza puede pedirse con <strong>borde relleno de queso</strong> — el sello de la casa.',
    pizzas: [
      {
        id: 'napoli', nombre: 'Napoli', ico: 'porcion',
        desc: 'La clásica de siempre: salsa, queso y ganas de repetir.',
        mediana: 7, familiar: 9, foto: '', badge: '', disponible: true
      },
      {
        id: 'jamon-queso', nombre: 'Jamón y Queso', ico: 'porcion',
        desc: 'La más pedida de la casa. Simple, generosa y siempre buena idea.',
        mediana: 8, familiar: 10, foto: '', badge: 'top', disponible: true
      },
      {
        id: 'tequepizza', nombre: 'Tequepizza', ico: 'queso',
        desc: 'Nuestra estrella: el borde con la idea del tequeño relleno de queso. Pizza + tequeño en una sola mordida.',
        mediana: 10, familiar: 13, foto: 'assets/pizza-tequepizza.jpg', badge: 'estrella', disponible: true
      },
      {
        id: 'salchipizza', nombre: 'Salchipizza', ico: 'porcion',
        desc: 'Con salchicha y su toque de salsa tártara. Distinta, sabrosa y con actitud.',
        mediana: 12, familiar: 14, foto: '', badge: '', disponible: true
      },
      {
        id: 'cuatro-estaciones', nombre: 'Cuatro Estaciones', ico: 'porcion',
        desc: 'Cuatro sabores en una: tocineta, maíz, pimentón y cebolla. Para los que no saben decidir.',
        mediana: 10, familiar: 12, foto: 'assets/pizza-gemini.jpg', badge: '', disponible: true
      }
    ],
    adicionales: [
      { id: 'mozzarella', nombre: 'Queso mozzarella', ico: 'queso', mediana: 1.5, familiar: 2.5 },
      { id: 'pimenton-cebolla', nombre: 'Pimentón o cebolla', ico: 'pimenton', mediana: 1, familiar: 1.5 },
      { id: 'maiz', nombre: 'Maíz', ico: 'maiz', mediana: 1.5, familiar: 2.5 },
      { id: 'tocineta-otros', nombre: 'Tocineta, champiñón, peperoni o salami', ico: 'tocineta', mediana: 2, familiar: 3 }
    ],
    bebida: { nombre: 'Refresco 1.5 Lts', precio: 2 }
  };

  /* ---------- Store helpers ---------- */
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function getData() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // merge superficial sobre defaults (por si se agregan campos nuevos)
        return Object.assign(deepClone(DEFAULT), parsed);
      }
    } catch (e) { /* localStorage no disponible o dato corrupto */ }
    return deepClone(DEFAULT);
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar (localStorage):', e);
      return false;
    }
  }

  function resetData() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    return deepClone(DEFAULT);
  }

  /* ---------- Formato de precio (estilo brief: 7$ · 1,50$) ---------- */
  function precio(n) {
    if (n === null || n === undefined || n === '') return '';
    const num = Number(n);
    if (Number.isInteger(num)) return num + '$';
    return num.toFixed(2).replace('.', ',') + '$';
  }

  /* ============================================================
     Íconos de línea (estilo moodboard: outline, trazo parejo)
     Se colorean por CSS (stroke: var(--rojo) / var(--queso)…)
     ============================================================ */
  const ICON_PATHS = {
    porcion: '<path d="M12 3.5c4.5 0 8.3 2 10 4.2L12 20.5 2 7.7C3.7 5.5 7.5 3.5 12 3.5Z"/><circle cx="9" cy="9.5" r=".6" fill="currentColor" stroke="none"/><circle cx="13.5" cy="8.5" r=".6" fill="currentColor" stroke="none"/><circle cx="11.5" cy="13" r=".6" fill="currentColor" stroke="none"/>',
    queso: '<path d="M3 15.5 15 6c2.8.5 5 2.5 6 5.5L9 20.5c-3-.6-5.2-2.4-6-5Z"/><circle cx="9" cy="13.5" r="1"/><circle cx="13" cy="11.5" r="1"/><circle cx="7" cy="16.5" r=".7"/>',
    tomate: '<circle cx="12" cy="14" r="6.5"/><path d="M12 7.5c0-2 1.5-3 3-3M12 7.5c0-1.5-1.2-2.4-2.6-2.4"/>',
    champinon: '<path d="M5 12a7 7 0 0 1 14 0Z"/><path d="M10 12v4.5a2 2 0 0 0 4 0V12"/>',
    hoja: '<path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14Z"/><path d="M9 15 5 19"/>',
    maiz: '<path d="M12 3c3 2 4 6 4 9s-1 7-4 9c-3-2-4-6-4-9s1-7 4-9Z"/><path d="M12 4v16M9 9l3 1 3-1M9 13l3 1 3-1"/>',
    tocineta: '<path d="M4 8c3-2 5 2 8 0s5-2 8 0M4 13c3-2 5 2 8 0s5-2 8 0M4 18c3-2 5 2 8 0"/>',
    pimenton: '<path d="M7 12a5 5 0 0 1 10 0c0 4-2.5 7-5 7s-5-3-5-7Z"/><path d="M12 7c0-2 1.4-3 3-3"/>',
    cebolla: '<path d="M12 21c-3.5 0-6-2.8-6-6.5C6 10 9 6 12 4c3 2 6 6 6 10.5C18 18.2 15.5 21 12 21Z"/><path d="M12 4v3M9.5 6l1.5 2M14.5 6 13 8"/>',
    bebida: '<path d="M7 4h10l-1 4H8L7 4Z"/><path d="M8 8l1 11a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9L16 8"/>',
    casa: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    receta: '<path d="M6 4h9a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2V4Z"/><path d="M9 8h5M9 11h5"/><path d="M6 4a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2"/>',
    fuego: '<path d="M12 3c1 3-1 4-1 6 0 1 1 2 1 2s2-1 2-3c2 1.5 3 4 3 6a5 5 0 0 1-10 0c0-3 2-4 3-6 .8-1.5 1-3 2-5Z"/>',
    corazon: '<path d="M12 20s-7-4.3-9-8.2C1.5 8.5 3 5.5 6 5.5c2 0 3 1.3 3.5 2.2C10 6.8 11 5.5 13 5.5c3 0 4.5 3 3 6.3C18.9 15.6 12 20 12 20Z"/>',
    whatsapp: '<path d="M4 20l1.4-4A8 8 0 1 1 9 18.6L4 20Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1.2-.5 1.2-1.1 0-.3-.9-.8-1.3-1-.4-.1-.7.4-1 .4-.8 0-2.7-1.9-2.7-2.7 0-.3.5-.6.4-1-.1-.4-.7-1.3-1-1.3-.6 0-1.1.6-1.1 1.2Z"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r=".9" fill="currentColor" stroke="none"/>',
    telefono: '<path d="M6 4h3l1.5 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.5V17c0 1.6-1.3 3-3 3A14 14 0 0 1 3 7c0-1.7 1.3-3 3-3Z"/>',
    reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    ubicacion: '<path d="M12 21c4-4 7-7.2 7-11a7 7 0 0 0-14 0c0 3.8 3 7 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    estrella: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9l-5.1 2.9 1-5.7-4.1-4 5.7-.8L12 3.5Z"/>',
    ia: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z"/>',
    descargar: '<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 19h14"/>',
    editar: '<path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="M13 7l4 4"/>',
    check: '<path d="M5 12.5 10 17 19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };

  function icon(name, cls) {
    const p = ICON_PATHS[name] || ICON_PATHS.porcion;
    const c = cls ? ` class="${cls}"` : '';
    return `<svg${c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  /* ============================================================
     Backend remoto (Vercel) — menú compartido para todos
     Si el backend no está desplegado/configurado, cada función
     devuelve un estado que el resto del sitio maneja con gracia
     (cae al almacenamiento local del navegador).
     ============================================================ */
  const API = {
    async fetchMenu() {
      try {
        const r = await fetch('/api/menu', { cache: 'no-store' });
        if (!r.ok) return { ok: false, status: r.status };
        return await r.json();               // { ok, configured, data }
      } catch (e) { return { ok: false, error: 'network' }; }
    },
    async login(password) {
      try {
        const r = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const j = await r.json().catch(() => ({}));
        return Object.assign({ status: r.status }, j);
      } catch (e) { return { ok: false, error: 'network' }; }
    },
    async save(data, password) {
      try {
        const r = await fetch('/api/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, data })
        });
        const j = await r.json().catch(() => ({}));
        return Object.assign({ status: r.status }, j);
      } catch (e) { return { ok: false, error: 'network' }; }
    }
  };

  /* ---------- Export ---------- */
  window.LV = {
    STORE_KEY,
    DEFAULT,
    getData,
    saveData,
    resetData,
    precio,
    icon,
    ICON_PATHS,
    API
  };
})();
