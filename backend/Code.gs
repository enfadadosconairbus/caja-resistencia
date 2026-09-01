/* =============================================================================
   Code.gs — Backend Apps Script V4.1 · Tienda Caja de Resistencia (Airbus 2026)
   -----------------------------------------------------------------------------
   Panel de operaciones sobre Google Sheet. Reúne y mejora el sistema V3.5:
     · Alta de pedidos desde la web (sin Google Forms).
     · Estados de pedido y caducidad 12 h.
     · Conciliación bancaria AUTOMÁTICA importando el extracto del banco
       (casa por concepto AIR26-XXXXX + importe exacto).
     · LOTES y PROVEEDOR por PRODUCTO + SKU + TALLA.
     · Emails: pedido recibido / pago confirmado / listo para recoger.
     · DASHBOARD con KPIs (recaudado, caja de resistencia, pendientes…).
     · Exportar a Excel (.xlsx) real con un clic.

   Puesta en marcha:
     1) Pega este fichero en Apps Script del Sheet (cuenta operativa).
     2) Ejecuta setupTiendaV4()  (crea hojas + catálogo + panel).
     3) Revisa CONFIG: IBAN y BENEFICIARIO reales.
     4) Implementar → Nueva implementación → Aplicación web
          Ejecutar como: tú · Acceso: Cualquiera → copia la URL /exec (al Worker)
     5) Menú → Mostrar TOKEN backend (al Worker, nunca a GitHub).

   El navegador NUNCA decide el precio: se recalcula aquí contra CATALOGO.
   ========================================================================== */

var SH = {
  HOWTO: '00_HOW_TO',
  DASH: '01_DASHBOARD',
  CONFIG: 'CONFIG',
  CATALOGO: 'CATALOGO',
  PEDIDOS: 'PEDIDOS',
  LINEAS: 'LINEAS_PEDIDO',
  BANCO: 'BANCO',
  LOTES: 'LOTES',
  PROVEEDOR: 'PROVEEDOR'
};

var HEAD = {
  PEDIDOS: ['ID', 'FECHA_PEDIDO', 'NOMBRE', 'APELLIDOS', 'EMAIL', 'TELEFONO',
            'UNIDADES', 'PRODUCTOS_EUR', 'APORTACION_EUR', 'TOTAL_EUR', 'ESTADO',
            'CLIENT_REQUEST_ID', 'RECOGIDA', 'CADUCA', 'FECHA_CONFIRMADO',
            'FECHA_LISTO', 'FECHA_ENTREGADO'],
  LINEAS: ['ID', 'FECHA_PEDIDO', 'PRODUCTO', 'SKU', 'TALLA', 'CANTIDAD', 'LOTE'],
  CATALOGO: ['ACTIVO', 'PRODUCTO', 'SKU', 'TALLA', 'MEDIDAS', 'PRECIO', 'COSTE', 'APORTE_CAJA'],
  BANCO: ['FECHA', 'CONCEPTO', 'IMPORTE', 'REFERENCIA', 'PEDIDO_DETECTADO', 'RESULTADO', 'PROCESADO', 'FECHA_CONCILIACION'],
  LOTES: ['LOTE', 'FECHA_GENERACION', 'PRODUCTO', 'SKU', 'TALLA', 'CANTIDAD', 'ESTADO', 'FECHA_RECEPCION'],
  PROVEEDOR: ['LOTE', 'PRODUCTO', 'SKU', 'TALLA', 'CANTIDAD']
};

// Estados que cuentan como "pagado" (para KPIs y flujos).
var ESTADOS_PAGADOS = ['PAGO_CONCILIADO', 'EN_PRODUCCION', 'RECIBIDO', 'LISTO', 'ENTREGADO'];

/* ===========================  ENDPOINT WEB  ================================ */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (!tokenValido(data.token)) return jsonOut({ ok: false, error: 'No autorizado' });
    if (data.action === 'crear_pedido') return jsonOut(crearPedido(data));
    return jsonOut({ ok: false, error: 'Acción no reconocida' });
  } catch (err) {
    return jsonOut({ ok: false, error: 'Error del servidor: ' + err });
  }
}

function doGet() { return jsonOut({ ok: true, service: 'tienda-airbus', version: 'V4.1' }); }

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===========================  CREAR PEDIDO  =============================== */

