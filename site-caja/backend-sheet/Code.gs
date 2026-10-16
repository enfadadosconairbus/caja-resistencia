/**
 * SHEET DE GESTIÓN DE LA TIENDA — Caja de resistencia (Web B, cajaderesistencia-asi-no.org)
 *
 * Se pega entero en Extensiones ▸ Apps Script de un Google Sheet de la cuenta de la caja.
 * Instrucciones paso a paso en `LEEME.md`, junto a este fichero.
 *
 * Qué hace:
 *   · Recibe cada pedido PAGADO desde la web (doPost) y lo añade a la hoja «Pedidos».
 *   · Al cambiar la columna Estado a «Listo para recoger», pide a la web que mande el aviso al
 *     comprador (una sola vez) y apunta la fecha. Si el aviso no sale, la celda vuelve atrás.
 *   · Cada hora se sincroniza con la web: añade pedidos que falten y pone al día los estados.
 *   · Rehace solas las hojas «Producción» (unidades por talla) y «Recogida» (lista por centro).
 *   · Mantiene tres hojas de apoyo, con los nombres de la Plataforma Solidaria:
 *       00_HOW_TO     guía breve de uso (qué se edita y qué hace cada estado);
 *       01_DASHBOARD  totales, pedidos por estado, producción y lo que llega a la caja;
 *       CATALOGO      productos y precios, de SOLO LECTURA: los manda la web al sincronizar.
 *     No hay hoja CONFIG a propósito: precios, centros y claves viven en la web y en
 *     Cloudflare, nunca en un Sheet.
 *
 * La fuente de verdad son los pedidos de la web (base de datos D1). Este Sheet es la mesa de
 * trabajo: si se borrara, «Sincronizar ahora» lo vuelve a llenar.
 *
 * No hay que editar nada de este código. El secreto que comparte con la web se genera solo
 * (menú Caja ▸ Configurar) y se guarda en las propiedades del script, no aquí.
 */

var WEB = "https://cajaderesistencia-asi-no.org";
var HOJA = "Pedidos";
var H_HOWTO = "00_HOW_TO";
var H_DASH = "01_DASHBOARD";
var H_CATALOGO = "CATALOGO";

var HEADERS = [
  "Fecha", "Referencia", "Estado", "Nombre", "Email", "Teléfono", "Centro",
  "Tallas", "Uds.", "Total €", "Idioma", "Aviso de recogida", "Notas", "Aportación €", "Lote",
];
var C = {
  fecha: 1, referencia: 2, estado: 3, nombre: 4, email: 5, telefono: 6, centro: 7,
  tallas: 8, unidades: 9, total: 10, idioma: 11, avisado: 12, notas: 13, aportacion: 14, lote: 15,
};

/** Etiqueta del Sheet → estado de la web. */
var ESTADOS = {
  "Pagado": "pagado",
  "Listo para recoger": "listo",
  "Entregado": "entregado",
  "Anulado": "anulado",
};
var ETIQUETAS = { pagado: "Pagado", listo: "Listo para recoger", entregado: "Entregado", anulado: "Anulado" };

var TALLAS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
var CENTROS = ["Getafe", "Illescas", "Albacete", "San Pablo", "Tablada", "Cádiz"];

var COLOR = { cabecera: "#101e33", pagado: "#e3f6ec", listo: "#e1effd", entregado: "#eef0f3", anulado: "#f6e3e3" };

/* ───────────────────────────── Menú ───────────────────────────── */

/** Los iconos son emoji dentro del texto: es lo único que admite un menú de Apps Script. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📦 Caja")
    .addItem("⚙️ Configurar (una vez)", "configurar")
    .addItem("🔄 Sincronizar ahora", "sincronizarDesdeMenu")
    .addItem("📊 Rehacer hojas de resumen", "rehacerHojasDesdeMenu")
    .addToUi();
}

/**
 * Prepara todo: hojas, formato, secreto compartido y activadores. Se puede repetir sin miedo:
 * no duplica activadores ni cambia un secreto que ya exista.
 */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  pedidosHoja_(ss);
  rehacerHowTo_(ss);
  rehacerHojas();
  ordenarPestanas_(ss);

  var props = PropertiesService.getScriptProperties();
  var secreto = props.getProperty("SECRETO");
  if (!secreto) {
    secreto = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
    props.setProperty("SECRETO", secreto);
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === "alEditar" || f === "sincronizar") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("alEditar").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("sincronizar").timeBased().everyHours(1).create();

  SpreadsheetApp.getUi().alert(
    "Configuración hecha",
    "Hojas y activadores listos.\n\n" +
      "Copia este secreto y guárdalo en Cloudflare como SHEET_SHARED_SECRET " +
      "(instrucciones en LEEME.md, paso 4):\n\n" + secreto + "\n\n" +
      "No lo compartas: con él se pueden escribir pedidos en esta hoja.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/* ─────────────────────── Entrada desde la web ─────────────────────── */

/** La web manda aquí cada pedido pagado: { secreto, accion: "pedido", pedido: {...} }. */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!secretoValido_(body.secreto)) return out_({ ok: false, error: "forbidden" });
    if (body.accion !== "pedido" || !body.pedido || !body.pedido.referencia) {
      return out_({ ok: false, error: "petición no válida" });
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = pedidosHoja_(SpreadsheetApp.getActiveSpreadsheet());
      if (filaDe_(sh, body.pedido.referencia)) return out_({ ok: true, duplicado: true });
      anadir_(sh, [body.pedido]);
      rehacerHojas();
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, servicio: "caja-resistencia-sheet" });
}

/* ───────────────────── Cambio de estado (activador) ───────────────────── */

/**
 * Activador INSTALABLE «al editar» (lo crea Configurar). El onEdit simple no sirve: no puede
 * llamar a la web. Solo reacciona a la columna Estado de «Pedidos», celda a celda.
 */
