# Checklist de lanzamiento — Tienda web V4.1

> Adaptado del checklist V3 (Google Forms), ya sin Forms: el front es la web propia.

## Cuenta e identidad
- [ ] Repo en cuenta/organización GitHub **neutral** (nunca una cuenta personal).
- [ ] Backend en la cuenta Google operativa `enfadadosconairbus.tienda@gmail.com`.
- [ ] Ni nombres ni emails personales aparecen en el repo ni en los commits (revisa `git log`).

## Backend (Google Sheet + Apps Script)
- [ ] `setupTiendaV4()` ejecutado: existen `00_HOW_TO`, `01_DASHBOARD`, `CONFIG`,
      `CATALOGO`, `PEDIDOS`, `LINEAS_PEDIDO`, `BANCO`, `LOTES`, `PROVEEDOR`.
- [ ] `CONFIG` con **IBAN real** y **BENEFICIARIO** correcto.
- [ ] `CATALOGO`: 9 tallas, `PRECIO=10`, `COSTE=5`, `APORTE_CAJA=5`.
- [ ] Aplicación web implementada (*Ejecutar como: yo* · *Acceso: Cualquiera*), URL `/exec` guardada.
- [ ] Token mostrado y copiado (solo para el Worker).

## Worker (Cloudflare)
- [ ] `worker.js` desplegado.
- [ ] Secretos `APPS_SCRIPT_URL` y `BACKEND_TOKEN` puestos.
- [ ] Variable `ALLOWED_ORIGIN` = origen real de GitHub Pages.
- [ ] URL pública del Worker copiada.

## Web (GitHub Pages)
- [ ] `config.js`: `API_URL` = URL del Worker · `DEMO_MODE: false`.
- [ ] Fotos `assets/camiseta-solidaria.jpg` y `assets/guia-tallas.jpg` (EXIF limpio).
- [ ] GitHub Pages activo; la web carga con estilos e imágenes.
- [ ] La web lleva `noindex` (ya está en el `index.html`).

## Pedido de prueba (extremo a extremo)
- [ ] `M×2 + XL×1 + 20€` muestra **50,00 €** y un código `AIR26-XXXXX`.
- [ ] Fila en `PEDIDOS` y dos líneas en `LINEAS_PEDIDO` (`CAMISETA-M`, `CAMISETA-XL`).
- [ ] Llega el email **Pedido recibido** con IBAN y concepto correctos.
- [ ] El concepto obligatorio es exactamente el código, sin pedir justificante.

## Conciliación bancaria
- [ ] Pego un movimiento con el código + importe exacto en `BANCO` → **Conciliar banco**
      → pedido a `PAGO_CONCILIADO` + email de confirmación.
- [ ] Importe distinto → queda `REVISAR_IMPORTE`.
- [ ] Concepto sin código → `REVISAR_SIN_CODIGO`.
- [ ] Código inexistente → `REVISAR_CODIGO_INEXISTENTE`.

## Proveedor y entrega
- [ ] **Generar pedido a proveedor** solo toma pedidos `PAGO_CONCILIADO`.
- [ ] `PROVEEDOR` agrega bien por `PRODUCTO+SKU+TALLA`; un pedido ya loteado no repite.
- [ ] **Marcar lote recibido** pasa pedidos completos a `LISTO` + email de recogida.
- [ ] **Marcar ENTREGADO** funciona.

## Excel / respaldo
- [ ] **Exportar a Excel (.xlsx)** genera el fichero en *Tienda Airbus - Export* (Drive).

## Antes de difundir masivamente
- [ ] Una **transferencia real de 10 €** recorre todo el circuito hasta `PAGO_CONCILIADO`.
- [ ] `01_DASHBOARD` refleja correctamente recaudado, caja y unidades.