function crearPedido(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActive();
    var cfg = leerConfig();

    // Idempotencia por client_request_id (reintentos, doble pulsación).
    var crid = String(data.client_request_id || '');
    if (crid) {
      var ex = buscarPorCRID(ss, crid);
      if (ex) return respuestaPedido(ex.id, ex.total, cfg);
    }

    var catalogo = leerCatalogo(ss);
    var lineas = [], unidades = 0, productos = 0;
    (data.lineas || []).forEach(function (l) {
      var item = catalogo[String(l.sku)];
      if (!item || item.activo !== true) return;
      var cant = Math.max(0, Math.floor(Number(l.cantidad) || 0));
      if (cant <= 0) return;
      unidades += cant;
      productos += item.precio * cant;
      lineas.push({ producto: item.producto, sku: item.sku, talla: item.talla, cantidad: cant });
    });
    if (!lineas.length) return { ok: false, error: 'El pedido no contiene productos válidos.' };

    var maxUds = Number(cfg.MAX_UNIDADES || 20);
    if (unidades > maxUds) return { ok: false, error: 'Máximo ' + maxUds + ' unidades por pedido.' };

    var aportacion = Math.max(0, Number(data.aportacion) || 0);
    var total = productos + aportacion;

    var c = (data.cliente || {});
    var nombre = limpiar(c.nombre, 60), apellidos = limpiar(c.apellidos, 100);
    var email = limpiar(c.email, 120), telefono = limpiar(c.telefono, 30);
    if (!nombre || !apellidos || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Datos de cliente incompletos.' };
    }

    var id = siguienteId(cfg);
    var ahora = new Date();
    var caduca = new Date(ahora.getTime() + Number(cfg.CADUCIDAD_HORAS || 12) * 3600 * 1000);
    var recogida = limpiar(data.recogida || cfg.RECOGIDA || '', 200);

    ss.getSheetByName(SH.PEDIDOS).appendRow([
      id, ahora, nombre, apellidos, email, telefono,
      unidades, productos, aportacion, total, 'PENDIENTE_PAGO',
      crid, recogida, caduca, '', '', ''
    ]);

    var hojaLineas = ss.getSheetByName(SH.LINEAS);
    lineas.forEach(function (l) { hojaLineas.appendRow([id, ahora, l.producto, l.sku, l.talla, l.cantidad, '']); });

    try { emailPedidoRecibido(email, id, nombre, lineas, productos, aportacion, total, cfg); } catch (e) {}

    return respuestaPedido(id, total, cfg);
  } finally {
    lock.releaseLock();
  }
}

function respuestaPedido(id, total, cfg) {
  return { ok: true, order_id: id, total: Number(total), beneficiario: cfg.BENEFICIARIO || '', iban: cfg.IBAN || '', concepto: id };
}

/* ===========================  CONCILIACIÓN BANCARIA  ===================== */
/*
   Flujo "más digital": pegas el extracto del banco en la hoja BANCO
   (columnas FECHA·CONCEPTO·IMPORTE·REFERENCIA) y pulsas "Conciliar banco".
   El sistema casa cada movimiento por código AIR26-XXXXX + importe exacto,
   marca el pedido como PAGO_CONCILIADO y envía el email de confirmación.
   Los que no cuadran quedan como REVISAR para mirarlos a mano.
*/
function conciliarBanco() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SH.BANCO);
  var last = sh.getLastRow();
  if (last < 2) { ui().alert('No hay movimientos en la hoja BANCO. Pega el extracto (FECHA, CONCEPTO, IMPORTE, REFERENCIA).'); return; }

  var H = HEAD.BANCO, col = function (k) { return H.indexOf(k); };
  var rango = sh.getRange(2, 1, last - 1, H.length);
  var vals = rango.getValues();
  var pedidos = indicePedidos(ss);
  var cfg = leerConfig();
  var conc = 0, rev = 0, ya = 0, ahora = new Date();

  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][col('PROCESADO')]).toUpperCase() === 'SI') continue;

    var concepto = String(vals[r][col('CONCEPTO')] || '');
    var importe = parseImporte(vals[r][col('IMPORTE')]);
    var m = concepto.toUpperCase().match(/AIR26[-\s]?0*\d{1,6}/);
    var id = m ? normalizarId(m[0], cfg) : '';

    if (!id) { vals[r][col('RESULTADO')] = 'REVISAR_SIN_CODIGO'; rev++; continue; }
    var p = pedidos[id];
    if (!p) { vals[r][col('RESULTADO')] = 'REVISAR_CODIGO_INEXISTENTE'; vals[r][col('PEDIDO_DETECTADO')] = id; rev++; continue; }

    vals[r][col('PEDIDO_DETECTADO')] = id;

    if (ESTADOS_PAGADOS.indexOf(p.estado) >= 0) {
      vals[r][col('RESULTADO')] = 'YA_PAGADO';
      vals[r][col('PROCESADO')] = 'SI'; vals[r][col('FECHA_CONCILIACION')] = ahora; ya++; continue;
    }
    if (p.estado === 'CADUCADO') { vals[r][col('RESULTADO')] = 'REVISAR_CADUCADO'; rev++; continue; }

    if (Math.round(importe * 100) === Math.round(p.total * 100)) {
      // Cuadra: marcar pedido pagado + email
      marcarPedidoPagado(ss, p, cfg);
      vals[r][col('RESULTADO')] = 'PAGO_CONCILIADO';
      vals[r][col('PROCESADO')] = 'SI'; vals[r][col('FECHA_CONCILIACION')] = ahora;
      pedidos[id].estado = 'PAGO_CONCILIADO';
      conc++;
    } else {
      vals[r][col('RESULTADO')] = 'REVISAR_IMPORTE (' + eur(importe) + ' vs ' + eur(p.total) + ')';
      rev++;
    }
  }

  rango.setValues(vals);
  refrescarDashboard();
  ui().alert('Conciliación terminada.\n\nConciliados: ' + conc + '\nYa estaban pagados: ' + ya + '\nPara revisar: ' + rev);
}