function alEditar(e) {
  var r = e && e.range;
  if (!r) return;
  var sh = r.getSheet();
  if (sh.getName() !== HOJA || r.getColumn() > C.estado || r.getLastColumn() < C.estado || r.getRow() < 2) return;

  var ss = sh.getParent();
  if (r.getNumRows() > 1 || r.getNumColumns() > 1) {
    ss.toast("Cambia los estados de uno en uno: un cambio de varias celdas no avisa a la web. " +
      "«Sincronizar ahora» devuelve los estados reales.", "Caja", 10);
    return;
  }

  var fila = r.getRow();
  var celda = sh.getRange(fila, C.estado);
  var anterior = e.oldValue === undefined ? "" : e.oldValue;
  var etiqueta = String(e.value === undefined ? "" : e.value);
  var estado = ESTADOS[etiqueta];
  var ref = String(sh.getRange(fila, C.referencia).getValue() || "");

  if (!ref) return;
  if (!estado) {
    celda.setValue(anterior);
    ss.toast("Estado no válido. Usa el desplegable.", "Caja", 6);
    return;
  }

  var res = llamarWeb_({ accion: "estado", referencia: ref, estado: estado });
  if (!res.ok) {
    celda.setValue(anterior);
    celda.setNote("No se pudo cambiar a «" + etiqueta + "» (" + hoy_() + "): " + (res.error || "error"));
    ss.toast("No se pudo cambiar " + ref + ": " + (res.error || "error") + ". La celda vuelve a su valor.", "Caja", 12);
    return;
  }
  celda.setNote(null);
  if (res.avisado) sh.getRange(fila, C.avisado).setValue(new Date(res.avisado));
  pintarFila_(sh, fila, estado);
  rehacerHojas();
  if (estado === "listo") {
    ss.toast("Aviso de recogida enviado a " + sh.getRange(fila, C.email).getValue() + ".", "Caja", 6);
  }
}

/* ─────────────────────────── Sincronización ─────────────────────────── */

function sincronizarDesdeMenu() {
  var r = sincronizar();
  SpreadsheetApp.getUi().alert("Sincronización", r, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Pide a la web todos los pedidos: añade los que falten y pone al día estado y aviso de los que
 * ya están. Lo lanza el activador horario y el menú. Los cambios hechos por código no disparan
 * `alEditar`, así que esto nunca reenvía avisos.
 */
function sincronizar() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return "Otra sincronización en curso; prueba en un minuto.";
  try {
    var res = llamarWeb_({ accion: "sincronizar" });
    if (!res.ok) return "La web respondió: " + (res.error || "error");

    if (res.catalogo) {
      PropertiesService.getScriptProperties().setProperty("CATALOGO", JSON.stringify(res.catalogo));
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = pedidosHoja_(ss);
    var nuevos = [];
    var cambiados = 0;
    (res.pedidos || []).forEach(function (p) {
      var fila = filaDe_(sh, p.referencia);
      if (!fila) {
        nuevos.push(p);
        return;
      }
      var etiqueta = ETIQUETAS[p.estado] || p.estado;
      if (sh.getRange(fila, C.estado).getValue() !== etiqueta) {
        sh.getRange(fila, C.estado).setValue(etiqueta);
        pintarFila_(sh, fila, p.estado);
        cambiados++;
      }
      if (p.avisado && !sh.getRange(fila, C.avisado).getValue()) {
        sh.getRange(fila, C.avisado).setValue(new Date(p.avisado));
      }
      var celdaAp = sh.getRange(fila, C.aportacion);
      if (celdaAp.getValue() === "" && p.aportacion !== undefined) celdaAp.setValue(Number(p.aportacion) || 0);
      // Lote al proveedor: lo pone la web el día 21 al cerrar el lote del mes.
      var celdaLote = sh.getRange(fila, C.lote);
      if (p.lote && celdaLote.getDisplayValue() !== p.lote) celdaLote.setValue(p.lote);
    });
    if (nuevos.length) {
      anadir_(sh, nuevos);
      llamarWeb_({ accion: "volcados", referencias: nuevos.map(function (p) { return p.referencia; }) });
    }
    rehacerHojas();
    return "Pedidos añadidos: " + nuevos.length + " · estados puestos al día: " + cambiados +
      " · confirmaciones reenviadas: " + (res.correos || 0) + ".";
  } finally {
    lock.releaseLock();
  }
}

/* ──────────────────────── Producción y Recogida ──────────────────────── */

/** Rehace las hojas derivadas a partir de «Pedidos» (y del catálogo que mandó la web). */
function rehacerHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var datos = datos_(pedidosHoja_(ss));
  var cat = catalogoGuardado_();
  rehacerProduccion_(ss, datos);
  rehacerRecogida_(ss, datos);
  rehacerDashboard_(ss, datos, cat);
  rehacerCatalogo_(ss, cat);
  if (!ss.getSheetByName(H_HOWTO)) rehacerHowTo_(ss);
}

/**
 * Desde el menú, además, coloca las pestañas en su orden. NO se hace en `rehacerHojas`
 * porque esa la lanzan también los activadores (cada cambio de estado, cada pedido): mover
 * pestañas activa hojas y te sacaría de la que estás editando.
 */
function rehacerHojasDesdeMenu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  rehacerHowTo_(ss);
  rehacerHojas();
  ordenarPestanas_(ss);
  ss.toast(catalogoGuardado_()
    ? "Hojas de resumen al día."
    : "Hojas al día. Falta el catálogo: pulsa «Sincronizar ahora» para traerlo de la web.", "Caja", 6);
}

