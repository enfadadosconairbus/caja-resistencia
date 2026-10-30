/**
 * Datos del mundo real del fondo. ÚNICO punto de verdad.
 *
 * `null` significa "todavía no existe". Nunca significa "rellénalo con algo plausible":
 * ningún componente puede inventar un dato que falte aquí. La web deriva de este archivo
 * qué puede afirmar y qué anuncia como pendiente.
 *
 * Casi todo lo de aquí llega con el sindicato que asuma la titularidad del fondo.
 * `pendientes()` (abajo) enumera lo que falta y de quién depende cada cosa.
 */

/** Un hecho del mundo real que puede no existir todavía. */
export type Dato<T> = T | null;

/** Quién responde legalmente del fondo. Exigido por la LSSI-CE para el aviso legal. */
export interface TitularJuridico {
  razonSocial: Dato<string>;
  /** Asociación, caja sindical, entidad ad-hoc… Condiciona la fiscalidad. */
  forma: Dato<string>;
  cif: Dato<string>;
  domicilio: Dato<string>;
  registro: Dato<string>;
}

/** Canal primario: transferencia directa. Nadie lo puede cortar desde fuera. */
export interface CuentaBancaria {
  titular: Dato<string>;
  banco: Dato<string>;
  iban: Dato<string>;
  bic: Dato<string>;
  /** Concepto sugerido, para que la comisión pueda conciliar los ingresos. */
  concepto: Dato<string>;
}

export type MetodoPago =
  | "tarjeta"
  | "apple-pay"
  | "google-pay"
  | "bizum"
  | "amazon-pay"
  | "klarna"
  | "paypal"
  | "sepa";

/**
 * Secuencia real de alta, sin atajos. Arrancamos en `sin-titular` y ese escalón no
 * depende del estudio: la cuenta de comercio se abre a nombre del titular jurídico,
 * con su CIF y la verificación KYC de sus responsables.
 */
export type EstadoPasarela = "sin-titular" | "en-alta" | "sandbox" | "activa";

/** Canal secundario: comodidad de pago. Depende de un tercero que puede retirarla. */
export interface Pasarela {
  proveedor: Dato<string>;
  estado: EstadoPasarela;
  /** Métodos que el proveedor servirá una vez activo. Vacío mientras no haya alta. */
  metodos: MetodoPago[];
  /** Destino del botón de aportar. Sin esto no hay cobro, haya proveedor o no. */
  checkoutUrl: Dato<string>;
  /**
   * Bizum dentro de Stripe. El banco solo lo habilita mientras hay una campaña en curso
   * (huelga, elecciones sindicales, negociación del convenio), nunca entre campañas.
   * Con `false` la tarjeta de aportar lo muestra apagado y explica por qué. Se pone a mano,
   * no se deriva de `campanas`: depende de que el banco lo habilite, y hay que activarlo
   * también en el dashboard de Stripe.
   */
  bizumActivo: boolean;
}

/** Una línea del desglose de gastos. `importe: null` = aprobado pero aún sin imputar. */
/**
 * Tipo de gasto: la dimensión por la que filtra el panel de transparencia de /la-caja.
 * Agrupa conceptos (`clave`): las camisetas y las chapas son «material»; los trenes y los
 * autobuses, «desplazamientos». Etiquetas en `panel.tipos` de los diccionarios.
 */
export type TipoGasto = "material" | "desplazamientos" | "infraestructura" | "comisiones";

/** Un cargo en la cuenta, tal como sale en el extracto: fecha de la operación e importe. */
export interface Pago {
  fecha: string;
  importe: number;
}

export interface GastoLinea {
  /** Clave de i18n de la etiqueta (dictionaries → transparencia.detalle). */
  clave: string;
  tipo: TipoGasto;
  importe: Dato<number>;
  /**
   * Los cargos que suman `importe`, con su fecha del extracto. Los usa el panel para la
   * evolución en el tiempo y la tabla de movimientos. Tienen que sumar `importe` al
   * céntimo: lo comprueba `scripts/check-panel.mjs`.
   */
  pagos?: Pago[];
}

/**
 * Estado de una campaña. Ojo: es el estado de la CAMPAÑA, no el de la huelga.
 * La huelga puede estar en pausa y la campaña seguir en curso, porque la caja sigue
 * recibiendo — de hecho es lo que pasa hoy. El estado de la huelga lo cuenta la chapa de
 * arriba (`chapa-huelga.tsx`); duplicarlo aquí sería contradecirse a la primera.
 */