function marcarPedidoPagado(ss, p, cfg) {
  var sh = ss.getSheetByName(SH.PEDIDOS);
  var H = HEAD.PEDIDOS;
  sh.getRange(p.fila, H.indexOf('ESTADO') + 1).setValue('PAGO_CONCILIADO');
  sh.getRange(p.fila, H.indexOf('FECHA_CONFIRMADO') + 1).setValue(new Date());
  try {
    var lineas = lineasDePedido(ss, p.id);
    emailPagoConfirmado(p.email, p.id, p.nombre, lineas, p.productos, p.aportacion, p.total, cfg);
  } catch (e) {}
}

/* ===========================  LOTES / PROVEEDOR  ======================== */

function generarPedidoProveedor() {
  var ss = SpreadsheetApp.getActive();
  var pedidos = indicePedidos(ss);

  // Pedidos pagados aún no enviados a producción.
  var ids = [];
  for (var id in pedidos) if (pedidos[id].estado === 'PAGO_CONCILIADO') ids.push(id);
  if (!ids.length) { ui().alert('No hay pedidos PAGO_CONCILIADO pendientes de lote.'); return; }

  // Agregar líneas sin lote por PRODUCTO+SKU+TALLA.
  var shL = ss.getSheetByName(SH.LINEAS), H = HEAD.LINEAS;
  var lastL = shL.getLastRow();
  var lin = shL.getRange(2, 1, lastL - 1, H.length).getValues();
  var agg = {}, filasToStamp = [];
  for (var i = 0; i < lin.length; i++) {
    var row = lin[i];
    var pid = String(row[H.indexOf('ID')]);
    if (ids.indexOf(pid) < 0) continue;
    if (String(row[H.indexOf('LOTE')])) continue; // ya loteada
    var key = row[H.indexOf('PRODUCTO')] + '||' + row[H.indexOf('SKU')] + '||' + row[H.indexOf('TALLA')];
    if (!agg[key]) agg[key] = { producto: row[H.indexOf('PRODUCTO')], sku: row[H.indexOf('SKU')], talla: row[H.indexOf('TALLA')], cantidad: 0 };
    agg[key].cantidad += Number(row[H.indexOf('CANTIDAD')]) || 0;
    filasToStamp.push(i + 2); // fila real
  }
  var keys = Object.keys(agg);
  if (!keys.length) { ui().alert('Los pedidos pagados ya estaban loteados.'); return; }

  var lote = nuevoLoteId(ss);
  var ahora = new Date();
  var shLot = ss.getSheetByName(SH.LOTES), shProv = ss.getSheetByName(SH.PROVEEDOR);
  keys.forEach(function (k) {
    var a = agg[k];
    shLot.appendRow([lote, ahora, a.producto, a.sku, a.talla, a.cantidad, 'PEDIDO', '']);
    shProv.appendRow([lote, a.producto, a.sku, a.talla, a.cantidad]);
  });

  // Sellar LOTE en las líneas y pasar pedidos a EN_PRODUCCION.
  filasToStamp.forEach(function (f) { shL.getRange(f, H.indexOf('LOTE') + 1).setValue(lote); });
  var shP = ss.getSheetByName(SH.PEDIDOS), HP = HEAD.PEDIDOS;
  ids.forEach(function (id) { shP.getRange(pedidos[id].fila, HP.indexOf('ESTADO') + 1).setValue('EN_PRODUCCION'); });

  refrescarDashboard();
  var totalUds = keys.reduce(function (s, k) { return s + agg[k].cantidad; }, 0);
  ui().alert('Lote ' + lote + ' generado.\n\n' + keys.length + ' líneas de proveedor · ' + totalUds + ' uds.\nRevisa la hoja PROVEEDOR (puedes exportarla a Excel).');
}

function marcarLoteRecibidoSeleccion() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet();
  if (sh.getName() !== SH.LOTES) { ui().alert('Ponte en la hoja LOTES y selecciona una fila del lote a recibir.'); return; }
  var fila = sh.getActiveCell().getRow();
  if (fila < 2) { ui().alert('Selecciona una fila de lote.'); return; }
  var H = HEAD.LOTES;
  var lote = sh.getRange(fila, H.indexOf('LOTE') + 1).getValue();
  if (!lote) return;

  // Marca todas las filas de ese LOTE como RECIBIDO.
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, H.length).getValues();
  var ahora = new Date();
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][H.indexOf('LOTE')]) === String(lote)) {
      sh.getRange(r + 2, H.indexOf('ESTADO') + 1).setValue('RECIBIDO');
      sh.getRange(r + 2, H.indexOf('FECHA_RECEPCION') + 1).setValue(ahora);
    }
  }

  var avisados = avisarPedidosListos(ss);
  refrescarDashboard();
  ui().alert('Lote ' + lote + ' marcado como RECIBIDO.\nPedidos avisados para recoger: ' + avisados);
}