/** Unidades por talla y estado. «Por preparar» es lo que hay que pedir o tener a mano. */
function rehacerProduccion_(ss, datos) {
  var sh = ss.getSheetByName("Producción") || ss.insertSheet("Producción");
  sh.clear();
  var cuenta = {};
  TALLAS.forEach(function (t) { cuenta[t] = { pagado: 0, listo: 0, entregado: 0 }; });
  datos.forEach(function (f) {
    var estado = ESTADOS[f[C.estado - 1]];
    if (!estado || estado === "anulado") return;
    parseTallas_(f[C.tallas - 1]).forEach(function (x) {
      if (!cuenta[x.talla]) cuenta[x.talla] = { pagado: 0, listo: 0, entregado: 0 };
      cuenta[x.talla][estado] += x.cantidad;
    });
  });
  var filas = Object.keys(cuenta).map(function (t) {
    var c = cuenta[t];
    return [t, c.pagado, c.listo, c.entregado, c.pagado + c.listo + c.entregado];
  });
  var tot = filas.reduce(function (a, r) { return [a[0], a[1] + r[1], a[2] + r[2], a[3] + r[3], a[4] + r[4]]; }, ["TOTAL", 0, 0, 0, 0]);
  sh.getRange(1, 1).setValue("Producción por talla").setFontSize(14).setFontWeight("bold");
  sh.getRange(2, 1).setValue("Actualizado: " + hoy_() + " · no cuenta los pedidos anulados").setFontColor("#5b6b82");
  var cab = ["Talla", "Por preparar (Pagado)", "Listos para recoger", "Entregados", "Total vendido"];
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight("bold").setBackground(COLOR.cabecera).setFontColor("#ffffff");
  sh.getRange(5, 1, filas.length, cab.length).setValues(filas);
  sh.getRange(5 + filas.length, 1, 1, cab.length).setValues([tot]).setFontWeight("bold").setBackground("#eef0f3");
  sh.setColumnWidth(1, 80);
  sh.setColumnWidths(2, 4, 170);
  sh.setFrozenRows(4);
}

/**
 * Una lista por centro con lo pendiente de entregar (Pagado y Listo), para imprimirla y que el
 * coordinador de logística marque la firma al entregar.
 */
function rehacerRecogida_(ss, datos) {
  var sh = ss.getSheetByName("Recogida") || ss.insertSheet("Recogida");
  sh.clear();
  sh.getRange(1, 1).setValue("Recogida por centro").setFontSize(14).setFontWeight("bold");
  sh.getRange(2, 1).setValue("Pedidos pagados o listos, aún sin entregar · " + hoy_()).setFontColor("#5b6b82");
  var cab = ["Referencia", "Nombre", "Teléfono", "Tallas", "Uds.", "Estado", "Firma"];
  var fila = 4;
  var centros = CENTROS.slice();
  datos.forEach(function (f) {
    var c = f[C.centro - 1];
    if (c && centros.indexOf(c) < 0) centros.push(c);
  });
  centros.forEach(function (centro) {
    var lista = datos
      .filter(function (f) {
        var e = ESTADOS[f[C.estado - 1]];
        return f[C.centro - 1] === centro && (e === "pagado" || e === "listo");
      })
      .sort(function (a, b) { return String(a[C.nombre - 1]).localeCompare(String(b[C.nombre - 1]), "es"); });
    if (!lista.length) return;
    var uds = lista.reduce(function (a, f) { return a + (Number(f[C.unidades - 1]) || 0); }, 0);
    sh.getRange(fila, 1).setValue(centro + " — " + lista.length + " pedidos · " + uds + " uds.")
      .setFontSize(12).setFontWeight("bold");
    fila++;
    sh.getRange(fila, 1, 1, cab.length).setValues([cab]).setFontWeight("bold")
      .setBackground(COLOR.cabecera).setFontColor("#ffffff");
    fila++;
    var filas = lista.map(function (f) {
      return [f[C.referencia - 1], f[C.nombre - 1], f[C.telefono - 1], f[C.tallas - 1], f[C.unidades - 1], f[C.estado - 1], ""];
    });
    sh.getRange(fila, 1, filas.length, cab.length).setValues(filas).setBorder(true, true, true, true, true, true, "#c9d1dd", SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(fila, 3, filas.length, 1).setNumberFormat("@");
    fila += filas.length + 2;
  });
  if (fila === 4) sh.getRange(4, 1).setValue("No hay pedidos pendientes de entregar.");
  sh.setColumnWidths(1, 1, 110);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 130);
  sh.setColumnWidth(4, 200);
  sh.setColumnWidth(5, 50);
  sh.setColumnWidth(6, 140);
  sh.setColumnWidth(7, 160);
}

/* ─────────────────── 00_HOW_TO · 01_DASHBOARD · CATALOGO ─────────────────── */

/** Sube este número cuando cambie la guía: se reescribe sola en el siguiente rehacer. */
var HOWTO_VERSION = "2";