export type EstadoCampana = "en-curso" | "pausada" | "cerrada" | "prevista";

/**
 * Una campaña: un conflicto, una negociación, unas elecciones. La caja es PERMANENTE y las
 * atraviesa todas — no se cierra al acabar una, y el remanente pasa a la siguiente.
 *
 * QUÉ LLEVA Y QUÉ NO, que es lo que costó decidir:
 *
 *   · Lleva los GASTOS, porque un gasto sí sabe a qué campaña pertenece: una factura de
 *     autobuses tiene una marcha detrás.
 *   · NO lleva lo recaudado. Una aportación no viene con una campaña puesta: quien
 *     transfiere 20 € un martes está sosteniendo la caja, no financiando una lucha
 *     concreta. Atribuírsela sería inventar un dato, y este fichero no inventa datos.
 *
 * Por eso la ficha de una campaña no dice «recaudó X», dice «COSTÓ X». Que además es la
 * frase que contesta lo que la gente pregunta de verdad: ¿en qué se gastó mi dinero?
 *
 * El texto (nombre, de qué iba, qué se ha conseguido) vive en los diccionarios bajo
 * `campanas.fichas[clave]`, no aquí: se traduce a cuatro idiomas y cambia sin tocar código.
 */
export interface Campana {
  /** Clave de i18n y de URL. `null` en las previstas: todavía no tienen página propia. */
  slug: Dato<string>;
  /** Clave de i18n (dictionaries → campanas.fichas). */
  clave: string;
  /** ISO. `null` en las previstas: no se inventa una fecha que la asamblea no ha fijado. */
  desde: Dato<string>;
  /** ISO de cierre, o `null` si sigue abierta. */
  hasta: Dato<string>;
  estado: EstadoCampana;
  gastos: GastoLinea[];
}

/**
 * Cifras de transparencia. Derivadas de datos verificados, nunca tecleadas a ojo.
 * El total de gastos y el saldo NO se guardan: se calculan del desglose y de lo
 * recaudado, para que no puedan desincronizarse. Esta caja financia gastos de
 * movilización (no ayudas a beneficiarios), de ahí el modelo recaudado/gastos/saldo.
 */
export interface Cifras {
  /** Fecha ISO de la última actualización verificada (corte de Tesorería). */
  actualizado: Dato<string>;
  /** ACUMULADO de la caja, sin atribuir a ninguna campaña. Ver `Campana`. */
  recaudado: Dato<number>;
  /** ACUMULADO de aportaciones. Mismo motivo. */
  aportaciones: Dato<number>;
}

/** Suma de los gastos ya imputados de UNA campaña (ignora los `null`, aún sin cifra). */
export function costeCampana(c: Campana): number {
  return c.gastos.reduce((a, g) => a + (g.importe ?? 0), 0);
}

/** Suma de los gastos imputados de TODAS las campañas. */
export function gastosTotal(campanas: Campana[] = FONDO.campanas): Dato<number> {
  if (FONDO.cifras.recaudado === null) return null;
  return campanas.reduce((a, c) => a + costeCampana(c), 0);
}

/** Saldo disponible = recaudado acumulado − gastos de todas las campañas. */
export function saldoDisponible(): Dato<number> {
  const g = gastosTotal();
  const r = FONDO.cifras.recaudado;
  if (r === null || g === null) return null;
  return r - g;
}

export interface Contacto {
  general: Dato<string>;
  organizaciones: Dato<string>;
  prensa: Dato<string>;
}

/**
 * Canales PÚBLICOS del movimiento —los que la plantilla ya usa a diario—, no el contacto
 * formal de la comisión gestora del fondo (eso es `Contacto`, y sigue pendiente hasta que
 * exista entidad). Estos los confirmó la coordinación el 11-ago-2026, así que se publican.
 */
export interface Redes {
  telegram: Dato<string>;
  instagram: Dato<string>;
  /**
   * Correo HISTÓRICO del movimiento: el que circula desde el principio en los flyers, en
   * el dossier del conflicto y en la biografía de Instagram. Es el que se pinta en los
   * iconos de canales, porque es el que la gente ya tiene apuntado.
   */
  email: Dato<string>;
  /**
   * Buzón propio de la WEB: sugerencias sobre el sitio, contacto de organizaciones y los
   * textos legales. Separado del histórico a propósito (la coordinación, 14-ago-2026) para que lo
   * de la web no se mezcle con el correo del día a día del movimiento.
   */
  emailWeb: Dato<string>;
}