// Un pedido pasa a LISTO (y se avisa) cuando TODAS sus líneas tienen lote y
// todos esos lotes están RECIBIDOS.
function avisarPedidosListos(ss) {
  var lotesRecibidos = {};
  var shLot = ss.getSheetByName(SH.LOTES), HL = HEAD.LOTES, lastLot = shLot.getLastRow();
  if (lastLot >= 2) {
    shLot.getRange(2, 1, lastLot - 1, HL.length).getValues().forEach(function (r) {
      if (String(r[HL.indexOf('ESTADO')]) === 'RECIBIDO') lotesRecibidos[String(r[HL.indexOf('LOTE')])] = true;
    });
  }
  var shL = ss.getSheetByName(SH.LINEAS), H = HEAD.LINEAS, lastL = shL.getLastRow();
  var porPedido = {};
  if (lastL >= 2) {
    shL.getRange(2, 1, lastL - 1, H.length).getValues().forEach(function (r) {
      var pid = String(r[H.indexOf('ID')]);
      var lote = String(r[H.indexOf('LOTE')]);
      if (!porPedido[pid]) porPedido[pid] = { total: 0, listos: 0 };
      porPedido[pid].total++;
      if (lote && lotesRecibidos[lote]) porPedido[pid].listos++;
    });
  }
  var pedidos = indicePedidos(ss), cfg = leerConfig();
  var shP = ss.getSheetByName(SH.PEDIDOS), HP = HEAD.PEDIDOS;
  var n = 0;
  for (var pid in porPedido) {
    var p = pedidos[pid];
    if (!p || p.estado !== 'EN_PRODUCCION') continue;
    var c = porPedido[pid];
    if (c.total > 0 && c.listos === c.total) {
      shP.getRange(p.fila, HP.indexOf('ESTADO') + 1).setValue('LISTO');
      shP.getRange(p.fila, HP.indexOf('FECHA_LISTO') + 1).setValue(new Date());
      try { emailListoRecoger(p.email, p.id, p.nombre, lineasDePedido(ss, p.id), p.productos, p.aportacion, p.total, cfg); n++; } catch (e) {}
    }
  }
  return n;
}

/* ===========================  ACCIONES MANUALES  ======================== */

function confirmarPagoSeleccion() {  // override manual (transferencia vista a mano)
  var r = pedidoSeleccionado(); if (!r) return;
  var ss = SpreadsheetApp.getActive();
  marcarPedidoPagado(ss, r, leerConfig());
  refrescarDashboard();
  ui().alert('Pedido ' + r.id + ' → PAGO_CONCILIADO. Email enviado.');
}

function marcarEntregadoSeleccion() {
  var r = pedidoSeleccionado(); if (!r) return;
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SH.PEDIDOS), H = HEAD.PEDIDOS;
  sh.getRange(r.fila, H.indexOf('ESTADO') + 1).setValue('ENTREGADO');
  sh.getRange(r.fila, H.indexOf('FECHA_ENTREGADO') + 1).setValue(new Date());
  refrescarDashboard();
  ui().alert('Pedido ' + r.id + ' → ENTREGADO.');
}

function caducarPendientes() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SH.PEDIDOS), H = HEAD.PEDIDOS;
  var last = sh.getLastRow(); if (last < 2) return;
  var vals = sh.getRange(2, 1, last - 1, H.length).getValues();
  var ahora = new Date(), n = 0;
  for (var r = 0; r < vals.length; r++) {
    if (String(vals[r][H.indexOf('ESTADO')]) === 'PENDIENTE_PAGO') {
      var cad = vals[r][H.indexOf('CADUCA')];
      if (cad instanceof Date && cad < ahora) { sh.getRange(r + 2, H.indexOf('ESTADO') + 1).setValue('CADUCADO'); n++; }
    }
  }
  refrescarDashboard();
  ui().alert(n + ' pedido(s) marcados como CADUCADO.');
}

function pedidoSeleccionado() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet();
  if (sh.getName() !== SH.PEDIDOS) { ui().alert('Ponte en la hoja PEDIDOS y selecciona la fila del pedido.'); return null; }
  var fila = sh.getActiveCell().getRow();
  if (fila < 2) { ui().alert('Selecciona una fila de pedido.'); return null; }
  return pedidoDeFila(ss, fila);
}

/* ===========================  EXPORTAR A EXCEL  ========================= */

function exportarExcel() {
  var ss = SpreadsheetApp.getActive();
  var id = ss.getId();
  var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
  var token = ScriptApp.getOAuthToken();
  var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) { ui().alert('No se pudo exportar (código ' + resp.getResponseCode() + ').'); return; }

  var carpeta = carpetaExport_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  var blob = resp.getBlob().setName('Tienda-Airbus-' + stamp + '.xlsx');
  var file = carpeta.createFile(blob);
  ui().alert('Excel generado:\n\n' + file.getName() + '\n\nCarpeta "Tienda Airbus - Export" en tu Drive.\nEnlace:\n' + file.getUrl());
}