/** Guía breve, con aspecto de informe (Power BI). Pensada para Tesorería. */
function rehacerHowTo_(ss) {
  var props = PropertiesService.getScriptProperties();
  var sh = ss.getSheetByName(H_HOWTO);
  if (sh && props.getProperty("HOWTO_V") === HOWTO_VERSION) return;
  sh = sh || ss.insertSheet(H_HOWTO);
  limpiarHoja_(sh);
  sh.setHiddenGridlines(true);
  sh.setTabColor(PBI.marino);
  [16, 52, 200, 700, 16].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  lienzo_(sh, 60, 5);
  banda_(sh, 5, "📘  Cómo funciona este Sheet",
    "Guía rápida para Tesorería  ·  la fuente de verdad es la web  ·  este Sheet es la mesa de trabajo");

  var secciones = [
    { titulo: "🧭  Lo esencial", color: PBI.azul, filas: [
      ["💡", "Qué es", "La mesa de trabajo de los pedidos de material de campaña. Cada pedido pagado llega aquí solo desde la web. Si algo se borra, «📦 Caja ▸ Sincronizar ahora» lo vuelve a llenar."],
      ["✏️", "Qué se edita", "SOLO la columna «Estado» de la hoja Pedidos, de uno en uno y con el desplegable. «Notas» es libre. El resto es copia de la web: si lo cambias aquí, la web no se entera."],
    ] },
    { titulo: "🔁  Estados de un pedido", color: PBI.naranja, filas: [
      ["💳", "Pagado", "Llega solo al pagarse. El comprador ya ha recibido el correo de confirmación del pago.", "pagado"],
      ["📣", "Listo para recoger", "⚠️ ENVÍA un correo al comprador avisando de que puede recogerlo en su centro. Solo una vez: aunque lo quites y lo vuelvas a poner, no se repite. Si el correo no sale, la celda vuelve a su valor y deja una nota con el motivo.", "listo", true],
      ["✅", "Entregado", "Sin correo. Márcalo cuando se haya recogido.", "entregado"],
      ["⛔", "Anulado", "Sin correo. No cuenta en Producción ni en el Dashboard. Ojo: anular aquí NO devuelve el dinero; un reembolso se hace en Stripe.", "anulado"],
    ] },
    { titulo: "🗂️  Las hojas", color: PBI.morado, filas: [
      ["📊", H_DASH, "Indicadores, pedidos por estado, producción por talla y lo que llega a la caja. Se rehace sola."],
      ["🧾", HOJA, "Un pedido por fila. Aquí se cambia el estado."],
      ["👕", "Producción", "Unidades por talla. «Por preparar» es lo que hay que encargar o tener a mano."],
      ["📍", "Recogida", "Lista por centro de lo pendiente de entregar, para imprimirla y firmar al entregar."],
      ["🔒", H_CATALOGO, "Productos y precios, SOLO LECTURA. Se cambian en la web (pídelo); aquí se ponen al día solos al sincronizar."],
    ] },
    { titulo: "⚙️  Funcionamiento", color: PBI.verde, filas: [
      ["🔄", "Sincronización", "Cada hora, sola. Para forzarla: «📦 Caja ▸ Sincronizar ahora». Si cambias varias celdas de golpe, la web no se entera: sincroniza y vuelven los estados reales."],
      ["🛟", "Si algo falla", "La celda vuelve a su valor anterior y queda una nota explicando qué pasó. No se pierde nada: la web guarda cada pedido."],
    ] },
  ];

  var fila = 4;
  secciones.forEach(function (s) {
    sh.getRange(fila, 2, 1, 3).merge().setValue(s.titulo).setFontSize(13).setFontWeight("bold")
      .setVerticalAlignment("bottom")
      .setBorder(null, null, true, null, null, null, s.color, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setRowHeight(fila, 36);
    fila++;
    s.filas.forEach(function (f) {
      sh.getRange(fila, 2, 1, 3).setBackground(PBI.panel).setVerticalAlignment("middle")
        .setBorder(null, null, true, null, null, null, PBI.linea, SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(fila, 2).setValue(f[0]).setFontSize(16).setHorizontalAlignment("center")
        .setBorder(null, true, null, null, null, null, s.color, SpreadsheetApp.BorderStyle.SOLID_THICK);
      var etiqueta = sh.getRange(fila, 3).setValue(f[1]).setFontWeight("bold");
      if (f[3]) etiqueta.setFontColor(ESTADO_PBI[f[3]]);
      var texto = sh.getRange(fila, 4).setValue(f[2]).setWrap(true);
      if (f[4]) texto.setBackground(PBI.aviso).setFontWeight("bold");
      sh.setRowHeight(fila, Math.max(34, 18 * Math.ceil(f[2].length / 100) + 14));
      fila++;
    });
    fila++;
  });
  sh.setFrozenRows(2);
  props.setProperty("HOWTO_V", HOWTO_VERSION);
}

/** El catálogo que mandó la web en la última sincronización (o null si aún no ha llegado). */
function catalogoGuardado_() {
  var j = PropertiesService.getScriptProperties().getProperty("CATALOGO");
  if (!j) return null;
  try { return JSON.parse(j); } catch (x) { return null; }
}

function redondear_(v) { return Math.round(v * 100) / 100; }

/**
 * Las cuentas del Dashboard, sin tocar hojas (así se pueden probar fuera de Google).
 * Los anulados se cuentan por estado pero NO entran en totales, producción ni caja.
 * Total de un pedido = unidades × precio + aportación (lo fija la web). La comisión de Stripe
 * es una ESTIMACIÓN con la tarifa configurada en la web, la misma con la que se calcula el
 * reparto publicado; la exacta depende de la tarjeta y está en el panel de Stripe.
 * Hoy hay un solo producto: el coste se toma del primero del catálogo.
 */
function calcularResumen_(datos, cat) {
  var porEstado = {}, tallas = {};
  var t = { pedidos: 0, uds: 0, cobrado: 0, aportacion: 0, coste: 0, comision: 0 };
  Object.keys(ESTADOS).forEach(function (k) { porEstado[k] = { pedidos: 0, uds: 0 }; });
  var prod = cat && cat.productos && cat.productos[0];
  datos.forEach(function (f) {
    var etiqueta = f[C.estado - 1], estado = ESTADOS[etiqueta];
    if (!estado) return;
    var uds = Number(f[C.unidades - 1]) || 0, total = Number(f[C.total - 1]) || 0;
    porEstado[etiqueta].pedidos++;
    porEstado[etiqueta].uds += uds;
    if (estado === "anulado") return;
    t.pedidos++;
    t.uds += uds;
    t.cobrado += total;
    t.aportacion += Number(f[C.aportacion - 1]) || 0;
    if (prod) t.coste += uds * prod.coste;
    if (cat && cat.comision) t.comision += redondear_(total * cat.comision.pct + cat.comision.fijo);
    parseTallas_(f[C.tallas - 1]).forEach(function (x) {
      if (!tallas[x.talla]) tallas[x.talla] = { pagado: 0, listo: 0, entregado: 0 };
      tallas[x.talla][estado] += x.cantidad;
    });
  });
  t.cobrado = redondear_(t.cobrado);
  t.aportacion = redondear_(t.aportacion);
  t.coste = redondear_(t.coste);
  t.comision = redondear_(t.comision);
  t.material = redondear_(t.cobrado - t.aportacion);
  t.caja = prod && cat.comision ? redondear_(t.cobrado - t.coste - t.comision) : null;
  return { porEstado: porEstado, tallas: tallas, totales: t, conCatalogo: t.caja !== null };
}

/*
 * Dashboard con aspecto de informe Power BI: lienzo gris, banda de cabecera, tarjetas KPI con
 * filo de color, dos paneles con gráfico (donut por estado, columnas apiladas por talla) y un
 * desglose con barras de datos. Rejilla fija de 13 columnas:
 *   A │ B C │ D │ E F │ G │ H I │ J │ K L │ M     (D, G y J son calles estrechas)
 */
var DASH_ANCHOS = [16, 120, 120, 14, 120, 120, 14, 120, 120, 14, 120, 120, 16];

function rehacerDashboard_(ss, datos, cat) {
  var sh = ss.getSheetByName(H_DASH) || ss.insertSheet(H_DASH);
  limpiarHoja_(sh);
  sh.setHiddenGridlines(true);
  sh.setTabColor(PBI.azul);
  DASH_ANCHOS.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  var r = calcularResumen_(datos, cat), t = r.totales, EUR = "#,##0.00 €";
  var nombre = cat && cat.productos && cat.productos[0] ? cat.productos[0].nombre : "Producto";

  // Filas de las tablas, para saber cuánto lienzo pintar antes de escribir.
  var tallas = TALLAS.concat(Object.keys(r.tallas).filter(function (x) { return TALLAS.indexOf(x) < 0; }))
    .filter(function (x) { return r.tallas[x]; });
  var finPaneles = 23 + Math.max(Object.keys(ESTADOS).length, tallas.length + 1);
  lienzo_(sh, finPaneles + 16, DASH_ANCHOS.length);
  banda_(sh, DASH_ANCHOS.length, "📊  Dashboard · Material de campaña",
    "Actualizado " + hoy_() + "  ·  sin contar pedidos anulados  ·  la fuente de verdad es la web");

  // ── Tarjetas KPI ──
  var anulados = r.porEstado["Anulado"].pedidos;
  var pct = r.conCatalogo && t.cobrado ? t.caja / t.cobrado : null;
  [
    { icono: "🧾", titulo: "PEDIDOS", valor: t.pedidos, fmt: "0", color: PBI.azul,
      pie: anulados ? "+ " + anulados + (anulados > 1 ? " anulados" : " anulado") + ", fuera del total" : "ninguno anulado" },
    { icono: "👕", titulo: "UNIDADES", valor: t.uds, fmt: "0", color: PBI.naranja,
      pie: r.porEstado["Pagado"].uds + " por preparar" },
    { icono: "💶", titulo: "COBRADO", valor: t.cobrado, fmt: EUR, color: PBI.morado,
      pie: "de ello " + eur_(t.aportacion) + " en aportaciones" },
    { icono: "🏦", titulo: "LLEGA A LA CAJA", valor: r.conCatalogo ? t.caja : "—", fmt: EUR, color: PBI.verde,
      pie: pct === null ? "sincroniza para calcularlo" : pctTxt_(pct) + " de lo cobrado" },
  ].forEach(function (k, i) { tarjeta_(sh, 4, 2 + i * 3, k); });
  sh.setRowHeight(4, 30);
  sh.setRowHeight(5, 46);
  sh.setRowHeight(6, 26);
  sh.setRowHeight(7, 18);

  // ── Paneles con gráfico ──
  panel_(sh, 8, 2, 5, finPaneles - 7, "📌  Pedidos por estado");
  panel_(sh, 8, 8, 5, finPaneles - 7, "📏  Producción · " + nombre);

  // Tabla de estados (B, C, E, F; D es la calle).
  cabeceraTabla_(sh, 23, [[2, "Estado"], [3, "Pedidos"], [5, "Uds."], [6, "Peso"]]);
  var maxPed = Math.max.apply(null, Object.keys(ESTADOS).map(function (k) { return r.porEstado[k].pedidos; }).concat([1]));
  Object.keys(ESTADOS).forEach(function (k, i) {
    var f = 24 + i, e = r.porEstado[k], color = ESTADO_PBI[ESTADOS[k]];
    sh.getRange(f, 2).setValue(k).setFontWeight("bold").setFontColor(color);
    sh.getRange(f, 3).setValue(e.pedidos);
    sh.getRange(f, 5).setValue(e.uds);
    sh.getRange(f, 6).setValue(barra_(e.pedidos, maxPed, 12)).setFontColor(color);
    filaTabla_(sh, f, 2, 5);
  });
  sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange(23, 2, Object.keys(ESTADOS).length + 1, 2))
    .setNumHeaders(1)
    .setPosition(9, 2, 6, 4)
    .setOption("pieHole", 0.58)
    .setOption("colors", Object.keys(ESTADOS).map(function (k) { return ESTADO_PBI[ESTADOS[k]]; }))
    .setOption("pieSliceText", "value")
    .setOption("pieSliceBorderColor", PBI.panel)
    .setOption("legend", { position: "right", textStyle: { color: PBI.suave, fontSize: 11 } })
    .setOption("chartArea", { left: 12, top: 12, width: "92%", height: "88%" })
    .setOption("backgroundColor", PBI.panel)
    .setOption("width", 480)
    .setOption("height", 290)
    .build();

  // Tabla de producción (H, I, K, L; J es la calle).
  cabeceraTabla_(sh, 23, [[8, "Talla"], [9, "Por preparar"], [11, "Listos"], [12, "Entregados"]]);
  var tot = [0, 0, 0];
  tallas.forEach(function (x, i) {
    var f = 24 + i, c = r.tallas[x];
    sh.getRange(f, 8).setValue(x).setFontWeight("bold");
    sh.getRange(f, 9).setValue(c.pagado).setFontColor(c.pagado ? PBI.naranja : PBI.gris).setFontWeight(c.pagado ? "bold" : "normal");
    sh.getRange(f, 11).setValue(c.listo);
    sh.getRange(f, 12).setValue(c.entregado);
    filaTabla_(sh, f, 8, 5);
    tot = [tot[0] + c.pagado, tot[1] + c.listo, tot[2] + c.entregado];
  });
  var fTot = 24 + tallas.length;
  sh.getRange(fTot, 8).setValue("TOTAL");
  sh.getRange(fTot, 9).setValue(tot[0]);
  sh.getRange(fTot, 11).setValue(tot[1]);
  sh.getRange(fTot, 12).setValue(tot[2]);
  sh.getRange(fTot, 8, 1, 5).setFontWeight("bold").setBackground(PBI.lienzoSuave);
  if (tallas.length) {
    sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(23, 8, tallas.length + 1, 2))
      .addRange(sh.getRange(23, 11, tallas.length + 1, 2))
      .setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS)
      .setNumHeaders(1)
      .setPosition(9, 8, 6, 4)
      .setOption("isStacked", true)
      .setOption("colors", [PBI.naranja, PBI.azul, PBI.verde])
      .setOption("legend", { position: "top", alignment: "end", textStyle: { color: PBI.suave, fontSize: 11 } })
      .setOption("vAxis", { format: "0", minValue: 0, gridlines: { color: PBI.linea }, textStyle: { color: PBI.suave } })
      .setOption("hAxis", { textStyle: { color: PBI.suave } })
      .setOption("bar", { groupWidth: "62%" })
      .setOption("chartArea", { left: 40, top: 36, width: "86%", height: "74%" })
      .setOption("backgroundColor", PBI.panel)
      .setOption("width", 480)
      .setOption("height", 290)
      .build();
  } else {
    sh.getRange(14, 8, 1, 5).merge().setValue("Sin pedidos todavía").setFontColor(PBI.gris)
      .setHorizontalAlignment("center").setFontSize(12);
  }

  // ── De lo cobrado a la caja ──
  var f0 = finPaneles + 2;
  panel_(sh, f0, 2, 11, 10, "💰  De lo cobrado a la caja");
  var max = Math.max(t.cobrado, 1);
  var lineas = [
    ["💶  Cobrado (total de los pedidos)", t.cobrado, PBI.azul, true],
    ["        ↳ material de campaña", t.material, PBI.azulClaro],
    ["        ↳ aportaciones voluntarias", t.aportacion, PBI.morado],
    ["🏭  − Coste de producción del material", r.conCatalogo ? -t.coste : null, PBI.naranja],
    ["💳  − Comisión de Stripe (estimada)", r.conCatalogo ? -t.comision : null, PBI.rojo],
    ["🏦  = Llega a la caja", r.conCatalogo ? t.caja : null, PBI.verde, true],
  ];
  lineas.forEach(function (l, i) {
    var f = f0 + 1 + i;
    sh.getRange(f, 2, 1, 3).merge().setValue(l[0]).setFontWeight(l[3] ? "bold" : "normal");
    sh.getRange(f, 5, 1, 2).merge().setValue(l[1] === null ? "—" : l[1]).setNumberFormat(EUR)
      .setHorizontalAlignment("right").setFontWeight(l[3] ? "bold" : "normal");
    sh.getRange(f, 8, 1, 5).merge().setValue(l[1] === null ? "" : barra_(Math.abs(l[1]), max, 34))
      .setFontColor(l[2]);
    filaTabla_(sh, f, 2, 11);
    sh.setRowHeight(f, 26);
  });
  sh.getRange(f0 + lineas.length, 2, 1, 11).setBackground(PBI.verdeSuave);
  sh.getRange(f0 + 8, 2, 1, 11).merge().setValue(r.conCatalogo
    ? "ℹ️  La comisión es una estimación con la tarifa configurada en la web; la exacta depende de cada tarjeta y está en el panel de Stripe."
    : "ℹ️  Falta el catálogo (coste y comisión): pulsa «📦 Caja ▸ Sincronizar ahora» para traerlo de la web.")
    .setFontColor(PBI.suave).setFontSize(9);
  sh.setFrozenRows(2);
}

