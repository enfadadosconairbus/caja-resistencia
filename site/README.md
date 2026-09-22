# `_PLANTILLA-SITE` — Plantilla base del estudio

> **Punto de partida de toda web de cliente.** A3 copia esta carpeta a
> `clientes/<cliente>/site/`. **No copies nunca la `site/` de otro cliente.**

## La regla: se comparte el CRAFT, nunca el LAYOUT

Esta plantilla existe porque copiar la web de un cliente para hacer la del
siguiente producía **clones**. Evidencia real: `kebap-house-101` (un kebab de
Usera) acabó importando `OliveDivider` y las secciones `Casa` y `Terraza`
heredadas de **O'Ribeiriño** (un restaurante gallego). Su `page.tsx` era
**byte-idéntico**. Eso incumple el criterio 1 del $10K — *"Punto de vista, no
plantilla"* — y **A4 ahora lo rechaza**.

| | Qué es | Regla |
|---|---|---|
| ✅ **CRAFT** | El sistema de movimiento firma, los providers, los primitivos y el rating de Google | **Se hereda íntegro. No se toca.** |
| ⛔ **LAYOUT** | Las secciones, la paleta, la tipografía, el copy, la arquitectura de la página | **Se diseña desde cero para ESTE negocio.** |

## Qué trae (CRAFT — no borrar)

- **`src/components/motion.tsx`** — el vocabulario que A4 exige:
  `MaskText` (titulares tras máscara, **no** fade-up), `Curtain` (imágenes por
  clip-path), `MagneticButton` (CTA magnético), `Stagger`/`StaggerItem`, `Rise`,
  y el **easing firma** (`EASE`) compartido por todas las interacciones.
- `src/components/ui/smooth-scroll-hero.tsx` — hero con parallax por scroll.
- `motion-provider.tsx`, `reveal.tsx` — todo *reduced-motion aware*.
- `language-provider.tsx` (i18n), `location-map.tsx`, `ui/button.tsx`, `ui/gallery-animation.tsx`.
- `src/lib/google-rating.ts` — rating de Google auto-sync (ISR 24 h).
- `globals.css` — reveals CSS above-the-fold (LCP rápido, funcionan sin JS),
  foco de teclado visible y `prefers-reduced-motion`.

## Qué NO trae (a propósito)

- **`src/components/sections/`** — **no existe.** Las secciones se diseñan según
  el **tipo de negocio** (Producto/ecommerce · Servicio local · Hostelería y ocio ·
  Profesional/B2B). Ver el catálogo en la skill **A3**.
- Paleta, tipografía y copy: son **placeholders neutros**. Dejarlos tal cual es
  un fallo de QA (criterios 1, 2 y 3 del $10K).

## Cómo se captura el lead (decisión 14-jul-2026)

**Por defecto: `<ContactoDirecto/>` — sin backend.** `tel:` + **WhatsApp con mensaje
prerrellenado** (+ botón de **agenda** en B2B). En negocio local español convierte mejor
que un formulario: el lead llega ya identificado por su teléfono y respondes en 30 segundos.
Cero secretos, cero RGPD extra, cero mantenimiento.

```tsx
<ContactoDirecto
  telefono="34600000000"
  mensaje="Hola, necesito presupuesto para una reforma de baño en Usera."
  ctaLabel="Pedir presupuesto"
/>
```

**Opcional: `<ContactForm/>` — solo si el briefing lo exige** (típicamente una asesoría/B2B
que no quiere WhatsApp). Envía el lead por email vía `POST /api/contacto` → Resend (API REST
con `fetch`, **sin dependencias nuevas**). Trae honeypot anti-spam, **consentimiento RGPD
obligatorio** y la vía directa (`tel:`/WhatsApp) **siempre visible al lado**.

Para activarlo hay que definir en **Vercel** (Settings → Environment Variables, **nunca en el
repo**): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (ver `.env.example`).
Si faltan, el endpoint responde un **error explícito** — nunca finge que envió el mensaje.

## Cómo arrancar un cliente

```bash
cp -r _PLANTILLA-SITE clientes/<cliente>/site
cd clientes/<cliente>/site
npm install
npm run dev
```