function carpetaExport_() {
  var nombre = 'Tienda Airbus - Export';
  var it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

/* ===========================  DASHBOARD  =============================== */

function refrescarDashboard() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SH.DASH);
  if (!sh) return;
  // Los KPIs son fórmulas vivas; aquí solo sellamos la marca de tiempo (fila "Actualizado").
  sh.getRange('B2').setValue(new Date());
}

function construirDashboard_(ss) {
  var sh = ss.getSheetByName(SH.DASH) || ss.insertSheet(SH.DASH, 1);
  sh.clear();
  var P = SH.PEDIDOS;
  // Máscara "pagado" = estado no vacío que no es PENDIENTE_PAGO ni CADUCADO.
  // (los pedidos nunca toman estado REVISAR; eso solo ocurre en la hoja BANCO)
  var K = P + "!K2:K5000";
  var mask = "(" + K + "<>\"PENDIENTE_PAGO\")*(" + K + "<>\"CADUCADO\")*(" + K + "<>\"\")";
  var filas = [
    ['PANEL · TIENDA CAJA DE RESISTENCIA', ''],
    ['Actualizado', ''],
    ['', ''],
    ['Pedidos totales', '=COUNTA(' + P + '!A2:A5000)'],
    ['· Pendientes de pago', '=COUNTIF(' + P + '!K2:K5000,"PENDIENTE_PAGO")'],
    ['· Pagados (conciliados)', '=SUMPRODUCT(' + mask + ')'],
    ['· En producción', '=COUNTIF(' + P + '!K2:K5000,"EN_PRODUCCION")'],
    ['· Listos para recoger', '=COUNTIF(' + P + '!K2:K5000,"LISTO")'],
    ['· Entregados', '=COUNTIF(' + P + '!K2:K5000,"ENTREGADO")'],
    ['· Caducados', '=COUNTIF(' + P + '!K2:K5000,"CADUCADO")'],
    ['', ''],
    ['Unidades vendidas (pagadas)', '=SUMPRODUCT(' + mask + '*' + P + '!G2:G5000)'],
    ['Recaudado total (pagado)', '=SUMPRODUCT(' + mask + '*' + P + '!J2:J5000)'],
    ['→ a la Caja de Resistencia', '=SUMPRODUCT(' + mask + '*' + P + '!I2:I5000)+5*SUMPRODUCT(' + mask + '*' + P + '!G2:G5000)'],
    ['→ coste de fabricación', '=5*SUMPRODUCT(' + mask + '*' + P + '!G2:G5000)'],
    ['', ''],
    ['Importe pendiente de cobro', '=SUMIF(' + P + '!K2:K5000,"PENDIENTE_PAGO",' + P + '!J2:J5000)']
  ];
  sh.getRange(1, 1, filas.length, 2).setValues(filas);
  sh.getRange('B4:B17').setNumberFormat('#,##0');
  sh.getRange('B12').setNumberFormat('#,##0');
  sh.getRange('B13:B15').setNumberFormat('#,##0.00 €');
  sh.getRange('B17').setNumberFormat('#,##0.00 €');
  sh.getRange('B2').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('A1:B1').merge().setFontWeight('bold').setFontSize(14).setBackground('#ff7417').setFontColor('#1a1206');
  sh.getRange('A4:A17').setFontWeight('bold');
  sh.setColumnWidth(1, 260); sh.setColumnWidth(2, 160);
  sh.getRange('B2').setValue(new Date());
}

/* ===========================  TOKEN  =================================== */

function tokenValido(t) {
  var real = PropertiesService.getScriptProperties().getProperty('BACKEND_TOKEN');
  return real && t && String(t) === String(real);
}
function asegurarToken() {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty('BACKEND_TOKEN');
  if (!t) { t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('BACKEND_TOKEN', t); }
  return t;
}
function mostrarToken() {
  ui().alert('TOKEN backend (solo para el Cloudflare Worker):\n\n' + asegurarToken() + '\n\nNo lo pongas en GitHub ni en config.js.');
}

/* ===========================  EMAILS  =================================== */