/* ─────────────── Piezas de estilo (Power BI) compartidas por las hojas ─────────────── */

var PBI = {
  fuente: "Roboto",
  lienzo: "#F3F2F1", lienzoSuave: "#F7F6F5", panel: "#FFFFFF", linea: "#EDEBE9",
  texto: "#252423", suave: "#605E5C", gris: "#A19F9D", banda: COLOR.cabecera, bandaTexto: "#C8D1DC",
  azul: "#118DFF", azulClaro: "#6CB4FF", marino: "#12239E", naranja: "#E66C37", verde: "#1AAB40",
  verdeSuave: "#E8F6EC", rojo: "#D64550", morado: "#744EC2", aviso: "#FFF4CE",
};
/** Color fuerte de cada estado: Pagado = por preparar (naranja), Listo (azul), Entregado (verde). */
var ESTADO_PBI = { pagado: PBI.naranja, listo: PBI.azul, entregado: PBI.verde, anulado: PBI.rojo };

/** Deja la hoja en blanco de verdad: sin gráficos, sin celdas combinadas y con altos por defecto. */
function limpiarHoja_(sh) {
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.setFrozenRows(0);
  sh.setRowHeights(1, sh.getMaxRows(), 21);
}

function lienzo_(sh, filas, cols) {
  sh.getRange(1, 1, filas, cols).setBackground(PBI.lienzo).setFontFamily(PBI.fuente)
    .setFontColor(PBI.texto).setFontSize(10).setVerticalAlignment("middle");
}