/**
 * Bizum «Donación a ONG»: donación directa a la caja, sin pasarela. La app del banco
 * resuelve el código al nombre del titular. Es OUT-OF-BAND: la web nunca se entera del pago
 * (ni referencia, ni conciliación), por eso es solo donación, nunca cobro de camiseta.
 */
export interface Bizum {
  codigo: Dato<string>;
}

export interface Fondo {
  titular: TitularJuridico;
  cuenta: CuentaBancaria;
  pasarela: Pasarela;
  bizum: Bizum;
  cifras: Cifras;
  /** Las luchas que ha sostenido y sostendrá la caja, de la más reciente a la más antigua. */
  campanas: Campana[];
  contacto: Contacto;
  redes: Redes;
  /** Reglamento de reparto de ayudas. La web lo enlaza, no lo redacta. */
  reglamentoUrl: Dato<string>;
  /**
   * Dossier DEL CONFLICTO: el argumentario salarial del movimiento (INE/BdE/BCE/OCDE
   * + precedente Boeing). Para sindicatos y organizaciones. Existe y está publicado.
   */
  dossierConflictoUrl: Dato<string>;
  /**
   * Dossier DE GOBERNANZA DEL FONDO: quién lo gestiona, cómo se controla el dinero,
   * qué pasa con lo que sobre. Es OTRO documento, para grandes donantes, y no puede
   * existir sin comisión gestora. No confundir con el anterior.
   */
  dossierGobernanzaUrl: Dato<string>;
}

