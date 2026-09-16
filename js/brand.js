/* ============================================================
   LAS VIRGINIAS — Motor de marca para generación de contenido
   ------------------------------------------------------------
   Objetivo (brief §5): que la IA "suene y se vea" a Las Virginias
   sin que el dueño sepa nada de "prompts".

   Dos piezas:
   1) buildPrompt()  → arma el prompt de marca que se enviará a Kie AI.
   2) generate()     → produce la imagen. Hoy en MODO DEMO (compositor
      local sobre <canvas>, sin costo ni clave) para que el flujo
      funcione de punta a punta. Cuando exista backend + clave de Kie AI,
      se activa el MODO API (ver LVBrand.config + PUNTO DE INTEGRACIÓN).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Contexto de marca (fuente: CLAUDE.md / Moodboard) ---------- */
  const CONTEXT = {
    nombre: 'Las Virginias',
    descriptor: 'EL SABOR DE CASA.',
    institucional: 'De nuestra casa para la tuya.',
    lugar: 'Lagunillas, Zulia, Venezuela',
    colores: { rojo: '#A71C19', crema: '#FCEEBB', texto: '#29231F', queso: '#E8B83D' },
    claims: ['Pizza de verdad.', 'Más que pizza, mejores momentos.'],
    estrella: 'Tequepizza (borde relleno con la idea del tequeño)',
    estilo: 'retro · minimalista · familiar · divertido (proporción 50% moderno/minimalista, 25% retro, 15% familiar/artesanal, 10% divertido)',
    fotografia: 'la pizza real y provocativa como protagonista: queso derretido, estiramiento del queso, bordes rellenos, calor de recién salida, superficies cálidas de madera',
    voz: 'cercana, simpática, con humor; nunca corporativa, gourmet pretenciosa ni infantil',
    evitar: 'texto ilegible o mal escrito, estética demasiado antigua, estética demasiado moderna/fría, tono infantil, exceso de elementos'
  };

  /* ---------- Config (para el MODO API, etapa con backend) ----------
     IMPORTANTE: la clave de Kie AI NO debe vivir en el navegador en
     producción. Se llamará a través de un backend/proxy propio.
     'proxyUrl' es ese endpoint. Mientras esté vacío → MODO DEMO. */
  const CFG_KEY = 'lasvirginias_ia_cfg_v1';
  function loadConfig() {
    const base = { proxyUrl: '', model: 'kie-image', size: {} };
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
    } catch (e) {}
    return base;
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); return true; } catch (e) { return false; }
  }

  /* ---------- Intenciones (brief §4.2) ---------- */
  const INTENTS = {
    promo:     { label: 'Promoción',            hint: 'combo, descuento, 2x1…' },
    producto:  { label: 'Anuncio de producto',  hint: 'destacar una pizza, el borde relleno…' },
    temporada: { label: 'Post de temporada',    hint: 'fin de semana, feriado, fecha especial…' }
  };

  const FORMATS = {
    feed:     { label: 'Feed cuadrado', w: 1080, h: 1080, ratio: '1:1' },
    vertical: { label: 'Post vertical', w: 1080, h: 1350, ratio: '4:5' },
    story:    { label: 'Story',         w: 1080, h: 1920, ratio: '9:16' }
  };

  /* ============================================================
     1) Titular sugerido en voz de marca
     ============================================================ */
  const HEADLINES = {
    promo:     ['¡Promo de la casa!', 'Hoy toca antojo', '¿Y si hoy es de pizza?', 'Aprovecha y pide'],
    temporada: ['¿Hoy se come pizza?', 'Finde de pizza', 'Plan perfecto: pizza', 'De nuestra casa a la tuya'],
    tequepizza:['Hay pizzas… y está la Tequepizza', 'Ese borde no se rellena solo', 'La estrella de la casa'],
    producto:  ['{n}', '{n}, como en casa', 'Antojo de {n}']
  };

  function suggestHeadline(product, intent, detail, variant) {
    const d = (detail || '').trim();
    if (d) return d; // el dueño escribió su propio texto → se respeta
    const v = variant || 0;
    const nombre = product ? product.nombre : 'nuestras pizzas';
    let list;
    if (intent === 'promo') list = HEADLINES.promo;
    else if (intent === 'temporada') list = HEADLINES.temporada;
    else if (product && product.id === 'tequepizza') list = HEADLINES.tequepizza;
    else list = HEADLINES.producto;
    return list[v % list.length].replace('{n}', nombre);
  }

  function suggestSubline(product, intent) {
    if (intent === 'temporada') return 'De nuestra casa para la tuya.';
    if (product && product.id === 'tequepizza') return 'Pizza + tequeño. Porque una sola cosa nunca fue suficiente.';
    if (intent === 'producto') return 'Pizza de verdad.';
    if (product) return product.desc || 'Pizza de verdad.';
    return 'El sabor de casa.';
  }

  /* ============================================================
     2) Prompt de marca para Kie AI (texto-a-imagen)
        Se muestra al dueño solo como "detalle técnico".
     ============================================================ */
  function buildPrompt(opts) {
    const { product, intent, detail, format } = opts;
    const f = FORMATS[format] || FORMATS.feed;
    const headline = suggestHeadline(product, intent, detail, opts.variant);
    const prod = product ? (product.nombre + (product.desc ? ' — ' + product.desc : '')) : 'pizza de la casa';
    const intentTxt = ({
      promo: 'promotional post announcing an offer/combo',
      producto: 'product hero post highlighting one pizza',
      temporada: 'seasonal/weekend post inviting to order'
    })[intent] || 'promotional post';

    return [
      'Instagram ' + intentTxt + ' for "Las Virginias", a warm family pizzeria from ' + CONTEXT.lugar + '.',
      'Format ' + f.ratio + ' (' + f.w + 'x' + f.h + 'px).',
      'Subject: ' + prod + '. Make the pizza the hero — ' + CONTEXT.fotografia + '.',
      'Brand palette ONLY: red ' + CONTEXT.colores.rojo + ', cream ' + CONTEXT.colores.crema + ', warm dark ' + CONTEXT.colores.texto + ', cheese-gold ' + CONTEXT.colores.queso + '.',
      'Style: ' + CONTEXT.estilo + '. Clean composition, generous negative space, retro-diner but modern.',
      'Include short headline text in Spanish: "' + headline + '". Include the descriptor "' + CONTEXT.descriptor + '" small.',
      'Tone of any copy: ' + CONTEXT.voz + '.',
      'Avoid: ' + CONTEXT.evitar + '. Text must be correctly spelled Spanish and legible.'
    ].join(' ');
  }

  /* ============================================================
     Utilidades de canvas (MODO DEMO)
     ============================================================ */
  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load('900 80px "Archivo"'),
        document.fonts.load('800 60px "Archivo"'),
        document.fonts.load('600 40px "Archivo"'),
        document.fonts.load('500 40px "Inter"'),
        document.fonts.load('400 60px "Pacifico"')
      ]);
      await document.fonts.ready;
    } catch (e) {}
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Dibuja imagen tipo object-fit: cover dentro de (x,y,w,h)
  function drawCover(ctx, img, x, y, w, h) {
    const ir = img.width / img.height, r = w / h;
    let sw, sh, sx, sy;
    if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function halftone(ctx, w, h, color, gap, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function vichyStrip(ctx, x, y, w, h, sq, red, cream) {
    const cols = Math.ceil(w / sq);
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = i % 2 === 0 ? red : cream;
      ctx.fillRect(x + i * sq, y, sq, h);
    }
  }

  // Envuelve texto y devuelve las líneas
  function wrapLines(ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ============================================================
     Compositor de la promo (MODO DEMO) — resultado real de marca
     ============================================================ */
  async function demoCompose(opts) {
    const { product, intent, detail, format } = opts;
    const C = CONTEXT.colores;
    const f = FORMATS[format] || FORMATS.feed;
    const W = f.w, H = f.h;

    await ensureFonts();
    const [photo, logoCream, mascota, isotipo] = await Promise.all([
      loadImage(product && product.foto ? product.foto : ''),
      loadImage('assets/logo-cream.png'),
      loadImage('assets/mascota.png'),
      loadImage('assets/isotipo.png')
    ]);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    const variant = opts.variant || 0;
    const headline = suggestHeadline(product, intent, detail, variant);
    const subline = suggestSubline(product, intent);
    const M = Math.round(W * 0.075); // margen

    if (photo) {
      /* ---- Plantilla FOTO (la pizza protagonista) ---- */
      drawCover(ctx, photo, 0, 0, W, H);
      // scrim inferior para legibilidad
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
      g.addColorStop(0, 'rgba(41,35,31,0)');
      g.addColorStop(0.55, 'rgba(41,35,31,0.55)');
      g.addColorStop(1, 'rgba(30,20,16,0.92)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // viñeta superior suave
      const gt = ctx.createLinearGradient(0, 0, 0, H * 0.3);
      gt.addColorStop(0, 'rgba(30,20,16,0.45)'); gt.addColorStop(1, 'rgba(30,20,16,0)');
      ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H * 0.3);
    } else {
      /* ---- Plantilla ROJA (sin foto) ---- */
      ctx.fillStyle = C.rojo; ctx.fillRect(0, 0, W, H);
      halftone(ctx, W, H, '#FFF7DC', Math.round(W * 0.05), Math.round(W * 0.006), 0.10);
    }

    // Franja vichy superior
    vichyStrip(ctx, 0, 0, W, Math.round(H * 0.014), Math.round(W * 0.028), C.rojo, '#FFF7DC');

    // --- Marca arriba: isotipo en círculo crema (esquina) ---
    const badgeR = Math.round(W * 0.075);
    const bx = M + badgeR, by = Math.round(H * 0.055) + badgeR;
    ctx.save();
    ctx.beginPath(); ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF7DC'; ctx.fill();
    ctx.lineWidth = Math.max(3, W * 0.006); ctx.strokeStyle = C.rojo; ctx.stroke();
    if (isotipo) {
      ctx.beginPath(); ctx.arc(bx, by, badgeR - ctx.lineWidth, 0, Math.PI * 2); ctx.clip();
      const s = badgeR * 2;
      drawCover(ctx, isotipo, bx - badgeR, by - badgeR, s, s);
    }
    ctx.restore();

    // Etiqueta estrella (Tequepizza) arriba a la derecha
    if (product && product.id === 'tequepizza') {
      ctx.font = '800 ' + Math.round(W * 0.03) + 'px "Archivo"';
      const t = 'LA ESTRELLA ★';
      const tw = ctx.measureText(t).width;
      const padX = W * 0.03, ph = W * 0.075;
      const px = W - M - tw - padX * 2, py = Math.round(H * 0.055);
      roundRect(ctx, px, py, tw + padX * 2, ph, ph / 2);
      ctx.fillStyle = C.queso; ctx.fill();
      ctx.fillStyle = C.texto; ctx.textAlign = 'left';
      ctx.fillText(t, px + padX, py + ph * 0.7);
    }

    // --- Bloque de texto inferior ---
    let y = H - M;
    const maxW = W - M * 2;
    ctx.textAlign = 'left';

    // Descriptor + handle (línea base)
    ctx.font = '700 ' + Math.round(W * 0.026) + 'px "Archivo"';
    ctx.fillStyle = photo ? 'rgba(255,247,220,.85)' : 'rgba(255,247,220,.9)';
    const footL = CONTEXT.descriptor + '   ·   @lasvirginias.pizza';
    ctx.fillText(footL, M, y);
    y -= Math.round(W * 0.055);

    // Precios (si aplica)
    if (product && intent !== 'temporada' && (product.mediana || product.familiar)) {
      const pill = (label, val, x) => {
        ctx.font = '800 ' + Math.round(W * 0.032) + 'px "Archivo"';
        const txt = label + ' ' + window.LV.precio(val);
        const tw = ctx.measureText(txt).width;
        const padX = W * 0.028, ph = W * 0.072;
        roundRect(ctx, x, y - ph, tw + padX * 2, ph, ph / 2);
        ctx.fillStyle = C.queso; ctx.fill();
        ctx.fillStyle = C.texto; ctx.fillText(txt, x + padX, y - ph * 0.32);
        return x + tw + padX * 2 + W * 0.02;
      };
      let px = M;
      if (product.mediana) px = pill('Mediana', product.mediana, px);
      if (product.familiar) pill('Familiar', product.familiar, px);
      y -= Math.round(W * 0.10);
    }

    // Subtítulo (script)
    if (subline) {
      ctx.font = '400 ' + Math.round(W * 0.045) + 'px "Pacifico"';
      ctx.fillStyle = C.queso;
      const subLines = wrapLines(ctx, subline, maxW);
      for (let i = subLines.length - 1; i >= 0; i--) {
        ctx.fillText(subLines[i], M, y);
        y -= Math.round(W * 0.062);
      }
      y -= Math.round(W * 0.01);
    }

    // Titular (Archivo black)
    let fs = Math.round(W * 0.088);
    ctx.fillStyle = '#FFF7DC';
    let hLines;
    while (true) {
      ctx.font = '900 ' + fs + 'px "Archivo"';
      hLines = wrapLines(ctx, headline, maxW);
      if (hLines.length <= 3 || fs < W * 0.05) break;
      fs -= 6;
    }
    const lh = fs * 1.02;
    for (let i = hLines.length - 1; i >= 0; i--) {
      ctx.fillText(hLines[i].toUpperCase(), M, y);
      y -= lh;
    }

    // Mascota (solo promo/temporada, esquina inferior derecha, discreta)
    if (mascota && (intent === 'promo' || intent === 'temporada')) {
      const mw = Math.round(W * 0.26), mh = mw * (mascota.height / mascota.width);
      const mx = W - M - mw, my = H - M - mh - H * 0.012;
      if (variant % 2 === 1) { // variación: espejar la mascota
        ctx.save(); ctx.translate(mx + mw, my); ctx.scale(-1, 1);
        ctx.drawImage(mascota, 0, 0, mw, mh); ctx.restore();
      } else {
        ctx.drawImage(mascota, mx, my, mw, mh);
      }
    }

    return cv.toDataURL('image/png');
  }

  /* ============================================================
     generate() — orquesta MODO API o MODO DEMO
     ============================================================ */
  async function generate(opts, onStatus) {
    const cfg = loadConfig();
    const prompt = buildPrompt(opts);
    const status = (m) => { if (onStatus) onStatus(m); };

    // ---------- MODO API (Kie AI vía backend) ----------
    if (cfg.proxyUrl) {
      try {
        status('Generando con IA…');
        /* PUNTO DE INTEGRACIÓN KIE AI ────────────────────────────
           El backend recibe { prompt, format, productId } y llama a
           Kie AI con la clave guardada EN EL SERVIDOR. Debe devolver
           { imageUrl } o { imageBase64 }. Ajustar según el contrato
           real de tu proxy. */
        const f = FORMATS[opts.format] || FORMATS.feed;
        const res = await fetch(cfg.proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            width: f.w, height: f.h,
            productId: opts.product ? opts.product.id : null,
            intent: opts.intent
          })
        });
        if (!res.ok) throw new Error('proxy ' + res.status);
        const data = await res.json();
        const url = data.imageUrl || (data.imageBase64 ? 'data:image/png;base64,' + data.imageBase64 : null);
        if (!url) throw new Error('respuesta sin imagen');
        return { dataUrl: url, headline: suggestHeadline(opts.product, opts.intent, opts.detail, opts.variant), prompt, modo: 'api' };
      } catch (e) {
        console.warn('Kie AI (proxy) falló, usando modo demo:', e);
        status('IA no disponible, mostrando vista previa de marca…');
        const dataUrl = await demoCompose(opts);
        return { dataUrl, headline: suggestHeadline(opts.product, opts.intent, opts.detail, opts.variant), prompt, modo: 'demo', aviso: 'No se pudo conectar con Kie AI; se muestra una pieza de marca generada localmente.' };
      }
    }

    // ---------- MODO DEMO (sin backend/clave) ----------
    status('Componiendo pieza de marca…');
    const dataUrl = await demoCompose(opts);
    return { dataUrl, headline: suggestHeadline(opts.product, opts.intent, opts.detail, opts.variant), prompt, modo: 'demo' };
  }

  /* ---------- Export ---------- */
  window.LVBrand = {
    CONTEXT, INTENTS, FORMATS,
    loadConfig, saveConfig,
    suggestHeadline, suggestSubline, buildPrompt,
    generate, demoCompose
  };
})();