function banda_(sh, cols, titulo, subtitulo) {
  sh.getRange(1, 1, 2, cols).setBackground(PBI.banda);
  sh.getRange(1, 2, 1, cols - 2).merge().setValue(titulo).setFontSize(18).setFontWeight("bold")
    .setFontColor("#FFFFFF").setVerticalAlignment("bottom");
  sh.getRange(2, 2, 1, cols - 2).merge().setValue(subtitulo).setFontSize(10)
    .setFontColor(PBI.bandaTexto).setVerticalAlignment("top");
  sh.setRowHeight(1, 42);
  sh.setRowHeight(2, 26);
  sh.setRowHeight(3, 16);
}

/** Tarjeta KPI de 3 filas × 2 columnas, con filo superior de color. */
function tarjeta_(sh, fila, col, k) {
  var caja = sh.getRange(fila, col, 3, 2).setBackground(PBI.panel).setHorizontalAlignment("center");
  sh.getRange(fila, col, 1, 2).merge().setValue(k.icono + "  " + k.titulo).setFontSize(9)
    .setFontWeight("bold").setFontColor(PBI.suave).setVerticalAlignment("bottom");
  sh.getRange(fila + 1, col, 1, 2).merge().setValue(k.valor).setNumberFormat(k.fmt).setFontSize(24)
    .setFontWeight("bold").setFontColor(PBI.texto);
  sh.getRange(fila + 2, col, 1, 2).merge().setValue(k.pie).setFontSize(9).setFontColor(PBI.suave)
    .setVerticalAlignment("top");
  caja.setBorder(true, true, true, true, null, null, PBI.linea, SpreadsheetApp.BorderStyle.SOLID);
  caja.setBorder(true, null, null, null, null, null, k.color, SpreadsheetApp.BorderStyle.SOLID_THICK);
}

