# Tienda solidaria · Caja de Resistencia (Huelga Airbus 2026)

Tienda-web estática con formulario/carrito propio para vender camisetas cuyo
importe financia la caja de resistencia. **No procesa pagos**: el cobro es por
transferencia bancaria con un código de pedido `AIR26-XXXXX` como concepto.

Se despliega **fuera de la Web B** (la caja del sindicato, `site-caja/`) porque
la tienda integrada en esa web todavía no está validada por el equipo jurídico
de Sindicato Útil, y las camisetas deben venderse a tiempo para la marcha del
**10 de septiembre**. Cuando la tienda de la Web B esté validada, esto se puede
retirar o redirigir.

## Arquitectura

```
  Web (GitHub Pages, cuenta neutral)
        │  fetch JSON
        ▼
  Cloudflare Worker  ── oculta el token y resuelve CORS
        │
        ▼
  Google Apps Script (/exec)  ── valida precios, genera AIR26-XXXXX, idempotencia
        │
        ├── Google Sheet — panel de operaciones:
        │     00_HOW_TO · 01_DASHBOARD · CONFIG · CATALOGO · PEDIDOS
        │     LINEAS_PEDIDO · MOVIMIENTOS_BANCO · LOTES · PROVEEDOR · LOG
        └── Gmail (email de pedido recibido / confirmado / listo)
```

El **navegador nunca decide el dinero**: el backend recalcula cada precio contra
la hoja `CATALOGO`. El IBAN y el beneficiario viven en la hoja `CONFIG` y llegan
al navegador solo en la respuesta del pedido; **no están en el repo**.

El Sheet **no es un simple listado**: es un panel con KPIs en vivo
(`01_DASHBOARD`, con gráficos), **conciliación bancaria automática**
(`MOVIMIENTOS_BANCO`), generación de
**pedido a proveedor** por lotes (`LOTES`/`PROVEEDOR`) y **exportación a Excel
real** (.xlsx) con un clic. Un Google Sheet ya se descarga como `.xlsx`, así que
"exportable a Excel" está cubierto de fábrica; el botón deja además copias
fechadas en tu Drive.

## Ficheros

| Ruta | Qué es | ¿Va al repo público? |
|---|---|---|
| `index.html` `styles.css` `app.js` | La web | Sí |
| `config.js` | Config pública (URL del Worker, catálogo visible). **Sin secretos** | Sí |
| `assets/` | Imágenes + favicon (faltan 2 fotos, ver `assets/LEEME-IMAGENES.md`) | Sí |
| `worker/worker.js` | Cloudflare Worker | No hace falta subirlo; se pega en Cloudflare |
| `backend/Code.gs` | Apps Script (panel V4.1) | No hace falta subirlo; se pega en el Sheet |
| `backend/PLANTILLA_MOVIMIENTOS_BANCO.csv` | Formato de la hoja `BANCO` para conciliar | Referencia; no es necesario en el repo |

> Lo mínimo publicable en GitHub Pages es: `index.html`, `styles.css`, `app.js`,
> `config.js`, `assets/` y `.nojekyll`. `worker/` y `backend/` son código que se
> pega en Cloudflare y en Google respectivamente.

---

## Puesta en marcha (orden recomendado)

### 0. Cuentas neutrales (las creas tú)

- **GitHub**: una cuenta u organización **nueva, no personal** (p. ej.
  `enfadadosconairbus`). *No puedo crear cuentas por ti.*
- **Google**: la cuenta operativa ya existente (p. ej.
  `enfadadosconairbus.tienda@gmail.com`).
- **Cloudflare**: cuenta gratuita (puede ser la misma neutral).

### 1. Backend (Google Sheet + Apps Script)

1. Crea un Google Sheet nuevo en la cuenta operativa.
2. `Extensiones → Apps Script`, pega `backend/Code.gs`, guarda.
3. Recarga el Sheet. Menú **Tienda Airbus 2026 → Preparar backend V4.1 (setup)**.
   Crea todas las hojas (incluidas `00_HOW_TO`, `01_DASHBOARD`, `BANCO`, `LOTES`,
   `PROVEEDOR`), el catálogo de 9 tallas y el token.
4. Revisa la hoja **CONFIG**: pon el **IBAN** y el **BENEFICIARIO** reales.
5. `Implementar → Nueva implementación → Aplicación web`
   - *Ejecutar como*: **tú** (la cuenta operativa)
   - *Acceso*: **Cualquiera**
   - Copia la URL que termina en **`/exec`**.
6. Menú **Tienda Airbus 2026 → Mostrar TOKEN backend**. Copia el token.
   Este token **no va a GitHub** ni a `config.js`; es solo para el Worker.

### 2. Worker (Cloudflare)

1. `Workers & Pages → Create Worker`, pega `worker/worker.js`, deploy.
2. En *Settings → Variables and Secrets*:
   - `APPS_SCRIPT_URL` (**Secret**) → la URL `/exec` del paso 1.5
   - `BACKEND_TOKEN` (**Secret**) → el token del paso 1.6
   - `ALLOWED_ORIGIN` (**Variable de texto**) → tu origen de GitHub Pages,
     p. ej. `https://enfadadosconairbus.github.io` (varios separados por comas)
