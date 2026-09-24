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

export type MetodoPago = "tarjeta" | "apple-pay" | "google-pay" | "paypal" | "sepa";

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
}

/** Cifras de transparencia. Derivadas de datos verificados, nunca tecleadas a ojo. */
export interface Cifras {
  /** Fecha ISO de la última actualización verificada. */
  actualizado: Dato<string>;
  recaudado: Dato<number>;
  neto: Dato<number>;
  gastos: Dato<number>;
  entregado: Dato<number>;
  pendienteAsignar: Dato<number>;
  aportaciones: Dato<number>;
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

export interface Fondo {
  titular: TitularJuridico;
  cuenta: CuentaBancaria;
  pasarela: Pasarela;
  cifras: Cifras;
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
    razonSocial: null,
    forma: null,
    cif: null,
    domicilio: null,
    registro: null,
  },
  cuenta: {
    titular: null,
    banco: null,
    iban: null,
    bic: null,
    concepto: null,
  },
  pasarela: {
    proveedor: null,
    estado: "sin-titular",
    metodos: [],
    checkoutUrl: null,
  },
  cifras: {
    actualizado: null,
    recaudado: null,
    neto: null,
    gastos: null,
    entregado: null,
    pendienteAsignar: null,
    aportaciones: null,
  },
  contacto: {
    general: null,
    organizaciones: null,
    prensa: null,
  },
  // El `igsh` de Instagram es un parámetro de rastreo de origen: se quita y se deja la URL
  // limpia del perfil. El de Telegram es un enlace de invitación al grupo, va tal cual.
  redes: {
    telegram: "https://t.me/+MnuqJDCAAgYyMGQ0",
    instagram: "https://www.instagram.com/airbusenhuelga_getafe/",
    email: "airbus.en.huelga@gmail.com",
    emailWeb: "enfadadosconairbus.contacto@gmail.com",
  },
  reglamentoUrl: null,
  dossierConflictoUrl: "/docs/dossier-recuperacion-salarial-airbus-es-en.pdf",
  dossierGobernanzaUrl: null,
};

/**
 * Web B — la caja de resistencia (del sindicato). Toda la recaudación vive allí; esta web
 * (el medio del movimiento) solo enlaza. Un único sitio para cambiarlo si B cambia de dominio.
 */
export const WEB_CAJA_URL = "https://caja-resistencia-huelga-airbus-2026.vercel.app";

/**
 * Puente TEMPORAL (3-sep-2026) — mientras los legales del sindicato revisan Web B, los CTA de
 * «Aportar» no se quedan desactivados: enlazan a una página puente en GitHub Pages que explica
 * que la caja se está constituyendo. Cuando Web B esté lista: apuntar los CTA a `WEB_CAJA_URL`,
 * restaurar el `<span>` inerte + la nota «se habilitará…» y borrar esta constante. // TODO retirar.
 */
export const WEB_CAJA_PUENTE_URL = "https://enfadadosconairbus.github.io/caja-resistencia/";

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

/** El fondo puede recibir dinero por alguna vía. Mientras sea false, los CTA no cobran. */
export const fondoOperativo = cuentaPublicable || pasarelaActiva;

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

  lista.push({
    clave: "legal",
    que: "Revisión de los textos legales por abogado (LSSI-CE, RGPD, fiscalidad de aportaciones)",
    dependeDe: "profesional",
  });
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

/** Recuento verificado, o guion. */
export function recuento(valor: Dato<number>, lang: string): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat(lang).format(valor);
}