/** Panel blanco con título e icono. */
function panel_(sh, fila, col, cols, filas, titulo) {
  sh.getRange(fila, col, filas, cols).setBackground(PBI.panel)
    .setBorder(true, true, true, true, null, null, PBI.linea, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(fila, col, 1, cols).merge().setValue("  " + titulo).setFontSize(12).setFontWeight("bold")
    .setFontColor(PBI.texto);
  sh.setRowHeight(fila, 32);
}

function cabeceraTabla_(sh, fila, celdas) {
  celdas.forEach(function (c) {
    sh.getRange(fila, c[0]).setValue(c[1]).setFontSize(9).setFontWeight("bold").setFontColor(PBI.suave)
      .setBorder(null, null, true, null, null, null, PBI.texto, SpreadsheetApp.BorderStyle.SOLID);
  });
}

function filaTabla_(sh, fila, col, cols) {
  sh.getRange(fila, col, 1, cols)
    .setBorder(null, null, true, null, null, null, PBI.linea, SpreadsheetApp.BorderStyle.SOLID);
}

/** Barra de datos en texto (no depende de fórmulas ni del idioma del Sheet). */
function barra_(v, max, ancho) {
  var n = max > 0 ? Math.round(ancho * v / max) : 0;
  return v > 0 ? new Array(Math.max(n, 1) + 1).join("█") : "";
}

function eur_(v) {
  var p = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "−" : "") + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + p[1] + " €";
}

function pctTxt_(p) { return (p * 100).toFixed(1).replace(".", ",") + " %"; }

/** Catálogo de SOLO LECTURA: lo escribe la sincronización con lo que manda la web. */
function rehacerCatalogo_(ss, cat) {
  var sh = ss.getSheetByName(H_CATALOGO) || ss.insertSheet(H_CATALOGO);
  sh.clear();
  sh.getRange(1, 1).setValue("Catálogo (solo lectura)").setFontSize(14).setFontWeight("bold");
  sh.getRange(2, 1).setValue("Lo manda la web al sincronizar. Precios y productos se cambian en la web, que es la que " +
    "valida cada cobro: cambiarlos aquí no tendría ningún efecto.").setFontColor("#5b6b82");
  var cab = ["Producto", "Precio €", "Coste €", "A la caja por unidad €", "Tallas"];
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight("bold")
    .setBackground(COLOR.cabecera).setFontColor("#ffffff");
  if (!cat || !cat.productos || !cat.productos.length) {
    sh.getRange(5, 1).setValue("Aún no ha llegado el catálogo: pulsa «📦 Caja ▸ Sincronizar ahora».");
  } else {
    var filas = cat.productos.map(function (p) {
      return [p.nombre, p.precio, p.coste, p.caja_por_unidad, (p.tallas || []).join(" · ")];
    });
    sh.getRange(5, 1, filas.length, cab.length).setValues(filas);
    sh.getRange(5, 2, filas.length, 3).setNumberFormat("#,##0.00 €");
    var notas = ["Venta " + (cat.activo ? "ABIERTA" : "CERRADA") + " en la web."];
    if (cat.comision) {
      notas.unshift("Comisión de Stripe configurada: " + String(cat.comision.pct * 100).replace(".", ",") +
        " % + " + cat.comision.fijo.toFixed(2).replace(".", ",") + " € por pago. «A la caja por unidad» es " +
        "para un pedido de una sola unidad; en pedidos de varias la comisión fija se reparte.");
    }
    sh.getRange(6 + filas.length, 1, notas.length, 1).setValues(notas.map(function (n) { return [n]; }))
      .setFontColor("#5b6b82");
  }
  sh.setColumnWidth(1, 220);
  sh.setColumnWidths(2, 2, 90);
  sh.setColumnWidth(4, 170);
  sh.setColumnWidth(5, 280);
  // Aviso si alguien intenta editarla (no bloquea, solo avisa: el script sigue pudiendo escribir).
  if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
    sh.protect().setDescription("Catálogo: lo escribe la web al sincronizar").setWarningOnly(true);
  }
}