function emailPedidoRecibido(email, id, nombre, lineas, productos, aportacion, total, cfg) {
  MailApp.sendEmail({ to: email, name: 'Tienda Caja de Resistencia',
    subject: 'Pedido ' + id + ' recibido · Caja de Resistencia',
    htmlBody: plantillaEmail('Pedido recibido',
      'Hola ' + escapar(nombre) + ', hemos registrado tu pedido <strong>' + id + '</strong>. ' +
      'Haz una transferencia por el importe exacto usando <strong>' + id + '</strong> como concepto. ' +
      'No hace falta enviar justificante: confirmamos con los movimientos reales de la cuenta.',
      id, lineas, productos, aportacion, total, cfg, 'PENDIENTE DE PAGO') });
}
function emailPagoConfirmado(email, id, nombre, lineas, productos, aportacion, total, cfg) {
  MailApp.sendEmail({ to: email, name: 'Tienda Caja de Resistencia',
    subject: 'Pedido ' + id + ' confirmado · Caja de Resistencia',
    htmlBody: plantillaEmail('Pago confirmado',
      'Hola ' + escapar(nombre) + ', tu transferencia ha quedado <strong>confirmada</strong>. ' +
      'Te avisaremos por email cuando tu pedido esté listo para recoger en Getafe.',
      id, lineas, productos, aportacion, total, cfg, 'CONFIRMADA') });
}
function emailListoRecoger(email, id, nombre, lineas, productos, aportacion, total, cfg) {
  MailApp.sendEmail({ to: email, name: 'Tienda Caja de Resistencia',
    subject: 'Pedido ' + id + ' listo para recoger · Caja de Resistencia',
    htmlBody: plantillaEmail('Listo para recoger',
      'Hola ' + escapar(nombre) + ', tu pedido <strong>' + id + '</strong> ya está disponible. ' +
      'Recógelo en: <strong>' + escapar(cfg.RECOGIDA || '') + '</strong>.',
      id, lineas, productos, aportacion, total, cfg, 'LISTO PARA RECOGER') });
}

function plantillaEmail(titulo, intro, id, lineas, productos, aportacion, total, cfg, estado) {
  var filas = lineas.map(function (l) {
    var precio = precioSku(l.sku) * l.cantidad;
    return '<tr>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #3a2f27">' + escapar(l.producto) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #3a2f27">' + escapar(l.talla) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #3a2f27;text-align:center">' + l.cantidad + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #3a2f27;text-align:right">' + eur(precio) + '</td></tr>';
  }).join('');
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;background:#15110f;padding:24px;color:#f4eee5">' +
    '<div style="max-width:560px;margin:0 auto;background:#221b17;border:1px solid #3a2f27;border-radius:14px;overflow:hidden">' +
      '<div style="background:#ff7417;color:#1a1206;padding:18px 22px;font-weight:900;text-transform:uppercase;letter-spacing:.04em">Caja de Resistencia · Huelga Airbus 2026</div>' +
      '<div style="padding:22px">' +
        '<div style="color:#ff7417;font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:12px">' + escapar(estado) + '</div>' +
        '<h1 style="margin:6px 0 12px;font-size:22px;color:#f4eee5">' + escapar(titulo) + '</h1>' +
        '<p style="color:#d9cec0;font-size:14px;line-height:1.6">' + intro + '</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:14px 0;background:#2a221d;border-radius:8px">' +
          '<thead><tr>' +
            '<th style="text-align:left;padding:8px 10px;color:#b9ac9d;font-size:11px;text-transform:uppercase">Producto</th>' +
            '<th style="text-align:left;padding:8px 10px;color:#b9ac9d;font-size:11px;text-transform:uppercase">Talla</th>' +
            '<th style="text-align:center;padding:8px 10px;color:#b9ac9d;font-size:11px;text-transform:uppercase">Uds.</th>' +
            '<th style="text-align:right;padding:8px 10px;color:#b9ac9d;font-size:11px;text-transform:uppercase">Subtotal</th>' +
          '</tr></thead><tbody>' + filas + '</tbody></table>' +
        '<div style="color:#d9cec0;font-size:14px">Productos: <strong>' + eur(productos) + '</strong></div>' +
        (aportacion > 0 ? '<div style="color:#d9cec0;font-size:14px">Aportación adicional: <strong>' + eur(aportacion) + '</strong></div>' : '') +
        '<div style="font-size:20px;color:#ff7417;font-weight:900;margin-top:6px">TOTAL: ' + eur(total) + '</div>' +
        '<div style="margin-top:18px;padding:16px;background:#2a221d;border-radius:10px;border-left:4px solid #ff7417">' +
          '<div style="font-size:11px;color:#b9ac9d;text-transform:uppercase;letter-spacing:.08em">Datos de la transferencia</div>' +
          '<div style="margin-top:6px;font-size:14px">Beneficiario: <strong>' + escapar(cfg.BENEFICIARIO || '') + '</strong></div>' +
          '<div style="font-size:14px">IBAN: <strong>' + escapar(cfg.IBAN || '') + '</strong></div>' +
          '<div style="font-size:14px">Concepto obligatorio: <strong style="color:#ff7417">' + id + '</strong></div>' +
        '</div>' +
        '<p style="color:#8f8478;font-size:11px;margin-top:18px">Página no oficial de Airbus. El pago se realiza por transferencia; esta web no procesa pagos.</p>' +
      '</div></div></div>';
}

/* ===========================  LECTURAS / ÍNDICES  ====================== */