3. Copia la URL pública del Worker: `https://xxxxx.workers.dev`.

### 3. Web (GitHub Pages)

1. En la cuenta neutral, crea el repo (p. ej. `tienda-caja-resistencia`).
2. Sube el contenido de esta carpeta **excepto** `worker/` y `backend/` si
   quieres mantenerlos fuera del repo público (o déjalos, no exponen secretos).
3. Coloca las dos fotos en `assets/` (ver `assets/LEEME-IMAGENES.md`).
4. Edita **`config.js`**:
   - `API_URL` → la URL real del Worker (paso 2.3)
   - `DEMO_MODE: false`
5. `Settings → Pages → Deploy from branch → main → /(root)`.
6. La URL será algo como
   `https://enfadadosconairbus.github.io/tienda-caja-resistencia/`.

### 4. Prueba antes de difundir

1. Con `DEMO_MODE: false`, haz un pedido de prueba: `M × 2`, `XL × 1`, `+20 €`
   → debe mostrar **50,00 €** y un código `AIR26-XXXXX`.
2. Comprueba en el Sheet: fila en `PEDIDOS` y dos filas en `LINEAS_PEDIDO`
   (`Camiseta | CAMISETA-M | M | 2` y `Camiseta | CAMISETA-XL | XL | 1`).
3. Debe llegar el email **Pedido recibido**.
4. Haz **una transferencia real de 10 €** para validar el circuito completo
   antes de compartir la URL de forma masiva.

## Operación diaria (panel del Sheet)

Todo se hace desde el menú **Tienda Airbus 2026**. La guía está también en la
pestaña `00_HOW_TO`, y `01_DASHBOARD` muestra recaudado, importe a la Caja y
unidades en vivo.

El panel `01_DASHBOARD` trae KPIs en tarjetas + dos gráficos (dónut de estados y
barras de camisetas por talla). Si tocas el formato, **🎨 Reconstruir panel y
formato** lo regenera sin perder datos.

**Flujo de estados:**
`PENDIENTE_PAGO → PAGO_CONCILIADO → ENVIADO_PROVEEDOR → RECIBIDO → LISTO_RECOGIDA → ENTREGADO`
(aparte: `CADUCADO`; `REVISAR` solo en el banco).

1. **Los pedidos entran solos** desde la web (`PENDIENTE_PAGO`) y el comprador
   recibe el email con su código `AIR26-XXXXX`.
2. **Conciliar banco** (a diario): pega el extracto en la hoja `MOVIMIENTOS_BANCO`
   (columnas `FECHA, CONCEPTO, IMPORTE, REFERENCIA` — ver
   `backend/PLANTILLA_MOVIMIENTOS_BANCO.csv`) y pulsa **Conciliar banco**. El
   sistema casa por código + **importe exacto**, pasa los pedidos a
   `PAGO_CONCILIADO` y **envía el email de confirmación automáticamente**. Los
   que no cuadran quedan como `REVISAR`.
3. **Confirmar PAGO del seleccionado (manual)**: para un caso que quieras validar
   a mano (p. ej. un ingreso sin código claro).
4. **Generar pedido a proveedor**: agrupa lo pagado por `PRODUCTO+SKU+TALLA`,
   crea un `LOTE` y rellena la hoja `PROVEEDOR`. Expórtala a Excel si el
   proveedor la quiere en `.xlsx`.
5. **Marcar lote recibido**: en la hoja `LOTES` selecciona el lote que llegó y
   pulsa la opción. Los pedidos completos pasan a `LISTO_RECOGIDA` y reciben el
   **email de recogida** solos.
6. **Marcar ENTREGADO**: en `PEDIDOS`, selecciona la fila al entregar en mano.
7. **Caducar pendientes vencidos**: los `PENDIENTE_PAGO` de más de 12 h pasan a
   `CADUCADO`. Puedes automatizarlo con un activador horario sobre
   `caducarPendientes`.
8. **Exportar a Excel (.xlsx)**: guarda una copia fechada del libro en la carpeta
   *Tienda Airbus - Export* de tu Drive (proveedor, contabilidad, respaldo).

## Privacidad (importante)

- El repo es **público**: no metas IBAN, token, ni datos personales en él.
- La web lleva `noindex,nofollow` mientras esté en pruebas.
- Limpia EXIF de las fotos antes de subirlas.
- Los datos de compradores viven en el Google Sheet privado, no en GitHub.

## Multiproducto (futuro)

Para vender algo más que camisetas, añade filas a `CATALOGO`
(`Sudadera | SUDADERA-M | …`) y amplía `CATALOG` en `config.js`. `PEDIDOS` y
`LINEAS_PEDIDO` ya trabajan por `PRODUCTO + SKU + TALLA`, no hay que rehacer nada.

---

*Origen: paquete "V4" definido en una conversación de ChatGPT. `index.html` se
tomó verbatim de esa conversación; `styles.css`, `app.js`, `config.js`,
`worker.js` y `Code.gs` se reconstruyeron aquí para que las piezas encajen entre
sí (la conversación solo tenía el HTML en texto; el resto eran descargas).*
