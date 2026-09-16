# Las Virginias — Menú Digital + Landing con IA

Sitio web de Las Virginias con dos caras sobre un mismo menú (ver `Brief-Menu-Digital-IA.md`):

- **Cara pública** (`index.html`) — la vitrina para clientes: landing + menú con fotos y precios, la Tequepizza destacada, adicionales, contacto por WhatsApp/Instagram/teléfono y un **código QR de marca** que abre el mismo menú.
- **Cara privada** (`admin.html`) — el panel de dueños: **editar el menú** (nombres, precios, descripciones, fotos, agotados) y **generar contenido promocional con IA**, listo para descargar y publicar.

Todo respeta la identidad de la marca: rojo `#A71C19` + crema `#FCEEBB`, tipografías retro/modernas, la pizza como protagonista y el tono cercano de Las Virginias.

Es un **sitio autónomo**: son archivos web estáticos, sin servidor ni base de datos. Los cambios del panel se guardan en el navegador (`localStorage`).

---

## Cómo probarlo

Por temas de seguridad del navegador, conviene abrirlo desde un servidor local (no con doble clic en el archivo), para que el panel y el menú compartan los datos.

- **Con VS Code:** instala la extensión *Live Server*, abre la carpeta `06-Web` y haz clic derecho en `index.html` → “Open with Live Server”.
- **Con Node:** `npx serve` dentro de `06-Web`.
- **Con Python 3:** `python -m http.server` dentro de `06-Web` y abre `http://localhost:8000`.

Luego:
- Menú público → `http://localhost:PUERTO/index.html`
- Panel de dueños → `http://localhost:PUERTO/admin.html`

---

## Panel de dueños (acceso)

- **Contraseña por defecto:** `lasvirginias`
- Se cambia en `js/admin.js`, en la línea `const ADMIN_PASS = 'lasvirginias';`

> ⚠️ **Importante:** al ser un sitio sin servidor, esta contraseña es una barrera básica, **no seguridad real** (cualquiera con conocimientos técnicos podría verla en el código). Sirve para el uso normal del día a día. Cuando se agregue un **backend** (etapa técnica posterior), se reemplaza por un inicio de sesión real.

### Qué se puede hacer en el panel
1. **Menú** — agregar/quitar pizzas, editar precios (Mediana/Familiar), nombres y descripciones, subir o cambiar fotos, marcar “agotada”, editar adicionales, bebida y la nota del borde. **Guardar cambios** los refleja en el menú público.
2. **Contenido con IA** — elegir un producto → qué comunicar (promoción / anuncio / temporada) → texto opcional → formato (feed 1:1, vertical 4:5, story 9:16) → **Generar** → **Regenerar** hasta que guste → **Descargar**.
3. **Ajustes** — datos de contacto (WhatsApp, Instagram, teléfono, horario, zona), conexión con IA y restablecer todo.

---

## ⚙️ Antes de publicar — datos por completar

En **Panel → Ajustes** (o directamente en `js/data.js`, objeto `DEFAULT`):

- **WhatsApp:** hoy tiene un número de ejemplo `584140000000`. Poné el real (código de país sin `+`, ej. Venezuela `58`).
- **Teléfono:** ejemplo `+58 414 000 0000`. Reemplazar.
- **Instagram / horario / zona:** ajustar si hace falta.

### Fotos de los productos
Hay fotos reales de **Tequepizza** y **Cuatro Estaciones**. **Napoli, Jamón y Queso y Salchipizza** muestran por ahora un ícono de marca como marcador de posición. Cuando haya sesión de fotos (Etapa 04), subí cada foto desde **Panel → Menú → Cambiar foto** y listo.

---

## 🤖 Generación con IA (Kie AI)

Hoy el panel funciona en **modo demo**: arma la pieza promocional **localmente** (sobre `<canvas>`), sin costo ni clave, respetando paleta, tipografías, logo, foto y tono de la marca. El dueño ya puede generar y **descargar** piezas reales y usables.

El sistema arma solo el “prompt de marca” (el dueño nunca escribe prompts). Se puede ver en cada pieza en *“Ver prompt de marca (detalle técnico)”*.

### Para activar la IA real (etapa con backend)
La clave de Kie AI **no debe ir en el navegador** (quedaría expuesta). Se necesita un **backend/proxy propio** que:
1. Reciba `{ prompt, width, height, productId, intent }` (lo que envía `js/brand.js`).
2. Llame a **Kie AI** con la clave guardada **en el servidor**.
3. Devuelva `{ imageUrl }` o `{ imageBase64 }`.

Luego, en **Panel → Ajustes → Conexión con IA**, se pega la dirección de ese backend y el panel pasa automáticamente a **modo IA real**. El punto de integración está marcado en `js/brand.js` (`PUNTO DE INTEGRACIÓN KIE AI`).

---

## Estructura

```
06-Web/
├── index.html          Menú público / landing
├── admin.html          Panel privado de dueños
├── css/
│   ├── styles.css      Sistema visual de marca (público)
│   └── admin.css       Estilos del panel
├── js/
│   ├── data.js         Menú + contacto + almacenamiento (compartido)
│   ├── brand.js        Contexto de marca + prompt + generación (demo/API)
│   ├── public.js       Render del menú público
│   └── admin.js        Lógica del panel
└── assets/             Logo, isotipo, mascota, sello, fotos, QR generado
```

- El **QR** se genera solo, apuntando a la dirección donde esté publicado el sitio. Al desplegar, mostrará la URL real.
- **Deploy:** subir la carpeta `06-Web` a cualquier hosting estático (Netlify, Vercel, GitHub Pages, etc.). No requiere servidor.

---

## Notas de marca
- Fuente de verdad visual: `../02-Identidad-Visual/Moodboard/`.
- Descriptor oficial: **EL SABOR DE CASA.** · Institucional: **De nuestra casa para la tuya.**
- El menú viejo (fondo de fuego/negro) queda descartado como diseño; de él solo se conserva la **información** (productos, precios, adicionales).