function indicePedidos(ss) {
  var sh = ss.getSheetByName(SH.PEDIDOS), H = HEAD.PEDIDOS, out = {};
  var last = sh.getLastRow(); if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, H.length).getValues();
  for (var r = 0; r < vals.length; r++) {
    var id = String(vals[r][H.indexOf('ID')]); if (!id) continue;
    out[id] = filaAObjeto(vals[r], r + 2);
  }
  return out;
}
function pedidoDeFila(ss, fila) {
  var sh = ss.getSheetByName(SH.PEDIDOS), H = HEAD.PEDIDOS;
  return filaAObjeto(sh.getRange(fila, 1, 1, H.length).getValues()[0], fila);
}
function filaAObjeto(row, fila) {
  var H = HEAD.PEDIDOS, g = function (k) { return row[H.indexOf(k)]; };
  return { fila: fila, id: String(g('ID')), nombre: g('NOMBRE'), email: g('EMAIL'),
    unidades: Number(g('UNIDADES')) || 0, productos: Number(g('PRODUCTOS_EUR')) || 0,
    aportacion: Number(g('APORTACION_EUR')) || 0, total: Number(g('TOTAL_EUR')) || 0,
    estado: String(g('ESTADO')) };
}
function buscarPorCRID(ss, crid) {
  var sh = ss.getSheetByName(SH.PEDIDOS), H = HEAD.PEDIDOS, last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, H.length).getValues();
  for (var r = 0; r < vals.length; r++) if (String(vals[r][H.indexOf('CLIENT_REQUEST_ID')]) === crid)
    return { id: vals[r][H.indexOf('ID')], total: vals[r][H.indexOf('TOTAL_EUR')] };
  return null;
}
function lineasDePedido(ss, id) {
  var sh = ss.getSheetByName(SH.LINEAS), H = HEAD.LINEAS, last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, H.length).getValues().forEach(function (r) {
    if (String(r[H.indexOf('ID')]) === String(id))
      out.push({ producto: r[H.indexOf('PRODUCTO')], sku: r[H.indexOf('SKU')], talla: r[H.indexOf('TALLA')], cantidad: Number(r[H.indexOf('CANTIDAD')]) || 0 });
  });
  return out;
}
var _catCache = null;
function leerCatalogo(ss) {
  var sh = ss.getSheetByName(SH.CATALOGO), out = {}, last = sh.getLastRow();
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, HEAD.CATALOGO.length).getValues().forEach(function (row) {
    var sku = String(row[2]).trim(); if (!sku) return;
    out[sku] = { activo: row[0] === true || String(row[0]).toUpperCase() === 'TRUE',
      producto: row[1], sku: sku, talla: row[3], medidas: row[4],
      precio: Number(row[5]) || 0, coste: Number(row[6]) || 0, aporte: Number(row[7]) || 0 };
  });
  _catCache = out; return out;
}
function precioSku(sku) {
  if (!_catCache) leerCatalogo(SpreadsheetApp.getActive());
  var it = _catCache[sku]; return it ? it.precio : 0;
}
function leerConfig() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.CONFIG), out = {};
  if (!sh) return out;
  var last = sh.getLastRow(); if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}

/* ===========================  IDs  ==================================== */

function siguienteId(cfg) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('ULTIMO_NUM') || '0') + 1;
  props.setProperty('ULTIMO_NUM', String(n));
  return (cfg.PREFIJO || 'AIR26') + '-' + pad(n, 5);
}
function nuevoLoteId(ss) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('ULTIMO_LOTE') || '0') + 1;
  props.setProperty('ULTIMO_LOTE', String(n));
  return 'LOTE-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + pad(n, 3);
}
function normalizarId(bruto, cfg) {
  var m = String(bruto).toUpperCase().match(/0*(\d{1,6})/);
  if (!m) return '';
  return (cfg.PREFIJO || 'AIR26') + '-' + pad(Number(m[1]), 5);
}
function pad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

/* ===========================  SETUP + MENÚ  =========================== */

function setupTiendaV4() {
  var ss = SpreadsheetApp.getActive();
  crearHoja(ss, SH.CONFIG, ['CLAVE', 'VALOR']);
  crearHoja(ss, SH.CATALOGO, HEAD.CATALOGO);
  crearHoja(ss, SH.PEDIDOS, HEAD.PEDIDOS);
  crearHoja(ss, SH.LINEAS, HEAD.LINEAS);
  crearHoja(ss, SH.BANCO, HEAD.BANCO);
  crearHoja(ss, SH.LOTES, HEAD.LOTES);
  crearHoja(ss, SH.PROVEEDOR, HEAD.PROVEEDOR);

  var cfg = ss.getSheetByName(SH.CONFIG);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, 7, 2).setValues([
      ['BENEFICIARIO', 'Caja de Resistencia Huelga Airbus 2026 - Sindicato Útil'],
      ['IBAN', 'ESXX XXXX XXXX XXXX XXXX XXXX'],
      ['EMAIL_CONTACTO', 'enfadadosconairbus.tienda@gmail.com'],
      ['RECOGIDA', 'Getafe - Factoría Airbus - Puerta Sur / Puerta Norte (Asamblea de trabajadores en Huelga)'],
      ['CADUCIDAD_HORAS', 12],
      ['MAX_UNIDADES', 20],
      ['PREFIJO', 'AIR26']
    ]);
  }

  var cat = ss.getSheetByName(SH.CATALOGO);
  if (cat.getLastRow() < 2) {
    var tallas = [['XS','46×66'],['S','49×69'],['M','52×71'],['L','55×73'],['XL','58×75'],
                  ['2XL','62×77'],['3XL','66×79'],['4XL','70×81'],['5XL','74×83']];
    var rows = tallas.map(function (t) { return [true, 'Camiseta', 'CAMISETA-' + t[0], t[0], t[1], 10, 5, 5]; });
    cat.getRange(2, 1, rows.length, HEAD.CATALOGO.length).setValues(rows);
  }

  construirHowTo_(ss);
  construirDashboard_(ss);
  asegurarToken();

  // Ordena las pestañas clave al principio.
  try { ss.setActiveSheet(ss.getSheetByName(SH.HOWTO)); ss.moveActiveSheet(1); } catch (e) {}

  ui().alert('Backend V4.1 preparado.\n\n1) Revisa CONFIG (IBAN y beneficiario reales).\n2) Implementa como Aplicación web.\n3) Menú → Mostrar TOKEN backend.');
}

