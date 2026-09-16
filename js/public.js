/* ============================================================
   LAS VIRGINIAS — Cara pública (render del menú)
   Pinta al instante con lo que haya en caché/por defecto y luego
   se actualiza con el menú en la nube (lo que edita el dueño).
   ============================================================ */
(function () {
  'use strict';
  const { getData, saveData, precio, icon, API } = window.LV;
  const $ = (s, r = document) => r.querySelector(s);

  let data = getData(); // caché local / semilla; se reemplaza si llega el remoto

  /* ---------- WhatsApp ---------- */
  function waLink(extra) {
    const c = data.contacto || {};
    const num = (c.whatsapp || '').replace(/[^\d]/g, '');
    const msg = (c.whatsappMsg || 'Hola Las Virginias 👋') + (extra ? ' ' + extra : '');
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }
  function setWa(id, extra) { const el = document.getElementById(id); if (el) el.href = waLink(extra); }

  /* ---------- Íconos del sistema en botones de menú móvil (una vez) ---------- */
  const mBtn = document.getElementById('menu-btn'); if (mBtn) mBtn.innerHTML = icon('menu');
  const nCerrar = document.getElementById('nav-cerrar'); if (nCerrar) nCerrar.innerHTML = icon('x');

  /* ---------- Valores (contenido fijo, una vez) ---------- */
  const valores = [
    { ico: 'receta', t: 'Receta familiar' },
    { ico: 'queso', t: 'Bordes rellenos' },
    { ico: 'casa', t: 'Hecho en casa' },
    { ico: 'ubicacion', t: 'De Lagunillas' }
  ];
  $('#valores').innerHTML = valores.map((v, i) =>
    `<div class="valor">${icon(v.ico)}<span>${v.t}</span></div>` +
    (i < valores.length - 1 ? '<span class="valores-sep"></span>' : '')
  ).join('');

  /* ---------- Helpers de pizzas ---------- */
  function badgeHtml(b) {
    if (b === 'estrella') return `<span class="badge badge-estrella">★ La estrella</span>`;
    if (b === 'top') return `<span class="badge badge-top">El más pedido</span>`;
    return '';
  }
  function fotoHtml(p) {
    if (p.foto) return `<img src="${p.foto}" alt="${p.nombre}" loading="lazy" />`;
    return `<div class="pizza-ph">${icon(p.ico || 'porcion')}</div>`;
  }

  /* ============================================================
     renderData(d) — todo lo que depende de los datos del menú.
     Se puede llamar más de una vez (caché → remoto).
     ============================================================ */
  function renderData(d) {
    data = d;

    // WhatsApp (dependen de data.contacto)
    setWa('wa-header'); setWa('wa-hero');
    setWa('wa-teque', 'quiero una Tequepizza 🧀');
    setWa('wa-arma', 'quiero armar mi pizza:');

    // Metadato del hero (lugar)
    const heroMeta = document.getElementById('hero-meta');
    if (heroMeta) heroMeta.innerHTML = `${icon('ubicacion')}<span>${(data.contacto && data.contacto.zona) || 'Lagunillas, Zulia'}</span>`;

    // Menú de pizzas
    $('#menu-grid').innerHTML = (data.pizzas || []).map(p => `
      <article class="pizza${p.disponible ? ' pizza-clickable' : ' no-disp'}"${p.disponible ? ` data-add="${p.id}"` : ''}>
        <div class="pizza-foto">
          ${badgeHtml(p.badge)}
          ${p.disponible ? '' : '<span class="badge-off">Agotada por hoy</span>'}
          ${fotoHtml(p)}
        </div>
        <div class="pizza-cuerpo">
          <h3 class="pizza-nombre">${p.nombre}</h3>
          <p class="pizza-desc">${p.desc || ''}</p>
          <div class="pizza-precios">
            <div class="precio"><span>Mediana</span><strong>${precio(p.mediana)}</strong></div>
            <div class="precio"><span>Familiar</span><strong>${precio(p.familiar)}</strong></div>
          </div>
          ${p.disponible
            ? `<button class="btn btn-rojo pizza-add" type="button" data-add="${p.id}">＋ Agregar al pedido</button>`
            : `<button class="btn btn-fantasma pizza-add" type="button" disabled>Agotada por hoy</button>`}
        </div>
      </article>`).join('');

    // Nota de borde
    $('#menu-nota').innerHTML = `${icon('queso')}<span>${data.bordeNota || ''}</span>`;

    // Bebida
    if (data.bebida && data.bebida.nombre) {
      $('#bebida-row').innerHTML = `
        <div class="chip-bebida">
          <span class="ico">${icon('bebida')}</span>
          <b>${data.bebida.nombre}</b>
          <span>${precio(data.bebida.precio)}</span>
          <button class="chip-add" type="button" data-add-drink="1" aria-label="Agregar bebida al pedido">＋</button>
        </div>`;
    } else { $('#bebida-row').innerHTML = ''; }

    // Precios Tequepizza
    const teque = (data.pizzas || []).find(p => p.id === 'tequepizza');
    if (teque) {
      $('#teque-precios').innerHTML = `
        <div class="teque-precio"><span>Mediana</span><strong>${precio(teque.mediana)}</strong></div>
        <div class="teque-precio"><span>Familiar</span><strong>${precio(teque.familiar)}</strong></div>`;
    }

    // Adicionales (lista tipo carta)
    $('#adicionales').innerHTML =
      `<div class="adic-head"><span>Adicional</span><span>Mediana</span><span>Familiar</span></div>` +
      (data.adicionales || []).map(a => `
      <div class="adic">
        <span class="nom">${a.nombre}</span>
        <span class="pr">${precio(a.mediana)}</span>
        <span class="pr">${precio(a.familiar)}</span>
      </div>`).join('');

    // Contacto
    const c = data.contacto || {};
    const igUrl = 'https://instagram.com/' + (c.instagram || '').replace('@', '');
    const telClean = (c.telefono || '').replace(/[^\d+]/g, '');
    const items = [
      { ico: 'whatsapp', l: 'WhatsApp', v: 'Pide directo por chat', href: waLink() },
      { ico: 'instagram', l: 'Instagram', v: '@' + (c.instagram || '').replace('@', ''), href: igUrl },
      { ico: 'telefono', l: 'Teléfono', v: c.telefono, href: 'tel:' + telClean },
      { ico: 'reloj', l: 'Horario', v: c.horario, href: '' },
      { ico: 'ubicacion', l: 'Dónde', v: c.zona, href: '' }
    ];
    $('#contacto-lista').innerHTML = items.map(it => {
      const inner = `<span class="ico">${icon(it.ico)}</span><span class="txt"><small>${it.l}</small><b>${it.v || ''}</b></span>`;
      return it.href ? `<a class="contacto-item" href="${it.href}" target="_blank" rel="noopener">${inner}</a>` : `<div class="contacto-item">${inner}</div>`;
    }).join('');
    $('#contacto-cta').innerHTML = `
      <a class="btn btn-wa" href="${waLink()}" target="_blank" rel="noopener"><span class="wa-ico">${icon('whatsapp')}</span> Pedir por WhatsApp</a>
      <a class="btn btn-crema" href="${igUrl}" target="_blank" rel="noopener">Ver Instagram</a>`;

    // Footer contacto
    $('#footer-contacto').innerHTML = `
      <a href="${waLink()}" target="_blank" rel="noopener">WhatsApp</a>
      <a href="${igUrl}" target="_blank" rel="noopener">@${(c.instagram || '').replace('@', '')}</a>
      <a href="tel:${telClean}">${c.telefono || ''}</a>
      <span style="opacity:.7">${c.horario || ''}</span>`;

    // Íconos de WhatsApp en todos los botones (estáticos + recién creados)
    document.querySelectorAll('.wa-ico').forEach(s => {
      s.innerHTML = icon('whatsapp');
      const svg = s.querySelector('svg');
      if (svg) { svg.style.width = '1.15em'; svg.style.height = '1.15em'; }
    });

    // Avisar al carrito (cart.js) que hay menú vigente para leer precios/nombres
    window.LV._data = d;
    document.dispatchEvent(new CustomEvent('lv:menu', { detail: d }));
  }

  // Primer render inmediato (caché / semilla)
  renderData(data);

  /* ---------- QR (marca) — una vez ---------- */
  try {
    const url = window.LV_SITE_URL
      ? window.LV_SITE_URL
      : (location.origin && location.origin !== 'null'
        ? location.origin + location.pathname
        : 'https://lasvirginias.pizza');
    if (window.QRious) {
      const cvs = document.createElement('canvas');
      new QRious({ element: cvs, value: url, size: 344, foreground: '#29231F', background: '#FFF7DC', level: 'M', padding: 0 });
      $('#qr-box').appendChild(cvs);
    } else {
      $('#qr-box').innerHTML = `<div style="width:172px;height:172px;display:grid;place-items:center;color:#8A1512;font-size:.8rem;text-align:center;">Escanea el menú</div>`;
    }
  } catch (e) { /* noop */ }

  /* ---------- Nav móvil (una vez) ---------- */
  const navMovil = $('#nav-movil');
  const open = () => navMovil.classList.add('open');
  const close = () => navMovil.classList.remove('open');
  $('#menu-btn').addEventListener('click', open);
  $('#nav-cerrar').addEventListener('click', close);
  navMovil.addEventListener('click', e => { if (e.target === navMovil) close(); });
  navMovil.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  /* ---------- Preferencia de movimiento ---------- */
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Hero: fotos del proyecto que rotan (crossfade suave) ---------- */
  (function heroSlideshow() {
    const frame = document.getElementById('hero-foto');
    if (!frame) return;
    const fotos = [
      { src: 'assets/pizza-tequepizza.jpg', alt: 'Tequepizza de Las Virginias, con borde de tequeño relleno de queso' },
      { src: 'assets/pizza-gemini.jpg', alt: 'Pizza Cuatro Estaciones de Las Virginias' },
      { src: 'assets/pizza-tequepizza-maiz.jpg', alt: 'Pizza casera con borde relleno de queso y maíz' },
      { src: 'assets/pizza-tocineta-maiz.jpg', alt: 'Pizza casera con tocineta y maíz' }
    ];
    const base = frame.querySelector('.hero-slide');
    if (base) base.alt = fotos[0].alt;
    fotos.slice(1).forEach(f => {
      const img = new Image();
      img.className = 'hero-slide';
      img.src = f.src; img.alt = f.alt; img.loading = 'lazy';
      frame.appendChild(img);
    });

    if (reduce) return;

    const slides = Array.from(frame.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;

    let idx = 0, timer = null;
    const HOLD = 4500;
    function next() {
      slides[idx].classList.remove('is-active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('is-active');
    }
    function play() { if (!timer) timer = setInterval(next, HOLD); }
    function pause() { if (timer) { clearInterval(timer); timer = null; } }

    let pageVisible = !document.hidden, onScreen = true;
    function update() { (pageVisible && onScreen) ? play() : pause(); }

    document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; update(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach(e => { onScreen = e.isIntersecting; });
        update();
      }, { threshold: 0.15 }).observe(frame);
    }
    update();
  })();

  /* ---------- Reveal al hacer scroll (sutil, se autolimpia) ---------- */
  (function reveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('reveal-on');

    const sels = ['.cab', '.valor', '.pizza', '.menu-nota', '.chip-bebida',
      '.teque-txt', '.teque-foto-wrap', '.arma-foto', '.arma-txt',
      '.contacto-card', '.qr-card', '.historia-sello', '.historia-grid > div:last-child'];
    const els = [];
    sels.forEach(s => document.querySelectorAll(s).forEach(el => { el.setAttribute('data-reveal', ''); els.push(el); }));

    document.querySelectorAll('.menu-grid').forEach(g =>
      Array.from(g.children).forEach((c, i) => { c.style.transitionDelay = (i * 60) + 'ms'; }));
    document.querySelectorAll('.valores-in .valor').forEach((c, i) => { c.style.transitionDelay = (i * 50) + 'ms'; });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add('is-in');
        io.unobserve(el);
        el.addEventListener('transitionend', function done(ev) {
          if (ev.propertyName !== 'opacity') return;
          el.style.transitionDelay = '';
          el.classList.remove('is-in');
          el.removeAttribute('data-reveal');
          el.removeEventListener('transitionend', done);
        });
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(el => io.observe(el));
  })();

  /* ---------- Actualización desde la nube (lo que edita el dueño) ---------- */
  API.fetchMenu().then(r => {
    if (r && r.ok && r.configured && r.data && typeof r.data === 'object') {
      saveData(r.data);      // guarda como caché para la próxima visita
      renderData(r.data);    // re-pinta con el menú vigente
    }
  });
})();