export const FONDO: Fondo = {
  titular: {
    razonSocial: "Unión de Trabajadores Independientes y Libres (Sindicato Útil)",
    forma: "Sindicato",
    cif: "G10605053",
    domicilio: "Paseo John Lennon, s/n, 28906 Getafe (Madrid)",
    registro: null,
  },
  cuenta: {
    titular: "Unión de Trabajadores Independientes y Libres",
    // La entidad del IBAN es GLOBALCAJA: el código de entidad 3190 corresponde a Globalcaja
    // (Ruralvía es solo la marca de banca online del grupo Caja Rural, no la entidad titular).
    // Mostrar «Globalcaja» es lo correcto y lo que la persona verá al verificar el beneficiario.
    banco: "Globalcaja",
    iban: "ES80 3190 0974 3065 0292 1825",
    // Confirmado por la coordinación con el banco (BCOEESMM = Banco Cooperativo Español, cabecera
    // de las Cajas Rurales del que Globalcaja es entidad adherida; 190 = código de oficina). Para
    // transferencia nacional basta el IBAN; el BIC hace falta para SEPA/internacional.
    bic: "BCOEESMM190",
    concepto: "CAJA RESISTENCIA",
  },
  /**
   * Stripe en LIVE desde el 1-oct-2026, a nombre de ÚTIL. `checkoutUrl` es el endpoint propio
   * que crea la Checkout Session (el importe lo valida el servidor, nunca el navegador).
   * `metodos` es lo que se ANUNCIA en la tarjeta de aportar: los que Stripe ofrece para una
   * donación. Klarna está habilitado en la cuenta, pero pagar a plazos una aportación no
   * tiene sentido y no se anuncia; en la tienda sí puede aparecer.
   */
  pasarela: {
    proveedor: "Stripe",
    estado: "activa",
    metodos: ["tarjeta", "apple-pay", "google-pay", "bizum", "amazon-pay"],
    checkoutUrl: "/api/donacion",
    // En pausa desde el 16-oct-2026: la huelga 2026 está cerrada y el banco solo habilita
    // Bizum con una campaña en curso. La coordinación ya lo desactivó en Stripe. Al abrir la próxima
    // campaña: activarlo en Stripe y poner `true`.
    bizumActivo: false,
  },
  // Código Bizum «Donación a ONG» del titular (Sindicato Útil). Ver [[bizum-tienda-caja]].
  bizum: { codigo: "14867" },
  /**
   * Corte de 27-oct-2026 (último movimiento de los extractos de Globalcaja):
   *   saldo real de la cuenta                    15.125,04
   *   − 40 € de ÚTIL (no son aportación)         15.085,04  = saldo publicado
   *   + gastos (sin cargos nuevos desde el 13-oct) 17.098,61
   *   = recaudado                                32.183,65
   * El listado de transferencias suma 32.014,65 (1.109); los 169,00 € de diferencia son los
   * del corte anterior. Lo nuevo son 54,45 €: 35,00 de chapas por transferencia (6) y 19,45 de
   * un abono de Stripe, el pedido de 20 € del 16-oct menos 0,55 de comisión. Stripe se abona
   * neto, así que entra por lo que llega a la cuenta y cuenta como una aportación.
   *
   * OJO al leer los extractos: «movimientos» solo trae cargos y su columna Saldo NO es
   * histórica, el banco la recalcula hacia atrás desde el saldo del momento de la descarga.
   * El saldo de la última fila es el de ese día, no el de la fecha de la fila.
   *
   * Corte de 13-oct-2026 (extractos de Globalcaja: movimientos de cargo + transferencias recibidas):
   *   saldo real de la cuenta                    15.070,59
   *   − 40 € de ÚTIL (no son aportación)         15.030,59  = saldo publicado
   *   + gastos hasta el 13-oct                   17.098,61
   *   = recaudado                                32.129,20
   * Gastos nuevos desde el 2-oct: camión de sonido de la marcha del 12-sep (1.754,50, 13-oct),
   * segundo pago de camisetas (394,79, 13-oct) y un transporte de la marcha (46,00, 7-oct).
   * El listado de transferencias suma 31.960,20 (1.102, hasta el 8-oct); los 169,00 € de
   * diferencia (98 al 2-oct + 71 desde entonces) se cuentan como ingreso por la regla del 6-oct.
   * Su origen sigue sin identificar: NO son abonos de Stripe, que sí salen en el listado de
   * transferencias. Entre el 2 y el 13-oct hay unos 35 apuntes que no están en ninguno de los
   * dos extractos, y los 71 € están fechados el 13-oct solo por convención (fecha real desconocida).
   * Lo que sigue es el corte ANTERIOR, del 2-oct:
   *
   * Corte de 2-oct-2026 (extractos de Globalcaja descargados juntos tras el 2-oct):
   *   saldo real de la cuenta                    17.184,88
   *   − 40 € de ÚTIL (no son aportación)         17.144,88  = saldo publicado
   *   + gastos hasta el 1-oct                    14.903,32
   *   = recaudado                                32.048,20
   * El listado de transferencias suma 31.950,20 (1.101, hasta el 2-oct); los 98,00 € de
   * diferencia entraron en la cuenta por otra vía que el extracto de cargos no muestra.
   * Decisión de la coordinación (6-oct-2026): se cuentan como ingreso, venga de donde venga, para que
   * el saldo publicado sea el real. `aportaciones` sigue siendo el recuento del listado
   * (1.101): esos 98 € no traen número de aportaciones.
   * Lo que sigue es el corte ANTERIOR, del 25-sep, que cuadraba al céntimo:
   *
   * Corte de Tesorería a 25-sep-2026, conciliado contra los dos extractos de Globalcaja
   * (movimientos de la cuenta + listado de transferencias recibidas). Cuadra al céntimo:
   *
   *   recaudado 31.875,20 − gastos 14.561,17 = 17.314,03
   *   saldo real del banco a 25-sep          = 17.354,03
   *   diferencia                             =     40,00
   *
   * Esos 40 € NO son una aportación: es lo que ÚTIL puso de su bolsillo para abrir la
   * cuenta (10 €) y cubrir la comisión trimestral de mantenimiento (30 €). Por eso no
   * entran en `recaudado` —que cuenta lo aportado por la gente, no el capital semilla del
   * sindicato— y por eso el saldo publicado va 40 € por debajo del extracto. Está dicho
   * en `transparencia.note` en vez de escondido: explicarlo transparenta más que cuadrarlo.
   *
   * La comisión trimestral de 30 € todavía NO se ha cobrado (se comprobó: a 9-sep el saldo
   * era exactamente los ingresos + 40 €, así que no había salido nada). Lo único cobrado
   * es la liquidación de 7,00 € del 25-sep.
   */
  cifras: {
    actualizado: "2026-10-27",
    recaudado: 32183.65,
    aportaciones: 1109,
  },

  /**
   * Las campañas. La primera es la que está en curso; las previstas van al final y SIN
   * cifras ni fechas: la asamblea todavía no las ha convocado, y anunciar un calendario
   * que nadie ha aprobado sería justo lo que este fichero no hace.
   *
   * Que estén ahí no es adorno: contestan la pregunta de quien aporta hoy —¿para qué sigue
   * abierta la caja si la huelga está en pausa?— y son la razón de ser de una caja
   * permanente.
   */
  campanas: [
    {
      slug: "huelga-2026",
      clave: "huelga-2026",
      desde: "2026-07-01",
      // La huelga indefinida se desconvoca el 5-oct-2026, tras aprobarse el acuerdo en
      // referéndum (1-oct). La tarjeta y la ficha muestran «1 jul 2026 — 5 oct 2026».
      hasta: "2026-10-05",
      // CERRADA desde el 9-oct-2026 (decisión de la coordinación): la huelga se desconvocó el 5-oct y la
      // campaña se da por finalizada. Lo único pendiente es el juicio del 4-nov-2026 por
      // vulneración del derecho fundamental de huelga y mala fe negocial, que se cuenta en la
      // ficha del conflicto (fila «Pendiente») y en «Últimas noticias», no en el estado.
      // La etiqueta del estado «cerrada» se lee «Finalizada» (diccionarios).
      estado: "cerrada",
      // Ordenadas de mayor a menor importe. Corte 13-oct-2026 (extractos de Globalcaja; las
      // etiquetas son las que da Tesorería en la columna de comentarios).
      // El material de campaña va POR PRODUCTO, una línea por cada uno (la coordinación, 6-oct-2026:
      // cambia la decisión del 5-oct de agruparlo). Un producto nuevo = una clave nueva aquí y
      // su etiqueta en `transparencia.detalle` de los cuatro diccionarios.
      // El camión de sonido de la marcha del 12-sep se pagó el 13-oct (1.754,50, el importe que
      // la coordinación dejó apartado el 6-oct): vuelve a la web.
      gastos: [
        // MRS2002 fra. 89 (1.869 uds, IVA incl.) + segundo pago de camisetas del 13-oct (394,79)
        {
          clave: "camisetas",
          tipo: "material",
          importe: 9734.74,
          pagos: [
            { fecha: "2026-09-11", importe: 9339.95 },
            { fecha: "2026-10-13", importe: 394.79 },
          ],
        },
        // OUIGO ×4 el 9-sep (4.845,00) + 4 transferencias de transporte (415,22)
        {
          clave: "desplazamientos",
          tipo: "desplazamientos",
          importe: 5260.22,
          pagos: [
            { fecha: "2026-09-09", importe: 2340.0 },
            { fecha: "2026-09-09", importe: 2250.0 },
            { fecha: "2026-09-09", importe: 125.0 },
            { fecha: "2026-09-09", importe: 130.0 },
            { fecha: "2026-09-15", importe: 83.68 },
            { fecha: "2026-09-17", importe: 39.7 },
            { fecha: "2026-09-21", importe: 245.84 },
            { fecha: "2026-10-07", importe: 46.0 },
          ],
        },
        { clave: "camion", tipo: "desplazamientos", importe: 1754.5, pagos: [{ fecha: "2026-10-13", importe: 1754.5 }] },
        { clave: "chapas", tipo: "material", importe: 326.0, pagos: [{ fecha: "2026-10-01", importe: 326.0 }] },
        { clave: "digital", tipo: "infraestructura", importe: 16.15, pagos: [{ fecha: "2026-10-01", importe: 16.15 }] },
        // liq. cta. vista (la trimestral de 30 € aún no se ha cobrado)
        { clave: "comision", tipo: "comisiones", importe: 7.0, pagos: [{ fecha: "2026-09-25", importe: 7.0 }] },
      ],
    },
    {
      slug: null,
      clave: "elecciones-2027",
      desde: null,
      hasta: null,
      estado: "prevista",
      gastos: [],
    },
    {
      slug: null,
      clave: "convenio-viii",
      desde: null,
      hasta: null,
      estado: "prevista",
      gastos: [],
    },
  ],
  contacto: {
    general: "syndicat.util.interempresas@airbus.com",
    organizaciones: null,
    prensa: null,
  },
  // Fuera de la web desde el 16-oct-2026 (decisión de la coordinación): el canal de Telegram pasó a
  // privado y la cuenta de Instagram se borró tras la desconvocatoria de la huelga. También
  // se retira el correo histórico «Conflicto y prensa» (airbus.en.huelga@gmail.com).
  redes: {
    telegram: null,
    instagram: null,
    email: null,
    emailWeb: "enfadadosconairbus.contacto@gmail.com",
  },
  reglamentoUrl: null,
  dossierConflictoUrl: "/docs/dossier-recuperacion-salarial-airbus-es-en.pdf",
  dossierGobernanzaUrl: null,
};