function construirHowTo_(ss) {
  var sh = ss.getSheetByName(SH.HOWTO) || ss.insertSheet(SH.HOWTO, 0);
  sh.clear();
  var txt = [
    ['TIENDA CAJA DE RESISTENCIA · HUELGA AIRBUS 2026 — Cómo operar'],
    [''],
    ['1. Los pedidos entran solos desde la web (estado PENDIENTE_PAGO) y se envía email con el código AIR26-XXXXX.'],
    ['2. Cada día: pega el extracto del banco en la hoja BANCO (FECHA, CONCEPTO, IMPORTE, REFERENCIA) y pulsa'],
    ['   menú "Tienda Airbus 2026 → Conciliar banco". Los que cuadran pasan a PAGO_CONCILIADO y reciben email.'],
    ['3. Los que no cuadran quedan como REVISAR: míralos a mano y usa "Confirmar PAGO del seleccionado" si procede.'],
    ['4. "Generar pedido a proveedor" agrupa lo pagado por PRODUCTO+SKU+TALLA, crea un LOTE y llena PROVEEDOR.'],
    ['5. Cuando llegue la mercancía: en la hoja LOTES selecciona el lote y pulsa "Marcar lote recibido".'],
    ['   Los pedidos completos pasan a LISTO y reciben email de recogida automáticamente.'],
    ['6. Al entregar: en PEDIDOS selecciona la fila y "Marcar ENTREGADO".'],
    ['7. "Exportar a Excel (.xlsx)" guarda una copia en tu Drive cuando la necesites (proveedor, contabilidad).'],
    [''],
    ['Estados: PENDIENTE_PAGO → PAGO_CONCILIADO → EN_PRODUCCION → LISTO → ENTREGADO. (CADUCADO / REVISAR aparte)'],
    ['El panel 01_DASHBOARD muestra recaudado, importe a la Caja y unidades en tiempo real.']
  ];
  sh.getRange(1, 1, txt.length, 1).setValues(txt);
  sh.getRange('A1').setFontWeight('bold').setFontSize(13).setFontColor('#1a1206').setBackground('#ff7417');
  sh.setColumnWidth(1, 900);
}

function crearHoja(ss, nombre, cabecera) {
  var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, cabecera.length).setFontWeight('bold').setBackground('#2a221d').setFontColor('#f4eee5');
  }
  return sh;
}

function onOpen() {
  ui().createMenu('Tienda Airbus 2026')
    .addItem('Preparar backend V4.1 (setup)', 'setupTiendaV4')
    .addSeparator()
    .addItem('Conciliar banco', 'conciliarBanco')
    .addItem('Confirmar PAGO del seleccionado (manual)', 'confirmarPagoSeleccion')
    .addItem('Caducar pendientes vencidos', 'caducarPendientes')
    .addSeparator()
    .addItem('Generar pedido a proveedor', 'generarPedidoProveedor')
    .addItem('Marcar lote recibido (seleccionado)', 'marcarLoteRecibidoSeleccion')
    .addItem('Marcar ENTREGADO (seleccionado)', 'marcarEntregadoSeleccion')
    .addSeparator()
    .addItem('Actualizar panel', 'refrescarDashboard')
    .addItem('Exportar a Excel (.xlsx)', 'exportarExcel')
    .addSeparator()
    .addItem('Mostrar TOKEN backend', 'mostrarToken')
    .addToUi();
}

/* ===========================  UTILIDADES  ============================= */

function ui() { return SpreadsheetApp.getUi(); }
function limpiar(s, max) { return String(s == null ? '' : s).trim().slice(0, max || 200); }
function escapar(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function eur(n) { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' €'; }
function parseImporte(v) {
  if (typeof v === 'number') return v;
  var s = String(v == null ? '' : v).replace(/[^\d,.\-]/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else s = s.replace(',', '.');
  return Number(s) || 0;
}