Después, en orden:

1. **`globals.css`** → paleta real del negocio (3-5 colores, contraste ≥ 4.5:1).
2. **`layout.tsx`** → par tipográfico (**nunca Inter ni Roboto**), metadatos reales
   y `schema.org` con el `@type` correcto del tipo de negocio.
3. **`lib/google-rating.ts`** → `FALLBACK` con el dato real de Google.
4. **`src/components/sections/`** → **créala tú**, con el vocabulario de ESTA marca.
5. **`page.tsx`** → compón la página. Usa el motion firma en cada sección.
6. Pasa **A4 QA $10K** antes de publicar. Luego **`/deploy-vercel`**.

## SEO

`layout.tsx` trae metadatos, `canonical`, OpenGraph y `schema.org LocalBusiness` (A3 pone el `@type`
real y los datos). `robots.ts` y `sitemap.ts` generan `/robots.txt` y `/sitemap.xml`.

**Indexación por variable de entorno (en Vercel):**
```bash
SITE_URL=https://cliente-real.com   # sin barra final
SITE_INDEXABLE=true                 # SOLO en producción real
```
- **Sin `SITE_INDEXABLE`** (demos): `robots.txt` → `Disallow: /`. **Protege las demos especulativas**
  de negocios que aún no han dicho que sí — no queremos su demo en Google.
- **`SITE_INDEXABLE=true`** (cliente real en su dominio): `robots.txt` → `Allow: /` + `Sitemap:`.
- ⚠️ Al pasar un cliente a producción, **acuérdate de ponerlo a `true`** o su web no se indexará.

> **Imagen OG (importante):** el enlace de la demo se envía por WhatsApp. Sin `openGraph.images`, la
> previsualización sale **en blanco**. A3 debe poner la foto del hero del negocio antes de enviar.

## Seguridad

`next.config.ts` aplica **cabeceras de seguridad a toda ruta** (CSP, HSTS, `X-Frame-Options`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`). Vercel las sirve tal cual.

- Las **fuentes se auto-alojan** (`next/font/google`): la CSP no abre dominios de Google y el
  visitante no expone su IP a un tercero (bonus RGPD).
- La CSP lleva `'unsafe-inline'` en scripts/estilos porque Next.js los inyecta para hidratar:
  **restringe orígenes, pero no es un escudo anti-XSS completo**. Endurecerla con nonces es una
  mejora futura.
- `'unsafe-eval'` se añade **solo en desarrollo** (`npm run dev`), porque React lo usa para depurar.
  **En producción NO se incluye.** Sin esto, el QA visual de A4 en dev vería errores de `eval()`
  fantasma y no podría fiarse de "consola sin errores".
- Si un cliente añade un script de terceros (analítica, chat, mapa embebido), **añádelo a la CSP**
  en `next.config.ts` — si no, se bloqueará. Verifica siempre la consola sin violaciones.

## QA medible (criterio 8)

El criterio 8 del $10K (*"lo caro invisible"*) se **mide** con Lighthouse, no se afirma. Dos comandos:

```bash
# 1. Antes de enviar (local): Accesibilidad >= 90, SEO >= 90, cero errores de consola.
npm run audit

# 2. Tras publicar en Vercel: además Rendimiento >= 90 (HTTPS y CDN reales).
npm run audit:prod -- --collect.url=https://<cliente>-demo.vercel.app
```

> **El rendimiento NO se mide en localhost a propósito:** con HTTP y con el antivirus inyectando
> scripts, el número es ruido. Y el cliente sufre la carga en Vercel, no en tu máquina.
>
> ⚠️ **Regla de oro del movimiento** (aprendida midiendo, ver el comentario de `src/app/page.tsx`):
> el contenido **above-the-fold** usa **reveals CSS** (`.mask-rise` / `.rise-in` de `globals.css`),
> **nunca framer-motion**. Framer-motion en el hero dispara el LCP porque el texto no se pinta hasta
> que hidrata React. Below-the-fold sí: `MaskText`, `Curtain`, `MagneticButton`.