/**
 * Web A — el medio del movimiento (independiente de la caja). Destino del enlace «Conoce el
 * conflicto» desde la portada de la caja. Un solo sitio para cambiarlo si A cambia de dominio.
 */
export const WEB_MOVIMIENTO_URL = "https://enfadadosconairbus.vercel.app";

/** Hay titular identificable: los legales se pueden firmar. */
export const titularPublicable = Boolean(FONDO.titular.razonSocial && FONDO.titular.cif);

/** Se puede publicar un IBAN al que transferir de verdad. */
export const cuentaPublicable = Boolean(FONDO.cuenta.iban && FONDO.cuenta.titular);

/**
 * La pasarela cobra de verdad. Exige titular: sin entidad no hay cuenta de comercio,
 * así que un `estado: "activa"` sin titular sería una contradicción, no una opción.
 */
export const pasarelaActiva = Boolean(
  FONDO.pasarela.estado === "activa" && FONDO.pasarela.checkoutUrl && titularPublicable,
);

/**
 * Límites de una aportación online, en euros. El mínimo evita pagos en los que la comisión
 * fija de Stripe se comería casi todo; por encima del máximo, la vía es la transferencia
 * o hablar con la comisión (sección de grandes donantes).
 */
export const APORTACION_ONLINE = { min: 1, max: 5000 };

