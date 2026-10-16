# Sheet de gestión de la tienda — puesta en marcha

Qué hace, en una línea: cada camiseta pagada en la web llega sola a un Google Sheet, el comprador
recibe «hemos recibido tu pago», y al poner su pedido en **Listo para recoger** recibe el aviso.

```
Stripe ──► web (Cloudflare) ──► D1 (fuente de verdad)
                 │   ├──► Resend ──► correo «pago recibido» / «listo para recoger»
                 │   └──► Sheet (Apps Script, este Code.gs)
                 ◄──────── Sheet: cambio de estado y sincronización horaria
```

Todo con la cuenta **enfadadosconairbus.contacto@gmail.com**. Son cinco pasos; el primero ya está hecho.

---

## 1 · Resend: verificar el dominio — HECHO (1-oct-2026)

Verificado en **Ireland (eu-west-1)** con la conexión automática a Cloudflare. Quedaron estos
registros (comprobados por DNS público):

| Tipo | Nombre | Apunta a | Para qué |
|---|---|---|---|
| `TXT` | `resend._domainkey` | clave `p=MIGf…` | DKIM: firma los correos |
| `CNAME` | `send` | `send.forge.rmta.net` | SPF / rebotes |
| `CNAME` | `rsend` | `rsend-euw1.forge.rmta.net` | SPF / rebotes (región UE) |
| `TXT` | `_dmarc` | `v=DMARC1; p=none;` | DMARC: hay que **añadirlo a mano** (abajo) |

Los `MX` del dominio raíz (`route*.mx.cloudflare.net`) son del buzón de sugerencias (Email
Routing) y no se tocan: Resend envía por `send`/`rsend` y no choca con ellos.

**Pendiente — DMARC.** Cloudflare ▸ el dominio ▸ **DNS ▸ Records ▸ Add record**: tipo `TXT`,
nombre `_dmarc`, contenido `v=DMARC1; p=none;`. Sin él los correos llegan igual, pero Gmail y
Outlook se fían menos y es más fácil que acaben en spam.

**En Resend, dejar así:**
- **Enable Receiving: desactivado.** Activarlo pondría MX de Resend y rompería el buzón.
- **Configuration ▸ Open tracking y Click tracking: desactivados.** La web promete que no rastrea a
  nadie; esos píxeles y enlaces reescritos serían rastreo.

Si algún día hubiera que repetirlo: Resend ▸ **Domains ▸ Add Domain**, región Ireland, y usar el
botón de Cloudflare para que ponga los registros solo.

## 2 · Resend: la clave de API

1. Menú izquierdo **API Keys** → **Create API Key**.
2. Nombre: `web-caja`. Permission: **Sending access**. Domain: `cajaderesistencia-asi-no.org`.
3. **Add**. Copia la clave (empieza por `re_`). **Solo se muestra una vez**: guárdala en un sitio
   seguro hasta el paso 4.

## 3 · El Sheet y su Apps Script

1. Con la cuenta de la caja, abre **sheets.new**. Ponle nombre, por ejemplo
   *Tienda caja de resistencia — pedidos*.
2. **Extensiones ▸ Apps Script**. Se abre el editor con un `function myFunction()…`: bórralo
   entero y pega **todo** el contenido de `Code.gs`. Guarda (icono del disquete). Ponle nombre al
   proyecto si lo pide.
3. Vuelve a la pestaña del Sheet y **recárgala**. Aparece el menú **📦 Caja**.
4. **Caja ▸ Configurar (una vez)**. Google pedirá permisos:
   - «Se necesita autorización» → **Continuar** → elige la cuenta de la caja.
   - «Google no ha verificado esta aplicación» → **Configuración avanzada** → **Ir a …
     (no seguro)**. Es tu propio script; el aviso sale siempre con scripts propios.
   - **Permitir**.
   - Vuelve a pulsar **Caja ▸ Configurar** si el primer intento solo pidió permisos.
5. Sale un cuadro con el **secreto compartido** (64 caracteres). Cópialo: es `SHEET_SHARED_SECRET`.
6. Publica el script como aplicación web, en el editor de Apps Script:
   **Implementar ▸ Nueva implementación** → engranaje junto a «Seleccionar tipo» → **Aplicación
   web**.
   - Descripción: `web caja`
   - **Ejecutar como: Yo** (la cuenta de la caja)
   - **Quién tiene acceso: Cualquier usuario** (la web no inicia sesión en Google; lo protege el
     secreto)
   - **Implementar** → copia la **URL de la aplicación web** (acaba en `/exec`). Es
     `SHEET_WEBHOOK_URL`.

Si más adelante cambias el código: **Implementar ▸ Gestionar implementaciones** → lápiz → Versión:
**Nueva versión** → Implementar. La URL no cambia. Después, en el Sheet, recarga la pestaña y pulsa
**Caja ▸ Sincronizar ahora** y **Caja ▸ Rehacer hojas de resumen** (este último coloca las pestañas
en su orden).

## 4 · Los tres secretos en Cloudflare

