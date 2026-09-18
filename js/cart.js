/* ============================================================
   LAS VIRGINIAS — Carrito de pedido + envío a WhatsApp
   Pide por pizza: tamaño + adicionales (máx 2 c/u, borde 1),
   arma el pedido en un panel y lo envía estructurado a WhatsApp.
   Autónomo: crea su propio DOM y escucha el menú vigente.
   ============================================================ */
(function () {
  'use strict';
  const LV = window.LV;
  if (!LV) return;
  const precio = LV.precio;
  const icon = LV.icon;

  const MAX_ADIC = 2;                 // veces por adicional en una pizza
  const CART_KEY = 'lasvirginias_cart_v1';

  /* ---------- Zonas de delivery (precio del envío) ----------
     Viven en el menú (editables por el dueño en el panel → se guardan
     en la base). Si el menú aún no las trae, se usan las del DEFAULT. */
  function deliveryZones() {
    const m = MENU.envio && Array.isArray(MENU.envio.zonas) && MENU.envio.zonas.length ? MENU.envio.zonas : null;
    const d = (LV.DEFAULT && LV.DEFAULT.envio && LV.DEFAULT.envio.zonas) || [];
    return (m || d).filter(z => z && z.id);
  }
  const zoneById = id => deliveryZones().find(z => z.id === id);
  // Los campos pueden venir como texto ("A, B, C") o como arreglo
  const zoneCampos = z => (z ? (Array.isArray(z.campos) ? z.campos.join(', ') : (z.campos || '')) : '');

  // Ícono ilustrado del adicional (fuente compartida en data.js). Si no hay
  // imagen asociada, cae al ícono SVG de línea.
  function adicIco(a) {
    const src = LV.adicImg(a);
    return src
      ? `<img class="lv-adic-img" src="${src}" alt="" loading="lazy">`
      : icon((a && a.ico) || 'porcion');
  }

  let MENU = LV._data || LV.getData();

  /* ---------- Estado del pedido ---------- */
  // line = { pizzaId, size:'mediana'|'familiar', qty:int, adic:{ [adicId]: count } }
  let cart = [];
  let drinkQty = 0;
  let view = 'cart';                  // 'cart' | 'checkout'
  let zoneOpen = false;               // desplegable de zona abierto/cerrado
  const co = { nombre: '', tipo: 'delivery', zona: '', direccion: '', nota: '' };
  // Campos obligatorios que faltaron al intentar enviar (para marcarlos en rojo)
  const coErr = { nombre: false, zona: false };

  (function loadCart() {
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      if (raw) { const s = JSON.parse(raw); cart = s.cart || []; drinkQty = s.drinkQty || 0; }
    } catch (e) { /* noop */ }
  })();
  function persist() {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify({ cart, drinkQty })); } catch (e) {}
  }

  /* ---------- Consultas de menú / precios ---------- */
  const pizzaById = id => (MENU.pizzas || []).find(p => p.id === id);
  const adicById = id => (MENU.adicionales || []).find(a => a.id === id);
  const cap = s => (s === 'familiar' ? 'Familiar' : 'Mediana');
  const maxFor = a => (a && a.unico ? 1 : MAX_ADIC);

  // Adicionales que aplican a una pizza (el borde no aplica a la Tequepizza)
  function adicFor(pizzaId) {
    return (MENU.adicionales || []).filter(a => !(a.sello && pizzaId === 'tequepizza'));
  }

  function unitPrice(line) {
    const p = pizzaById(line.pizzaId); if (!p) return 0;
    let t = Number(p[line.size]) || 0;
    Object.keys(line.adic || {}).forEach(id => {
      const a = adicById(id); if (a) t += (Number(a[line.size]) || 0) * line.adic[id];
    });
    return t;
  }
  const lineTotal = line => unitPrice(line) * line.qty;
  function cartTotal() {
    let t = cart.reduce((s, l) => s + lineTotal(l), 0);
    if (drinkQty > 0 && MENU.bebida) t += (Number(MENU.bebida.precio) || 0) * drinkQty;
    return t;
  }
  // Costo del envío: solo aplica en delivery y con una zona elegida
  function deliveryFee() {
    if (co.tipo !== 'delivery') return 0;
    const z = zoneById(co.zona);
    return z ? (Number(z.precio) || 0) : 0;
  }
  const grandTotal = () => cartTotal() + deliveryFee();
  const itemCount = () => cart.reduce((s, l) => s + l.qty, 0) + drinkQty;

  /* ---------- Feedback (toast existente) ---------- */
  let toastT = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ============================================================
     DOM raíz (FAB + panel + modal) — creado una sola vez
     ============================================================ */
  const root = document.createElement('div');
  root.id = 'lv-cart-root';
  root.innerHTML = `
    <button id="lvFab" class="lv-fab empty" type="button" aria-label="Tu pedido">
      <span class="lv-fab-ico">${icon('pizza')}</span>
      <span class="lv-fab-main">
        <span class="lv-fab-label">Haz tu pedido</span>
        <span class="lv-fab-sub" hidden></span>
      </span>
      <span class="lv-fab-count" hidden>0</span>
    </button>

    <div class="lv-scrim" id="lvScrim" hidden></div>

    <aside class="lv-drawer" id="lvDrawer" role="dialog" aria-modal="true" aria-label="Tu pedido" hidden>
      <header class="lv-drawer-head">
        <h3 id="lvDrawerTitle">Tu pedido</h3>
        <button class="lv-x" type="button" data-close-drawer aria-label="Cerrar">${icon('x')}</button>
      </header>
      <div class="lv-drawer-body" id="lvDrawerBody"></div>
      <footer class="lv-drawer-foot" id="lvDrawerFoot"></footer>
    </aside>

    <div class="lv-modal" id="lvModal" role="dialog" aria-modal="true" hidden>
      <div class="lv-modal-card">
        <button class="lv-x lv-x-modal" type="button" data-close-modal aria-label="Cerrar">${icon('x')}</button>
        <div id="lvModalBody"></div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#lvFab');
  const scrim = root.querySelector('#lvScrim');
  const drawer = root.querySelector('#lvDrawer');
  const drawerBody = root.querySelector('#lvDrawerBody');
  const drawerFoot = root.querySelector('#lvDrawerFoot');
  const drawerTitle = root.querySelector('#lvDrawerTitle');
  const modal = root.querySelector('#lvModal');
  const modalBody = root.querySelector('#lvModalBody');

  /* ---------- Bloqueo de scroll cuando algo está abierto ---------- */
  function lockScroll(on) {
    document.body.style.overflow = on ? 'hidden' : '';
  }
  function anyOpen() { return !drawer.hidden || !modal.hidden; }

  /* ---------- Botón "atrás" del móvil ----------
     Al abrir el carrito agregamos una entrada al historial. Así, cuando el
     cliente toca "atrás", solo se oculta el carrito (y el pedido se mantiene,
     guardado en sessionStorage) en vez de salir de la página. */
  let navGuard = false;
  // Evita que el navegador "restaure" el scroll al usar history.back() (nos
  // desplazaríamos solos al menú sin que el navegador nos regrese arriba).
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  function armBack() {
    if (navGuard) return;
    navGuard = true;
    try { history.pushState({ lvCart: 1 }, ''); } catch (e) {}
  }
  function disarmBack() {
    if (!navGuard) return;
    navGuard = false;
    try { history.back(); } catch (e) {}
  }
  window.addEventListener('popstate', function () {
    if (!navGuard) return;      // no era nuestra entrada de historial
    navGuard = false;           // "atrás" ya la consumió
    if (!modal.hidden) closeModal();
    if (!drawer.hidden) closeDrawer();
  });

  /* ============================================================
     FAB — estado según el pedido
     ============================================================ */
  function updateFab() {
    const n = itemCount();
    const label = fab.querySelector('.lv-fab-label');
    const sub = fab.querySelector('.lv-fab-sub');
    const count = fab.querySelector('.lv-fab-count');
    if (n === 0) {
      fab.classList.add('empty');
      label.textContent = 'Haz tu pedido';
      sub.hidden = true;
      count.hidden = true;
    } else {
      fab.classList.remove('empty');
      label.textContent = 'Finaliza tu pedido';
      sub.hidden = false;
      sub.textContent = `${n} ${n === 1 ? 'artículo' : 'artículos'} · ${precio(cartTotal())}`;
      count.hidden = false;
      count.textContent = String(n);
    }
  }
  function bumpFab() {
    fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump');
  }

  /* ============================================================
     MODAL — personalizar una pizza
     ============================================================ */
  let draft = null;         // línea en edición
  let editIndex = null;     // índice si estamos editando una línea existente

  function openCustomizer(pizzaId, idx) {
    const p = pizzaById(pizzaId);
    if (!p) return;
    editIndex = (typeof idx === 'number') ? idx : null;
    if (editIndex !== null && cart[editIndex]) {
      draft = JSON.parse(JSON.stringify(cart[editIndex]));
    } else {
      draft = { pizzaId, size: 'mediana', qty: 1, adic: {} };
    }
    renderModal();
    modal.hidden = false;
    scrim.hidden = false;
    lockScroll(true);
    requestAnimationFrame(() => { modal.classList.add('open'); scrim.classList.add('show'); });
    armBack();
  }
  function closeModal() {
    modal.classList.remove('open');
    if (drawer.hidden) scrim.classList.remove('show');
    setTimeout(() => {
      modal.hidden = true;
      if (!anyOpen()) { scrim.hidden = true; lockScroll(false); disarmBack(); }
    }, 200);
  }

  function renderModal() {
    const p = pizzaById(draft.pizzaId);
    const sub = unitPrice(draft) * draft.qty;
    const adics = adicFor(draft.pizzaId);

    modalBody.innerHTML = `
      <div class="lv-modal-hd">
        <div class="lv-modal-foto">${p.foto ? `<img src="${p.foto}" alt="${p.nombre}">` : `<div class="lv-ph">${icon(p.ico || 'porcion')}</div>`}</div>
        <div>
          <h3 class="lv-modal-nombre">${p.nombre}</h3>
          <p class="lv-modal-desc">${p.desc || ''}</p>
        </div>
      </div>

      <div class="lv-block">
        <span class="lv-block-lab">Tamaño</span>
        <div class="lv-seg">
          <button type="button" class="lv-seg-btn ${draft.size === 'mediana' ? 'on' : ''}" data-size="mediana">
            Mediana <b>${precio(p.mediana)}</b>
          </button>
          <button type="button" class="lv-seg-btn ${draft.size === 'familiar' ? 'on' : ''}" data-size="familiar">
            Familiar <b>${precio(p.familiar)}</b>
          </button>
        </div>
      </div>

      <div class="lv-block">
        <span class="lv-block-lab">Adicionales <small>(hasta ${MAX_ADIC} c/u)</small></span>
        <div class="lv-adics">
          ${adics.map(a => {
            const n = draft.adic[a.id] || 0;
            const mx = maxFor(a);
            return `
            <div class="lv-adic ${a.sello ? 'sello' : ''} ${n > 0 ? 'active' : ''}">
              <span class="lv-adic-ico">${adicIco(a)}</span>
              <span class="lv-adic-txt">
                <b>${a.nombre}${a.sello ? ' <em>· el sello de la casa</em>' : ''}</b>
                <small>+${precio(a[draft.size])}${a.unico ? ' · 1 por pizza' : ''}</small>
              </span>
              <span class="lv-stepper">
                <button type="button" class="lv-step" data-adic-dec="${a.id}" ${n <= 0 ? 'disabled' : ''} aria-label="Quitar ${a.nombre}">−</button>
                <span class="lv-step-n">${n}</span>
                <button type="button" class="lv-step" data-adic-inc="${a.id}" ${n >= mx ? 'disabled' : ''} aria-label="Agregar ${a.nombre}">+</button>
              </span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="lv-modal-foot">
        <div class="lv-qtybox">
          <span class="lv-block-lab">Cantidad</span>
          <span class="lv-stepper big">
            <button type="button" class="lv-step" data-qty-dec ${draft.qty <= 1 ? 'disabled' : ''} aria-label="Menos">−</button>
            <span class="lv-step-n">${draft.qty}</span>
            <button type="button" class="lv-step" data-qty-inc aria-label="Más">+</button>
          </span>
        </div>
        <button type="button" class="btn btn-rojo lv-add-btn" data-confirm>
          ${editIndex !== null ? 'Guardar cambios' : 'Agregar al pedido'} · <b>${precio(sub)}</b>
        </button>
      </div>`;
  }

  modalBody.addEventListener('click', (e) => {
    const t = e.target.closest('[data-size],[data-adic-inc],[data-adic-dec],[data-qty-inc],[data-qty-dec],[data-confirm]');
    if (!t) return;

    if (t.hasAttribute('data-size')) { draft.size = t.getAttribute('data-size'); return renderModal(); }
    if (t.hasAttribute('data-qty-inc')) { draft.qty++; return renderModal(); }
    if (t.hasAttribute('data-qty-dec')) { if (draft.qty > 1) draft.qty--; return renderModal(); }

    if (t.hasAttribute('data-adic-inc')) {
      const id = t.getAttribute('data-adic-inc');
      const mx = maxFor(adicById(id));
      draft.adic[id] = Math.min(mx, (draft.adic[id] || 0) + 1);
      return renderModal();
    }
    if (t.hasAttribute('data-adic-dec')) {
      const id = t.getAttribute('data-adic-dec');
      draft.adic[id] = Math.max(0, (draft.adic[id] || 0) - 1);
      if (draft.adic[id] === 0) delete draft.adic[id];
      return renderModal();
    }
    if (t.hasAttribute('data-confirm')) {
      if (editIndex !== null) { cart[editIndex] = draft; toast('Pedido actualizado ✏️'); }
      else { cart.push(draft); toast(`${pizzaById(draft.pizzaId).nombre} agregada 🍕`); }
      persist(); updateFab(); bumpFab();
      closeModal();
      if (!drawer.hidden) renderDrawer();
    }
  });

  /* ============================================================
     DRAWER — revisar pedido y finalizar
     ============================================================ */
  function openDrawer(startView) {
    view = startView || 'cart';
    renderDrawer();
    drawer.hidden = false;
    scrim.hidden = false;
    lockScroll(true);
    requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('show'); });
    armBack();
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    if (modal.hidden) scrim.classList.remove('show');
    setTimeout(() => {
      drawer.hidden = true;
      if (!anyOpen()) { scrim.hidden = true; lockScroll(false); disarmBack(); }
    }, 260);
  }

  function lineSummary(line) {
    const parts = [];
    Object.keys(line.adic || {}).forEach(id => {
      const a = adicById(id); const n = line.adic[id];
      if (a && n > 0) parts.push(`${a.nombre}${n > 1 ? ` ×${n}` : ''}`);
    });
    return parts;
  }

  function renderDrawer() {
    if (view === 'checkout') return renderCheckout();
    drawerTitle.textContent = 'Tu pedido';

    if (cart.length === 0 && drinkQty === 0) {
      drawerBody.innerHTML = `
        <div class="lv-empty">
          <div class="lv-empty-ico">${icon('pizza')}</div>
          <p><b>Tu pedido está vacío</b></p>
          <p class="muted">Elige una pizza del menú para empezar a armarlo.</p>
          <button type="button" class="btn btn-rojo" data-see-menu>Ver el menú</button>
        </div>`;
      drawerFoot.innerHTML = '';
      return;
    }

    const lines = cart.map((line, i) => {
      const p = pizzaById(line.pizzaId);
      if (!p) return '';
      const extras = lineSummary(line);
      return `
        <div class="lv-line">
          <div class="lv-line-top">
            <div class="lv-line-info">
              <b class="lv-line-nom">${p.nombre}</b>
              <span class="lv-line-size">${cap(line.size)}</span>
              ${extras.length ? `<ul class="lv-line-extras">${extras.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
            </div>
            <div class="lv-line-price">${precio(lineTotal(line))}</div>
          </div>
          <div class="lv-line-actions">
            <span class="lv-stepper sm">
              <button type="button" class="lv-step" data-line-dec="${i}" aria-label="Menos">−</button>
              <span class="lv-step-n">${line.qty}</span>
              <button type="button" class="lv-step" data-line-inc="${i}" aria-label="Más">+</button>
            </span>
            <button type="button" class="lv-link" data-line-edit="${i}">Editar</button>
            <button type="button" class="lv-link danger" data-line-del="${i}">Quitar</button>
          </div>
        </div>`;
    }).join('');

    const drinkBlock = MENU.bebida && MENU.bebida.nombre ? `
      <div class="lv-drink">
        <span class="lv-drink-ico">${adicIco(MENU.bebida)}</span>
        <span class="lv-drink-txt"><b>${MENU.bebida.nombre}</b><small>${precio(MENU.bebida.precio)} c/u</small></span>
        <span class="lv-stepper sm">
          <button type="button" class="lv-step" data-drink-dec ${drinkQty <= 0 ? 'disabled' : ''} aria-label="Menos">−</button>
          <span class="lv-step-n">${drinkQty}</span>
          <button type="button" class="lv-step" data-drink-inc aria-label="Más">+</button>
        </span>
      </div>` : '';

    drawerBody.innerHTML = `<div class="lv-lines">${lines}</div>${drinkBlock}
      <button type="button" class="lv-addmore" data-see-menu>＋ Agregar otra pizza</button>`;

    drawerFoot.innerHTML = `
      <div class="lv-total"><span>Total</span><b>${precio(cartTotal())}</b></div>
      <button type="button" class="btn btn-wa lv-finalize" data-go-checkout>
        <span class="wa-ico">${icon('whatsapp')}</span> Finalizar pedido
      </button>`;
    document.querySelectorAll('#lvDrawerFoot .wa-ico svg').forEach(s => { s.style.width = '1.2em'; s.style.height = '1.2em'; });
  }

  function renderCheckout() {
    drawerTitle.textContent = 'Últimos datos';
    const isDelivery = co.tipo === 'delivery';
    const zsel = zoneById(co.zona);
    drawerBody.innerHTML = `
      <div class="lv-co">
        <label class="lv-field ${coErr.nombre ? 'err' : ''}">
          <span>Tu nombre <small>· obligatorio</small></span>
          <input type="text" id="coNombre" placeholder="¿Cómo te llamas?" value="${co.nombre.replace(/"/g, '&quot;')}" autocomplete="name">
          ${coErr.nombre ? '<em class="lv-field-err">Escribe tu nombre para hacer el pedido</em>' : ''}
        </label>

        <div class="lv-field">
          <span>¿Cómo lo quieres?</span>
          <div class="lv-seg">
            <button type="button" class="lv-seg-btn ${isDelivery ? 'on' : ''}" data-tipo="delivery">🛵 Delivery</button>
            <button type="button" class="lv-seg-btn ${!isDelivery ? 'on' : ''}" data-tipo="takeaway">🏠 Take away</button>
          </div>
        </div>

        ${isDelivery ? `
        <div class="lv-field ${coErr.zona ? 'err' : ''}">
          <span>¿A qué campo vamos? <small>· obligatorio</small></span>
          <button type="button" class="lv-zone-toggle ${zsel ? 'sel' : ''} ${zoneOpen ? 'open' : ''}" data-zone-toggle>
            <span class="lv-zone-cur">${zsel ? zoneCampos(zsel) : 'Elige tu zona de entrega'}</span>
            <span class="lv-zone-caret" aria-hidden="true">▾</span>
          </button>
          ${zoneOpen ? `
          <div class="lv-zone-list">
            ${deliveryZones().map(z => `
              <button type="button" class="lv-zone-opt ${co.zona === z.id ? 'on' : ''}" data-zone="${z.id}">
                <span class="lv-zone-radio" aria-hidden="true"></span>
                <span class="lv-zone-campos">${zoneCampos(z)}</span>
              </button>`).join('')}
          </div>` : ''}
          ${coErr.zona ? '<em class="lv-field-err">Elige a qué campo llevamos tu pedido</em>' : ''}
        </div>

        <label class="lv-field">
          <span>Dirección <small>(opcional)</small></span>
          <input type="text" id="coDir" placeholder="Sector, calle, casa/referencia" value="${co.direccion.replace(/"/g, '&quot;')}" autocomplete="street-address">
        </label>` : ''}

        <label class="lv-field">
          <span>Nota <small>(opcional)</small></span>
          <input type="text" id="coNota" placeholder="Ej: sin cebolla, tocar el timbre…" value="${co.nota.replace(/"/g, '&quot;')}">
        </label>

        <div class="lv-co-tot">
          <div class="lv-co-row"><span>Subtotal · ${itemCount()} ${itemCount() === 1 ? 'artículo' : 'artículos'}</span><span>${precio(cartTotal())}</span></div>
          ${isDelivery ? `<div class="lv-co-row"><span>Delivery${zsel ? '' : ' <em>· elige zona</em>'}</span><span>${zsel ? precio(deliveryFee()) : '—'}</span></div>` : ''}
          <div class="lv-co-row lv-co-grand"><b>Total</b><b>${precio(grandTotal())}</b></div>
        </div>
      </div>`;

    drawerFoot.innerHTML = `
      <button type="button" class="lv-link back" data-back-cart>← Volver al pedido</button>
      <button type="button" class="btn btn-wa lv-finalize" data-send>
        <span class="wa-ico">${icon('whatsapp')}</span> Enviar por WhatsApp
      </button>`;
    document.querySelectorAll('#lvDrawerFoot .wa-ico svg').forEach(s => { s.style.width = '1.2em'; s.style.height = '1.2em'; });

    // Guardar lo que se escribe (sin re-render en cada tecla)
    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => { co[key] = el.value; }); };
    bind('coDir', 'direccion'); bind('coNota', 'nota');
    // Nombre: además de guardar, quita la marca de error apenas escriba algo
    const elN = document.getElementById('coNombre');
    if (elN) elN.addEventListener('input', () => {
      co.nombre = elN.value;
      if (coErr.nombre && co.nombre.trim()) {
        coErr.nombre = false;
        const f = elN.closest('.lv-field'); if (f) f.classList.remove('err');
        const m = f && f.querySelector('.lv-field-err'); if (m) m.remove();
      }
    });
  }

  function syncCheckoutFromDOM() {
    const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
    const n = g('coNombre'); if (n !== undefined) co.nombre = n;
    const d = g('coDir'); if (d !== undefined) co.direccion = d;
    const t = g('coNota'); if (t !== undefined) co.nota = t;
  }

  // Delegación de eventos del panel
  drawerBody.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const num = attr => t.hasAttribute(attr) ? parseInt(t.getAttribute(attr), 10) : null;

    if (t.hasAttribute('data-see-menu')) { goToMenu(); return; }
    if (t.hasAttribute('data-line-inc')) { const i = num('data-line-inc'); cart[i].qty++; persist(); updateFab(); renderDrawer(); return; }
    if (t.hasAttribute('data-line-dec')) { const i = num('data-line-dec'); if (cart[i].qty > 1) { cart[i].qty--; } else { cart.splice(i, 1); } persist(); updateFab(); renderDrawer(); return; }
    if (t.hasAttribute('data-line-del')) { const i = num('data-line-del'); cart.splice(i, 1); persist(); updateFab(); renderDrawer(); return; }
    if (t.hasAttribute('data-line-edit')) { const i = num('data-line-edit'); openCustomizer(cart[i].pizzaId, i); return; }
    if (t.hasAttribute('data-drink-inc')) { drinkQty++; persist(); updateFab(); renderDrawer(); return; }
    if (t.hasAttribute('data-drink-dec')) { if (drinkQty > 0) drinkQty--; persist(); updateFab(); renderDrawer(); return; }
    if (t.hasAttribute('data-tipo')) { syncCheckoutFromDOM(); co.tipo = t.getAttribute('data-tipo'); if (co.tipo !== 'delivery') zoneOpen = false; renderCheckout(); return; }
    if (t.hasAttribute('data-zone-toggle')) { syncCheckoutFromDOM(); zoneOpen = !zoneOpen; renderCheckout(); return; }
    if (t.hasAttribute('data-zone')) { syncCheckoutFromDOM(); co.zona = t.getAttribute('data-zone'); coErr.zona = false; zoneOpen = false; renderCheckout(); return; }
  });

  drawerFoot.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-go-checkout')) { if (itemCount() === 0) { toast('Agrega algo primero 🍕'); return; } view = 'checkout'; renderDrawer(); return; }
    if (t.hasAttribute('data-back-cart')) { syncCheckoutFromDOM(); view = 'cart'; renderDrawer(); return; }
    if (t.hasAttribute('data-send')) { syncCheckoutFromDOM(); sendToWhatsApp(); return; }
  });

  function scrollToMenu() {
    const el = document.getElementById('menu');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Cierra el carrito y, cuando terminó de cerrarse (scroll del body ya
  // liberado y el history.back() consumido), lleva al menú.
  function goToMenu() {
    closeDrawer();
    setTimeout(scrollToMenu, 300);
  }

  /* ============================================================
     WhatsApp — mensaje estructurado y legible
     ============================================================ */
  function waNumber() {
    return String((MENU.contacto && MENU.contacto.whatsapp) || '').replace(/[^\d]/g, '');
  }
  function buildMessage() {
    const L = [];
    L.push('🍕 *NUEVO PEDIDO — LAS VIRGINIAS*');
    L.push('_El sabor de casa_');
    L.push('');
    cart.forEach((line, i) => {
      const p = pizzaById(line.pizzaId); if (!p) return;
      L.push(`*${i + 1}. ${p.nombre} — ${cap(line.size)}*  ×${line.qty}`);
      lineSummary(line).forEach(x => L.push(`   • ${x}`));
      L.push(`   _${precio(lineTotal(line))}_`);
      L.push('');
    });
    if (drinkQty > 0 && MENU.bebida) {
      L.push('*Bebidas*');
      L.push(`   • ${MENU.bebida.nombre} ×${drinkQty} — ${precio((Number(MENU.bebida.precio) || 0) * drinkQty)}`);
      L.push('');
    }
    L.push('━━━━━━━━━━━━━');
    const zsel = zoneById(co.zona);
    if (co.tipo === 'delivery' && zsel) {
      L.push(`Subtotal: ${precio(cartTotal())}`);
      L.push(`Delivery: ${precio(deliveryFee())}`);
    }
    L.push(`*TOTAL: ${precio(grandTotal())}*`);
    L.push('');
    if (co.nombre.trim()) L.push(`👤 *Cliente:* ${co.nombre.trim()}`);
    if (co.tipo === 'delivery') {
      L.push('🛵 *Entrega:* Delivery');
      if (zsel) L.push(`📍 *Zona:* ${zoneCampos(zsel)}`);
      if (co.direccion.trim()) L.push(`📍 *Dirección:* ${co.direccion.trim()}`);
    } else {
      L.push('🏠 *Entrega:* Take away (retiro)');
    }
    if (co.nota.trim()) L.push(`📝 *Nota:* ${co.nota.trim()}`);
    return L.join('\n');
  }
  function clearOrder() {
    cart = [];
    drinkQty = 0;
    co.zona = '';
    co.direccion = '';
    co.nota = '';
    zoneOpen = false;
    coErr.nombre = false;
    coErr.zona = false;
    view = 'cart';
    persist();
    updateFab();
  }
  function sendToWhatsApp() {
    if (itemCount() === 0) { toast('Tu pedido está vacío 🍕'); return; }
    // Campos obligatorios: nombre (siempre) y zona (solo en delivery)
    coErr.nombre = !co.nombre.trim();
    coErr.zona = (co.tipo === 'delivery' && !zoneById(co.zona));
    if (coErr.nombre || coErr.zona) {
      if (coErr.zona) zoneOpen = true;
      renderCheckout();
      if (coErr.nombre) {
        const el = document.getElementById('coNombre'); if (el) el.focus();
        toast('Escribe tu nombre para hacer el pedido ✍️');
      } else {
        toast('Elige a qué campo llevamos tu pedido 🛵');
      }
      return;
    }
    const num = waNumber();
    const msg = encodeURIComponent(buildMessage());
    const url = num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank', 'noopener');
    toast('Abriendo WhatsApp… ¡gracias! 🙌');
    // Vaciar el pedido para que el cliente pueda armar otro enseguida
    clearOrder();
    closeDrawer();
  }

  /* ============================================================
     Cableado global
     ============================================================ */
  fab.addEventListener('click', () => openDrawer('cart'));
  root.querySelector('[data-close-drawer]').addEventListener('click', closeDrawer);
  root.querySelector('[data-close-modal]').addEventListener('click', closeModal);
  scrim.addEventListener('click', () => { if (!modal.hidden) closeModal(); else closeDrawer(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeModal();
    else if (!drawer.hidden) closeDrawer();
  });

  // Botones "Agregar" de las tarjetas de pizza y de la bebida (delegación)
  document.addEventListener('click', (e) => {
    const openCart = e.target.closest('[data-open-cart]');
    if (openCart) { e.preventDefault(); openDrawer('cart'); return; }
    const add = e.target.closest('[data-add]');
    if (add) { openCustomizer(add.getAttribute('data-add')); return; }
    const drink = e.target.closest('[data-add-drink]');
    if (drink) { drinkQty++; persist(); updateFab(); bumpFab(); toast(`${MENU.bebida.nombre} agregada 🥤`); return; }
  });

  // El menú puede re-pintarse (caché → nube): refrescar datos y panel abierto
  document.addEventListener('lv:menu', (e) => {
    if (e.detail && typeof e.detail === 'object') MENU = e.detail;
    // limpiar líneas cuyo id de pizza ya no exista
    cart = cart.filter(l => pizzaById(l.pizzaId));
    persist(); updateFab();
    if (!drawer.hidden) renderDrawer();
  });

  updateFab();
})();
