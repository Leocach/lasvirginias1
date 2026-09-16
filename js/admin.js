/* ============================================================
   LAS VIRGINIAS — Panel de dueños (lógica)
   ============================================================ */
(function () {
  'use strict';
  const { getData, saveData, resetData, precio, icon, API } = window.LV;
  const B = window.LVBrand;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Config de acceso ----------
     NOTA: en un sitio autónomo (sin servidor) esto es una barrera
     básica, no seguridad real. La contraseña queda del lado del cliente.
     Cuando exista backend se reemplaza por login real. */
  const ADMIN_PASS = 'lasvirginias';           // ← sólo modo demo (sin backend). En producción manda OWNER_PASSWORD.
  const SESSION_KEY = 'lv_admin_ok';
  const OWNER_PASS_KEY = 'lv_owner_pass';      // contraseña del dueño en esta sesión (para autorizar guardados)
  const ownerPass = () => { try { return sessionStorage.getItem(OWNER_PASS_KEY) || ''; } catch (e) { return ''; } };

  /* ---------- Estado ---------- */
  let work = getData();          // copia de trabajo editable
  let fotoTargetIdx = -1;        // índice de pizza al subir foto
  let ia = { productId: work.pizzas[0] ? work.pizzas[0].id : null, intent: 'producto', format: 'feed', variant: 0, last: null };
  const galeria = [];            // piezas de esta sesión (en memoria)

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------- Pulso de confirmación al guardar ---------- */
  function pulse(btn) {
    if (!btn) return;
    btn.classList.remove('guardado');
    void btn.offsetWidth; // reinicia la animación
    btn.classList.add('guardado');
  }

  /* ---------- Escape helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  /* ============================================================
     LOGIN
     ============================================================ */
  function isLogged() { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } }
  function showShell() { $('#login').classList.add('oculto'); $('#shell').classList.remove('oculto'); initShell(); }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = $('#pass').value;
    const btn = $('#login-form button[type="submit"]');
    const errEl = $('#login-err');
    errEl.textContent = '';
    if (btn) { btn.disabled = true; }

    function enterOk(savePass) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
        if (savePass) sessionStorage.setItem(OWNER_PASS_KEY, val);
      } catch (e2) {}
      showShell();
    }
    function demoFallback(msg) {
      // Sin backend configurado o sin conexión → modo demo local
      if (val === ADMIN_PASS) enterOk(false);
      else errEl.textContent = msg;
    }

    try {
      const res = await API.login(val);
      if (res.ok) {
        enterOk(true);                       // login real: guardamos la clave para autorizar guardados
      } else if (res.status === 401) {
        errEl.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
        $('#pass').select();
      } else {
        // Backend no disponible / no configurado (404, 5xx, red, configured:false) → modo demo
        demoFallback('Aún no hay backend disponible. En modo demo, usa la contraseña por defecto del README.');
      }
    } catch (err) {
      demoFallback('No se pudo validar. Intenta de nuevo.');
    } finally {
      if (btn) { btn.disabled = false; }
    }
  });
  $('#logout').addEventListener('click', () => {
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(OWNER_PASS_KEY); } catch (e) {}
    location.reload();
  });

  /* ============================================================
     SHELL (se inicializa una vez logueado)
     ============================================================ */
  let shellReady = false;
  async function initShell() {
    if (shellReady) return; shellReady = true;

    // iconos
    $('#ia-intro-ico').innerHTML = icon('ia');
    $('#gen-ico').innerHTML = icon('ia'); tuneIco('#gen-ico', '1.15em');
    $('#dl-ico').innerHTML = icon('descargar'); tuneIco('#dl-ico', '1.1em');

    // Tabs
    $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // Cargar el menú vigente desde la nube (si existe) para editar lo real
    try {
      const r = await API.fetchMenu();
      if (r && r.ok && r.configured && r.data && typeof r.data === 'object') {
        work = Object.assign(getData(), r.data);   // remoto sobre defaults, por si faltan campos
        saveData(work);                            // caché local
      }
    } catch (e) { /* seguimos con la copia local */ }

    renderMenuTab();
    renderIaTab();
    renderAjustes();
    bindMenuActions();
    bindIaActions();
    bindAjustes();
  }
  function tuneIco(sel, size) { const svg = $(sel + ' svg'); if (svg) { svg.style.width = size; svg.style.height = size; } }

  function switchTab(name) {
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============================================================
     TAB MENÚ — render
     ============================================================ */
  function pizzaCard(p, i) {
    const foto = p.foto
      ? '<img class="thumb" src="' + attr(p.foto) + '" alt="">'
      : '<div class="thumb-ph">' + icon(p.ico || 'porcion') + '</div>';
    const quitar = p.foto ? '<button type="button" data-act="quitarfoto" data-idx="' + i + '">Quitar</button>' : '';
    return '' +
      '<div class="edit-card ' + (p.disponible ? '' : 'off') + '" data-idx="' + i + '">' +
        '<div class="edit-foto">' +
          foto +
          '<div class="foto-acc">' +
            '<button type="button" data-act="foto" data-idx="' + i + '">Cambiar foto</button>' + quitar +
          '</div>' +
        '</div>' +
        '<div class="edit-body">' +
          '<div class="row-top">' +
            '<label class="toggle"><input type="checkbox" class="f-disp" ' + (p.disponible ? 'checked' : '') + '>' +
              '<span class="track"></span><span class="disp-lbl">' + (p.disponible ? 'Disponible' : 'Agotada') + '</span></label>' +
            '<button class="edit-del" type="button" data-act="delpizza" data-idx="' + i + '">' + icon('x') + ' Eliminar</button>' +
          '</div>' +
          '<div class="field"><label>Nombre</label><input class="f-nombre" value="' + attr(p.nombre) + '"></div>' +
          '<div class="field"><label>Descripción</label><textarea class="f-desc">' + esc(p.desc) + '</textarea></div>' +
          '<div class="grid-3">' +
            '<div class="field"><label>Mediana ($)</label><input class="f-med" type="number" step="0.5" min="0" value="' + esc(p.mediana) + '"></div>' +
            '<div class="field"><label>Familiar ($)</label><input class="f-fam" type="number" step="0.5" min="0" value="' + esc(p.familiar) + '"></div>' +
            '<div class="field"><label>Etiqueta</label><select class="f-badge">' +
              '<option value="">Sin etiqueta</option>' +
              '<option value="estrella" ' + (p.badge === 'estrella' ? 'selected' : '') + '>★ La estrella</option>' +
              '<option value="top" ' + (p.badge === 'top' ? 'selected' : '') + '>El más pedido</option>' +
            '</select></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function adicRow(a, i) {
    return '' +
      '<div class="row-simple" data-idx="' + i + '">' +
        '<div class="field"><label>Adicional</label><input class="a-nombre" value="' + attr(a.nombre) + '"></div>' +
        '<div class="field"><label>Mediana ($)</label><input class="a-med" type="number" step="0.5" min="0" value="' + esc(a.mediana) + '"></div>' +
        '<div class="field"><label>Familiar ($)</label><input class="a-fam" type="number" step="0.5" min="0" value="' + esc(a.familiar) + '"></div>' +
        '<button class="del-x" type="button" data-act="deladic" data-idx="' + i + '" title="Eliminar">' + icon('x') + '</button>' +
      '</div>';
  }

  function renderMenuTab() {
    $('#pizzas-list').innerHTML = work.pizzas.map(pizzaCard).join('');
    $('#adic-list').innerHTML = work.adicionales.map(adicRow).join('');
    $('#bebida-nombre').value = work.bebida ? work.bebida.nombre : '';
    $('#bebida-precio').value = work.bebida ? work.bebida.precio : '';
    $('#borde-nota').value = work.bordeNota || '';
  }

  /* ---------- Sincroniza DOM → work (antes de re-render o guardar) ---------- */
  function syncFromDOM() {
    $$('#pizzas-list .edit-card').forEach(card => {
      const i = +card.dataset.idx; const p = work.pizzas[i]; if (!p) return;
      p.nombre = $('.f-nombre', card).value.trim();
      p.desc = $('.f-desc', card).value.trim();
      p.mediana = num($('.f-med', card).value);
      p.familiar = num($('.f-fam', card).value);
      p.badge = $('.f-badge', card).value;
      p.disponible = $('.f-disp', card).checked;
    });
    $$('#adic-list .row-simple').forEach(row => {
      const i = +row.dataset.idx; const a = work.adicionales[i]; if (!a) return;
      a.nombre = $('.a-nombre', row).value.trim();
      a.mediana = num($('.a-med', row).value);
      a.familiar = num($('.a-fam', row).value);
    });
    if (!work.bebida) work.bebida = {};
    work.bebida.nombre = $('#bebida-nombre').value.trim();
    work.bebida.precio = num($('#bebida-precio').value);
    work.bordeNota = $('#borde-nota').value.trim();
  }
  function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  const slug = (s) => (s || 'item').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

  /* ---------- Acciones del menú ---------- */
  function bindMenuActions() {
    // Delegación de clics
    $('#tab-menu').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const act = btn.dataset.act, i = +btn.dataset.idx;
      if (act === 'foto') { fotoTargetIdx = i; fotoInput.click(); }
      else if (act === 'quitarfoto') { syncFromDOM(); work.pizzas[i].foto = ''; renderMenuTab(); }
      else if (act === 'delpizza') {
        if (confirm('¿Eliminar "' + (work.pizzas[i].nombre || 'esta pizza') + '"?')) { syncFromDOM(); work.pizzas.splice(i, 1); renderMenuTab(); toast('Pizza eliminada (recuerda Guardar).'); }
      }
      else if (act === 'deladic') { syncFromDOM(); work.adicionales.splice(i, 1); renderMenuTab(); }
    });

    // Toggle disponible → refleja etiqueta al instante
    $('#pizzas-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('f-disp')) {
        const card = e.target.closest('.edit-card');
        card.classList.toggle('off', !e.target.checked);
        $('.disp-lbl', card).textContent = e.target.checked ? 'Disponible' : 'Agotada';
      }
    });

    $('#add-pizza').addEventListener('click', () => {
      syncFromDOM();
      work.pizzas.push({ id: 'pizza-' + Date.now(), nombre: 'Nueva pizza', ico: 'porcion', desc: '', mediana: 0, familiar: 0, foto: '', badge: '', disponible: true });
      renderMenuTab();
      const cards = $$('#pizzas-list .edit-card'); const last = cards[cards.length - 1];
      last.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('.f-nombre', last).select();
    });
    $('#add-adic').addEventListener('click', () => {
      syncFromDOM();
      work.adicionales.push({ id: 'adic-' + Date.now(), nombre: 'Nuevo adicional', ico: 'queso', mediana: 0, familiar: 0 });
      renderMenuTab();
    });

    $('#save-menu').addEventListener('click', async () => {
      syncFromDOM();
      // normaliza ids
      work.pizzas.forEach(p => { if (!p.id) p.id = slug(p.nombre); });
      saveData(work);                 // caché local siempre
      renderIaTab();                  // refresca miniaturas de la pestaña IA

      const btn = $('#save-menu');
      btn.disabled = true;
      const res = await API.save(work, ownerPass());
      btn.disabled = false;

      if (res.ok) {
        toast('¡Menú guardado! ✓  Ya se ve para todos los clientes.');
        $('#estado-menu').textContent = 'Guardado en la nube. Todos los clientes verán los cambios.';
        pulse(btn);
      } else if (res.configured === false || res.error === 'no_store' || res.error === 'no_password') {
        toast('Guardado solo en este equipo (el backend aún no está configurado).');
        $('#estado-menu').textContent = 'Guardado local. Falta terminar de configurar el backend en Vercel.';
        pulse(btn);
      } else if (res.status === 401) {
        toast('Tu sesión expiró. Cierra sesión y entra de nuevo con tu contraseña.');
      } else {
        toast('No se pudo guardar en la nube. Quedó guardado en este equipo.');
      }
    });

    $('#reset-menu').addEventListener('click', () => {
      if (confirm('¿Restablecer el menú a los valores originales? Se perderán tus cambios guardados.')) {
        work = resetData(); renderMenuTab(); renderIaTab(); toast('Menú restablecido.');
      }
    });
  }

  /* ---------- Carga y reduce fotos ---------- */
  const fotoInput = document.createElement('input');
  fotoInput.type = 'file'; fotoInput.accept = 'image/*'; fotoInput.style.display = 'none';
  document.body.appendChild(fotoInput);
  fotoInput.addEventListener('change', () => {
    const file = fotoInput.files && fotoInput.files[0]; fotoInput.value = '';
    if (!file || fotoTargetIdx < 0) return;
    reduceImage(file, 1000, 0.82).then(dataUrl => {
      syncFromDOM();
      work.pizzas[fotoTargetIdx].foto = dataUrl;
      renderMenuTab();
      toast('Foto lista (recuerda Guardar).');
    }).catch(() => toast('No se pudo leer la imagen.'));
  });

  function reduceImage(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = fr.result;
      };
      fr.onerror = reject; fr.readAsDataURL(file);
    });
  }

  /* ============================================================
     TAB IA — render
     ============================================================ */
  function renderIaTab() {
    // 1) productos (incluye opción "General / marca")
    const chips = [];
    chips.push(iaChip({ id: null, nombre: 'General', foto: '', ico: 'estrella' }, ia.productId === null));
    work.pizzas.forEach(p => chips.push(iaChip(p, ia.productId === p.id)));
    $('#prod-pick').innerHTML = chips.join('');

    // 2) intención
    $('#intent-choices').innerHTML = Object.keys(B.INTENTS).map(k => {
      const it = B.INTENTS[k], sel = ia.intent === k ? ' sel' : '';
      return '<div class="choice' + sel + '" role="button" tabindex="0" aria-pressed="' + (sel ? 'true' : 'false') + '" data-intent="' + k + '"><span class="dot"></span><span><b>' + it.label + '</b><small>' + it.hint + '</small></span></div>';
    }).join('');

    // 4) formato
    $('#format-seg').innerHTML = Object.keys(B.FORMATS).map(k => {
      const f = B.FORMATS[k], sel = ia.format === k ? ' sel' : '';
      return '<button type="button" class="' + sel.trim() + '" data-format="' + k + '">' + f.label + '<small>' + f.ratio + '</small></button>';
    }).join('');
  }
  function iaChip(p, sel) {
    const pf = p.foto ? '<img class="pf" src="' + attr(p.foto) + '" alt="">' : '<div class="pf-ph">' + icon(p.ico || 'porcion') + '</div>';
    return '<div class="prod-chip' + (sel ? ' sel' : '') + '" role="button" tabindex="0" aria-pressed="' + (sel ? 'true' : 'false') + '" data-pid="' + (p.id == null ? '' : attr(p.id)) + '">' + pf + '<span>' + esc(p.nombre) + '</span></div>';
  }

  function bindIaActions() {
    // Activa por teclado los chips/opciones (son role="button")
    function keyActivate(e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.prod-chip, .choice')) {
        e.preventDefault(); e.target.click();
      }
    }
    $('#prod-pick').addEventListener('keydown', keyActivate);
    $('#intent-choices').addEventListener('keydown', keyActivate);

    $('#prod-pick').addEventListener('click', (e) => {
      const chip = e.target.closest('.prod-chip'); if (!chip) return;
      ia.productId = chip.dataset.pid === '' ? null : chip.dataset.pid;
      ia.variant = 0;
      $$('#prod-pick .prod-chip').forEach(c => { const on = c === chip; c.classList.toggle('sel', on); c.setAttribute('aria-pressed', on); });
    });
    $('#intent-choices').addEventListener('click', (e) => {
      const ch = e.target.closest('.choice'); if (!ch) return;
      ia.intent = ch.dataset.intent; ia.variant = 0;
      $$('#intent-choices .choice').forEach(c => { const on = c === ch; c.classList.toggle('sel', on); c.setAttribute('aria-pressed', on); });
    });
    $('#format-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      ia.format = b.dataset.format;
      $$('#format-seg button').forEach(x => x.classList.toggle('sel', x === b));
    });
    $('#btn-generar').addEventListener('click', () => runGenerate(false));
    $('#btn-regenerar').addEventListener('click', () => runGenerate(true));
    $('#btn-descargar').addEventListener('click', descargar);
  }

  function currentProduct() {
    if (ia.productId == null) return null;
    return work.pizzas.find(p => p.id === ia.productId) || null;
  }

  let generating = false;
  async function runGenerate(isRegen) {
    if (generating) return; generating = true;
    if (isRegen) ia.variant++; else ia.variant = 0;

    const wrap = $('#ia-canvas-wrap');
    const load = document.createElement('div');
    load.className = 'ia-loading';
    load.innerHTML = '<div class="box"><div class="spinner"></div><p id="ia-status">Preparando…</p></div>';
    wrap.appendChild(load);
    $('#btn-generar').disabled = true; $('#btn-regenerar').disabled = true;

    const detalle = $('#ia-detalle-txt').value;
    try {
      const result = await B.generate({
        product: currentProduct(), intent: ia.intent, detail: detalle, format: ia.format, variant: ia.variant
      }, (m) => { const s = $('#ia-status'); if (s) s.textContent = m; });

      ia.last = result;
      $('#ia-empty') && ($('#ia-empty').style.display = 'none');
      wrap.querySelectorAll('img').forEach(x => x.remove());
      const img = new Image(); img.src = result.dataUrl; img.alt = 'Pieza generada';
      wrap.insertBefore(img, load);

      // info + acciones
      const badge = '<span class="modo-badge ' + result.modo + '">' + (result.modo === 'api' ? 'IA · Kie AI' : 'Modo demo') + '</span>';
      $('#ia-result-info').innerHTML =
        '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.8rem;flex-wrap:wrap;">' + badge +
        '<span style="font-size:.85rem;color:var(--texto-suave);">' + B.FORMATS[ia.format].label + ' · ' + B.FORMATS[ia.format].ratio + '</span></div>' +
        (result.aviso ? '<div class="aviso">' + esc(result.aviso) + '</div>' : '') +
        '<details class="ia-detalle"><summary>Ver prompt de marca (detalle técnico)</summary><pre>' + esc(result.prompt) + '</pre></details>';
      $('#ia-result-acc').classList.remove('oculto');

      // galería de sesión
      galeria.unshift(result.dataUrl); if (galeria.length > 8) galeria.pop();
      renderGaleria();
    } catch (err) {
      console.error(err); toast('Hubo un problema al generar. Intenta de nuevo.');
    } finally {
      load.remove(); generating = false;
      $('#btn-generar').disabled = false; $('#btn-regenerar').disabled = false;
    }
  }

  function renderGaleria() {
    $('#ia-galeria').innerHTML = galeria.map((d, i) => '<img src="' + d + '" data-gi="' + i + '" alt="Pieza ' + (i + 1) + '">').join('');
  }
  $('#tab-ia') && document.addEventListener('click', (e) => {
    const g = e.target.closest('#ia-galeria img'); if (!g) return;
    const d = galeria[+g.dataset.gi]; if (!d) return;
    const wrap = $('#ia-canvas-wrap'); wrap.querySelectorAll('img').forEach(x => x.remove());
    $('#ia-empty') && ($('#ia-empty').style.display = 'none');
    const img = new Image(); img.src = d; wrap.appendChild(img);
    if (ia.last) ia.last.dataUrl = d;
  });

  function descargar() {
    if (!ia.last) return;
    const prod = currentProduct();
    const name = 'lasvirginias-' + (prod ? prod.id : 'marca') + '-' + ia.intent + '-' + ia.format + '.png';
    const a = document.createElement('a'); a.href = ia.last.dataUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Imagen descargada. ¡A publicarla!');
  }

  /* ============================================================
     TAB AJUSTES
     ============================================================ */
  function renderAjustes() {
    const c = work.contacto || {};
    $('#c-whatsapp').value = c.whatsapp || '';
    $('#c-wamsg').value = c.whatsappMsg || '';
    $('#c-ig').value = c.instagram || '';
    $('#c-tel').value = c.telefono || '';
    $('#c-horario').value = c.horario || '';
    $('#c-zona').value = c.zona || '';
    $('#c-proxy').value = B.loadConfig().proxyUrl || '';
  }
  function bindAjustes() {
    $('#save-contacto').addEventListener('click', async () => {
      if (!work.contacto) work.contacto = {};
      Object.assign(work.contacto, {
        whatsapp: $('#c-whatsapp').value.replace(/[^\d]/g, ''),
        whatsappMsg: $('#c-wamsg').value.trim(),
        instagram: $('#c-ig').value.replace('@', '').trim(),
        telefono: $('#c-tel').value.trim(),
        horario: $('#c-horario').value.trim(),
        zona: $('#c-zona').value.trim()
      });
      saveData(work);
      const btn = $('#save-contacto');
      btn.disabled = true;
      const res = await API.save(work, ownerPass());
      btn.disabled = false;
      if (res.ok) { toast('Datos guardados. Ya son visibles para todos.'); pulse(btn); }
      else if (res.configured === false || res.error === 'no_store' || res.error === 'no_password') { toast('Guardado local (falta configurar el backend).'); pulse(btn); }
      else if (res.status === 401) { toast('Tu sesión expiró. Entra de nuevo con tu contraseña.'); }
      else { toast('No se pudo guardar en la nube. Quedó guardado en este equipo.'); }
    });
    $('#save-ia').addEventListener('click', () => {
      const cfg = B.loadConfig(); cfg.proxyUrl = $('#c-proxy').value.trim();
      B.saveConfig(cfg);
      toast(cfg.proxyUrl ? 'Conexión guardada. La IA usará tu backend.' : 'Guardado. Sigue en modo demo.'); pulse($('#save-ia'));
    });
    $('#reset-all').addEventListener('click', () => {
      if (confirm('¿Restablecer TODO (menú y datos) a los valores originales?')) {
        work = resetData(); renderMenuTab(); renderIaTab(); renderAjustes(); toast('Todo restablecido.');
      }
    });
  }

  /* ============================================================
     Arranque
     ============================================================ */
  if (isLogged()) showShell();
})();