/**
 * Bizum «Donación a ONG» (código 14867): se publicaba como vía propia. Desde el 1-oct-2026
 * Bizum va DENTRO de Stripe y la web ya no muestra el código; se conserva el dato por si
 * vuelve a hacer falta. Hay código y titular al que la app del banco lo resolverá.
 */
export const bizumPublicable = Boolean(FONDO.bizum.codigo && titularPublicable);

/** El fondo puede recibir dinero por alguna vía. Mientras sea false, los CTA no cobran. */
export const fondoOperativo = cuentaPublicable || pasarelaActiva || bizumPublicable;

export type DependeDe = "sindicato" | "profesional" | "estudio";

export interface PendienteFondo {
  clave: string;
  que: string;
  dependeDe: DependeDe;
}

/**
 * Qué falta para que el fondo opere, y de quién depende.
 *
 * Es el marcador de "¿cuánto queda?": si esto devuelve una sola entrada, la web está
 * montada y solo falta ese dato. Se usa en el guion de A5 y en el informe de estado.
 */
export function pendientes(): PendienteFondo[] {
  const lista: PendienteFondo[] = [];

  if (!FONDO.titular.razonSocial || !FONDO.titular.cif) {
    lista.push({
      clave: "titular",
      que: "Titular jurídico del fondo (razón social, CIF, domicilio) para firmar los legales",
      dependeDe: "sindicato",
    });
  }
  if (!cuentaPublicable) {
    lista.push({
      clave: "cuenta",
      que: "Cuenta del fondo (IBAN y titular) para el canal de transferencia",
      dependeDe: "sindicato",
    });
  }
  if (!FONDO.reglamentoUrl) {
    lista.push({
      clave: "reglamento",
      que: "Reglamento de reparto: quién recibe ayuda, con qué criterios y quién aprueba",
      dependeDe: "sindicato",
    });
  }
  if (!FONDO.contacto.general) {
    lista.push({
      clave: "contacto",
      que: "Canal de contacto de la comisión gestora",
      dependeDe: "sindicato",
    });
  }
  if (!pasarelaActiva) {
    lista.push({
      clave: "pasarela",
      que:
        FONDO.pasarela.estado === "sin-titular"
          ? "Pasarela (tarjeta, Apple Pay, Google Pay, PayPal): bloqueada hasta que exista titular a cuyo nombre abrir la cuenta de comercio"
          : "Pasarela: completar el alta y cablear el checkout",
      dependeDe: FONDO.pasarela.estado === "sin-titular" ? "sindicato" : "estudio",
    });
  }

  // Revisión legal por abogado: hecha (1-oct-2026). Ya no es un pendiente.
  lista.push({
    clave: "traducciones",
    que: "Revisión humana de las traducciones EN/FR/DE antes de publicarlas como definitivas",
    dependeDe: "profesional",
  });

  return lista;
}

/** Importe verificado, o guion. Nunca un número de relleno. */
export function euros(valor: Dato<number>, lang: string): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Importe verificado CON céntimos. Para desgloses que deben cuadrar euro a euro con facturas. */
export function eurosExacto(valor: Dato<number>, lang: string): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/** Recuento verificado, o guion. */
export function recuento(valor: Dato<number>, lang: string): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat(lang).format(valor);
}