/** Orden de pestañas como en la Plataforma Solidaria: guía y panel delante, catálogo al final. */
function ordenarPestanas_(ss) {
  var activa = ss.getActiveSheet();
  [H_HOWTO, H_DASH, HOJA, "Producción", "Recogida", H_CATALOGO].forEach(function (n, i) {
    var sh = ss.getSheetByName(n);
    if (!sh) return;
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  if (activa) ss.setActiveSheet(activa);
}

/* ─────────────────────────────── Ayudas ─────────────────────────────── */

function pedidosHoja_(ss) {
  var sh = ss.getSheetByName(HOJA);
  if (sh) {
    // Hojas creadas antes de la columna «Aportación €»: se le pone cabecera y formato.
    if (sh.getRange(1, C.aportacion).getValue() !== HEADERS[C.aportacion - 1]) {
      sh.getRange(1, C.aportacion).setValue(HEADERS[C.aportacion - 1]).setFontWeight("bold")
        .setBackground(COLOR.cabecera).setFontColor("#ffffff");
      sh.getRange(2, C.aportacion, sh.getMaxRows() - 1, 1).setNumberFormat("#,##0.00 €");
      sh.setColumnWidth(C.aportacion, 110);
    }
    // Y antes de la columna «Lote»: texto, para que «2026-10» no se convierta en fecha.
    if (sh.getRange(1, C.lote).getValue() !== HEADERS[C.lote - 1]) {
      sh.getRange(1, C.lote).setValue(HEADERS[C.lote - 1]).setFontWeight("bold")
        .setBackground(COLOR.cabecera).setFontColor("#ffffff");
      sh.getRange(2, C.lote, sh.getMaxRows() - 1, 1).setNumberFormat("@");
      sh.setColumnWidth(C.lote, 80);
    }
    return sh;
  }
  sh = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0
    ? ss.getSheets()[0].setName(HOJA)
    : ss.insertSheet(HOJA, 0);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold")
    .setBackground(COLOR.cabecera).setFontColor("#ffffff");
  sh.setFrozenRows(1);
  var max = sh.getMaxRows();
  sh.getRange(2, C.estado, max - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(ESTADOS), true).setAllowInvalid(false).build()
  );
  sh.getRange(2, C.fecha, max - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(2, C.avisado, max - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(2, C.telefono, max - 1, 1).setNumberFormat("@");
  sh.getRange(2, C.total, max - 1, 1).setNumberFormat("#,##0.00 €");
  sh.getRange(2, C.aportacion, max - 1, 1).setNumberFormat("#,##0.00 €");
  sh.getRange(2, C.lote, max - 1, 1).setNumberFormat("@");
  [130, 110, 150, 200, 230, 130, 100, 170, 50, 80, 60, 140, 220, 110, 80].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  return sh;
}

function anadir_(sh, pedidos) {
  var filas = pedidos.map(function (p) {
    return [
      p.fecha ? new Date(p.fecha) : new Date(),
      p.referencia,
      ETIQUETAS[p.estado] || p.estado,
      p.nombre,
      p.email,
      p.telefono || "",
      p.centro,
      p.tallas,
      Number(p.unidades) || 0,
      Number(p.total) || 0,
      p.idioma || "es",
      p.avisado ? new Date(p.avisado) : "",
      "",
      Number(p.aportacion) || 0,
      p.lote || "",
    ];
  });
  var desde = sh.getLastRow() + 1;
  sh.getRange(desde, 1, filas.length, HEADERS.length).setValues(filas);
  pedidos.forEach(function (p, i) { pintarFila_(sh, desde + i, p.estado); });
}

function pintarFila_(sh, fila, estado) {
  var fondo = COLOR[estado] || null;
  var rango = sh.getRange(fila, 1, 1, HEADERS.length);
  rango.setBackground(fondo);
  rango.setFontLine(estado === "anulado" ? "line-through" : "none");
}

function filaDe_(sh, referencia) {
  if (sh.getLastRow() < 2) return 0;
  var hit = sh.getRange(2, C.referencia, sh.getLastRow() - 1, 1)
    .createTextFinder(String(referencia)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function datos_(sh) {
  return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues() : [];
}

/** «M × 2 · L × 1» → [{talla:"M",cantidad:2},{talla:"L",cantidad:1}]. */
function parseTallas_(texto) {
  return String(texto || "").split("·").map(function (t) {
    var m = t.trim().match(/^(\S+)\s*[×x]\s*(\d+)$/);
    return m ? { talla: m[1], cantidad: Number(m[2]) } : null;
  }).filter(Boolean);
}

function llamarWeb_(payload) {
  var secreto = PropertiesService.getScriptProperties().getProperty("SECRETO");
  if (!secreto) return { ok: false, error: "Falta configurar: menú Caja ▸ Configurar" };
  try {
    var r = UrlFetchApp.fetch(WEB + "/api/sheet", {
      method: "post",
      contentType: "application/json",
      headers: { "X-Caja-Secreto": secreto },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var cuerpo = {};
    try { cuerpo = JSON.parse(r.getContentText()); } catch (x) { cuerpo = {}; }
    if (r.getResponseCode() !== 200 || !cuerpo.ok) {
      return { ok: false, error: cuerpo.error || ("HTTP " + r.getResponseCode()) };
    }
    return cuerpo;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function secretoValido_(recibido) {
  var s = PropertiesService.getScriptProperties().getProperty("SECRETO");
  return Boolean(s) && recibido === s;
}

function hoy_() {
  return Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy HH:mm");
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