En una terminal, desde `clientes/caja-resistencia/site-caja`, uno por uno. Cada comando pide el
valor: pégalo y pulsa Intro (no se ve al escribir).

```bash
npx wrangler secret put RESEND_API_KEY --name caja-resistencia-huelga-airbus-2026
```

```bash
npx wrangler secret put SHEET_WEBHOOK_URL --name caja-resistencia-huelga-airbus-2026
```

```bash
npx wrangler secret put SHEET_SHARED_SECRET --name caja-resistencia-huelga-airbus-2026
```

| Secreto | De dónde sale |
|---|---|
| `RESEND_API_KEY` | Resend ▸ API Keys (paso 2), empieza por `re_` |
| `SHEET_WEBHOOK_URL` | Apps Script ▸ Implementar (paso 3.6), acaba en `/exec` |
| `SHEET_SHARED_SECRET` | Sheet ▸ Caja ▸ Configurar (paso 3.5) |

## 5 · Comprobar

1. En el Sheet: **Caja ▸ Sincronizar ahora**. Debe decir «Pedidos añadidos: N…». Si dice
   «No autorizado», el secreto de Cloudflare y el del Sheet no coinciden.
2. Compra una camiseta en la web. En un minuto: la fila aparece en **Pedidos** y llega el correo
   «Pedido AIRW-… recibido» (copia oculta al Gmail de la caja).
3. Cambia su **Estado** a **Listo para recoger**: llega el aviso y se rellena «Aviso de recogida».
4. Ponlo en **Anulado** y reembólsalo desde Stripe.

## Cómo se usa cada día

- **Pedidos**: una fila por pedido. Solo se toca la columna **Estado** (desplegable) y **Notas**.
  - *Listo para recoger* → manda el aviso al comprador (una sola vez, aunque lo cambies y
    vuelvas). Si el aviso no sale, la celda vuelve a su valor y queda una nota con el motivo.
  - *Entregado* / *Anulado* → no mandan nada.
  - Cambia los estados **de uno en uno**: pegar varias celdas a la vez no avisa a la web.
- **00_HOW_TO**: esta misma guía, resumida, dentro del Sheet.
- **01_DASHBOARD**: pedidos, unidades, cobrado y lo que llega a la caja; pedidos por estado;
  producción por talla; y el cálculo cobrado − coste − comisión de Stripe (estimada con la
  tarifa de la web; la exacta, en el panel de Stripe). Separa material y aportaciones voluntarias.
  No cuenta los anulados.
- **CATALOGO**: productos, precios, coste y tallas. **Solo lectura**: lo manda la web en cada
  sincronización. Un cambio de precio o un producto nuevo se hace en la web
  (`src/config/pedidos.ts`), nunca aquí. Hasta la primera sincronización sale vacío, y el
  Dashboard sin coste ni comisión.
- No hay hoja CONFIG a propósito: precios, centros y claves viven en la web y en Cloudflare.
- **Producción**: unidades por talla. «Por preparar» es lo pagado aún sin preparar.
- **Recogida**: una lista por centro con lo pendiente de entregar, con columna de firma. Para
  imprimir: Archivo ▸ Imprimir ▸ Hoja actual.
- Cada hora el Sheet se sincroniza solo con la web: añade pedidos que faltaran y reintenta los
  correos de confirmación que no salieron.

Si alguien borra filas por error: **Caja ▸ Sincronizar ahora** las vuelve a traer.

## Lote mensual al proveedor

El **día 21 a las 8:00** (hora de Madrid) la web cierra sola el lote del mes y manda al Gmail de la
caja un correo con el resumen por talla y por centro, y **`lote-AAAA-MM.csv`** adjunto. Una persona lo
revisa y **reenvía el CSV al proveedor**. El CSV lleva referencia, fecha, centro y tallas: **ni
nombres ni contactos**.

- **Qué entra:** lo pagado del **21 del mes anterior, 00:00, al 20 de este mes, 23:59** (hora de
  Madrid). El día 20 entra entero porque la rutina corre el 21. Lo que entra el 21 ya es del mes
  siguiente.
- **Ningún pedido se queda colgado ni sale dos veces:** al cerrar, cada pedido queda marcado con su
  lote (columna **Lote** de *Pedidos*, p. ej. `2026-10`), y el lote siguiente solo coge los que no
  tengan marca. Si un mes la rutina fallara, el siguiente recoge lo pendiente y el correo lo avisa.
- **Si el correo no llega el 21:** panel de Tesorería (`/panel`, por la URL workers.dev) ▸ bloque
  *Lote al proveedor* ▸ **Cerrar lote y mandar el correo**. Desde ahí también se baja el CSV o se
  reenvía el correo. Repetirlo no duplica nada.
- Un pedido **anulado** después de cerrar el lote desaparece del CSV si se vuelve a bajar, pero el
  correo ya enviado no cambia: avisa tú al proveedor.
- La columna **Lote** aparece al pegar este `Code.gs` nuevo (paso 3, «Si más adelante cambias el
  código») y pulsar **Sincronizar ahora**.
