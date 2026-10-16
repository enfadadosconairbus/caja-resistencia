import type * as THREE from "three";
import type { Cuerpo } from "./cuerpo";
import { curva, azar } from "./motor";

/**
 * El repertorio. Cada acción sigue el mismo guion, que es lo que la separa de "mover una
 * articulación": MIRAR lo que va a coger → PREPARARSE (peso, pequeño contramovimiento) →
 * ACTUAR → ASENTARSE (se pasa un poco y vuelve) → QUIETUD.
 *
 * Las manos no se animan por ángulos: van a un sitio (`alcanzar`) y la IK resuelve hombro y
 * codo. Por eso los guiones siguen valiendo cuando la maqueta se cambie por el modelo de verdad.
 */

export type Bocadillo = "saludo" | "pan" | "sol" | "fresco" | "voto" | "baile" | "asentir" | "recibido" | "invitacion";
export type Contexto = {
  decir: (b: Bocadillo) => void;
  silbar: () => void;
};

export type NombreAccion =
  | "refrescarse"
  | "crema"
  | "paraguas"
  | "gafas"
  | "pan"
  | "silbato"
  | "saludar"
  | "cerrarParaguas"
  | "abrirParaguas"
  | "votar"
  | "bailar"
  | "asentir"
  | "anotar"
  | "invitarBuzon"
  | "mirarAlrededor";

const POLO_CADERA: [number, number, number] = [-1, 0.2, -0.3];
const POLO_CARA: [number, number, number] = [-0.9, -0.6, -0.3];
const POLO_HOMBRO: [number, number, number] = [-1, 0.1, -0.3];
const POLO_REPOSO_D: [number, number, number] = [-0.8, -0.5, -0.6];
const POLO_REPOSO_I: [number, number, number] = [0.8, -0.5, -0.6];

const moverMarca = (c: Cuerpo, o: THREE.Object3D, dx: number, dy: number, dz: number, dur: number, cv = curva.suave) => {
  const x0 = o.position.x;
  const y0 = o.position.y;
  const z0 = o.position.z;
  return c.motor.tw(dur, cv, (k) => o.position.set(x0 + dx * k, y0 + dy * k, z0 + dz * k));
};

async function aTirante(c: Cuerpo) {
  c.foco = null;
  await c.alcanzar("D", c.marca.tiranteD, 0.5, curva.asienta, POLO_REPOSO_D);
}

export async function refrescarse(c: Cuerpo, ctx: Contexto) {
  const { m, marca } = c;
  c.foco = m.obj.pulverizador;
  // Mira y carga el peso hacia ese lado antes de mover el brazo.
  await c.pose({ cadera: { px: -0.02, rz: -0.03 }, columna: { rz: 0.05, rx: 0.06 } }, 0.35);
  c.pose({ cadera: { py: -0.05 }, columna: { rx: 0.14, rz: 0.12 }, pecho: { rz: 0.06 } }, 0.45);
  await c.alcanzar("D", m.ranura.pulverizador, 0.5, curva.sale, POLO_CADERA);
  await c.agarrar(m.obj.pulverizador, "D", 0.14, [-0.9, 0, 0]);
  c.foco = m.obj.pulverizador;
  c.pose({ cadera: { py: -0.014, px: 0, rz: 0 }, columna: { rx: -0.04, rz: 0 }, pecho: { rz: 0 } }, 0.55);
  await c.alcanzar("D", marca.cara, 0.6, curva.suave, POLO_CARA);
  c.foco = marca.espectador;
  await c.motor.espera(0.15);
  // Tres pulsaciones cortas; la cabeza se aparta un pelo con cada una y cierra los ojos.
  c.pose({ parpadoI: { rx: 1.8 }, parpadoD: { rx: 1.8 } }, 0.1);
  for (let i = 0; i < 3; i++) {
    c.gotas(m.obj.pulverizador, marca.nariz, 9);
    await c.pose({ cabeza: { rx: -0.07, rz: 0.03 } }, 0.07, curva.sale);
    await c.pose({ cabeza: { rx: 0, rz: 0 } }, 0.16);
  }
  ctx.decir("fresco");
  c.expresion("sonrisa", 0.3);
  // Sacude la cabeza como quien se quita el agua, y respira.
  for (const z of [0.1, -0.09, 0.06, 0]) await c.pose({ cabeza: { rz: z } }, 0.09, curva.suave);
  await c.pose({ formaPecho: { sy: 0.04, sz: 0.06 }, hombroI: { py: 0.012 }, hombroD: { py: 0.012 } }, 0.5);
  await c.pose({ formaPecho: { sy: 0, sz: 0 }, hombroI: { py: 0 }, hombroD: { py: 0 }, parpadoI: { rx: 0 }, parpadoD: { rx: 0 } }, 0.6);
  // Guarda.
  c.foco = m.ranura.pulverizador;
  c.pose({ cadera: { py: -0.05 }, columna: { rx: 0.12, rz: 0.1 } }, 0.5);
  await c.alcanzar("D", m.ranura.pulverizador, 0.55, curva.suave, POLO_CADERA);
  await c.dejar(m.obj.pulverizador, m.ranura.pulverizador, 0.14);
  c.empujarColgante("pulverizador", 1.5, 3);
  c.volverReposo(0.7);
  await aTirante(c);
  c.expresion("neutra", 0.6);
}

export async function crema(c: Cuerpo, ctx: Contexto) {
  const { m, marca } = c;
  // Mira por encima del hombro: el tronco gira detrás de la cabeza, no a la vez.
  c.foco = m.obj.crema;
  await c.motor.espera(0.2);
  await c.pose({ columna: { ry: -0.18 }, pecho: { ry: -0.16 }, cadera: { px: -0.015 } }, 0.4);
  await c.alcanzar("D", m.ranura.crema, 0.6, curva.sale, POLO_HOMBRO);
  await c.agarrar(m.obj.crema, "D", 0.14, [0, 0, 0.3]);
  c.pose({ columna: { ry: 0 }, pecho: { ry: 0 }, cadera: { px: 0 } }, 0.55);
  await c.alcanzar("D", marca.cara, 0.6, curva.suave, POLO_CARA);
  // La mira de cerca (bizquea un poco: es lo que hace cualquiera leyendo una etiqueta).
  c.foco = m.obj.crema;
  c.pose({ cejaI: { py: 0.01 }, cejaD: { py: 0.01 } }, 0.2);
  await c.motor.espera(0.45);
  // Aprieta: el bote cede y recupera.
  const bote = m.obj.crema;
  await c.motor.tw(0.12, curva.entra, (k) => bote.scale.set(1 + 0.18 * k, 1 - 0.14 * k, 1 + 0.18 * k));
  await c.motor.tw(0.25, curva.asienta, (k) => bote.scale.set(1.18 - 0.18 * k, 0.86 + 0.14 * k, 1.18 - 0.18 * k));
  // Se unta la nariz a toques, con los ojos entornados.
  c.foco = marca.espectador;
  c.pose({ parpadoI: { rx: 1.2 }, parpadoD: { rx: 1.2 }, cejaI: { py: 0 }, cejaD: { py: 0 } }, 0.25);
  await c.alcanzar("D", marca.nariz, 0.35, curva.sale, POLO_CARA);
  for (let i = 0; i < 3; i++) {
    await moverMarca(c, marca.nariz, 0.018, 0, 0, 0.1);
    await moverMarca(c, marca.nariz, -0.018, 0, 0, 0.1);
  }
  ctx.decir("sol");
  c.expresion("sonrisa", 0.3);
  c.pose({ parpadoI: { rx: 0 }, parpadoD: { rx: 0 } }, 0.3);
  // La guarda.
  c.foco = m.ranura.crema;
  await c.pose({ columna: { ry: -0.18 }, pecho: { ry: -0.16 } }, 0.45);
  await c.alcanzar("D", m.ranura.crema, 0.6, curva.suave, POLO_HOMBRO);
  await c.dejar(m.obj.crema, m.ranura.crema, 0.15);
  c.volverReposo(0.7);
  await aTirante(c);
  c.expresion("neutra", 0.6);
}

/** Dónde descansa la mano del paraguas según esté abierto (al hombro) o cerrado (bastón). */
const marcaParaguas = (c: Cuerpo) => (c.paraguasCerrado ? c.marca.bastonI : c.marca.paraguasI);

/**
 * Cerrar: lo baja por delante, la otra mano baja la corredera (la tela se pliega sobre la
 * varilla) y lo gira para llevarlo hacia abajo, como un bastón.
 */
export async function cerrarParaguas(c: Cuerpo) {
  if (c.paraguasCerrado) return;
  const { m, marca } = c;
  c.foco = m.obj.tela;
  await c.motor.espera(0.25);
  await c.alcanzar("I", marca.paraguasBajo, 0.55, curva.suave, [0.9, -0.6, -0.3]);
  c.foco = marca.corredera;
  await c.alcanzar("D", marca.corredera, 0.4, curva.sale, POLO_CARA);
  // Tira de la corredera hacia el puño mientras la tela se recoge.
  await Promise.all([
    moverMarca(c, marca.corredera, 0, -0.3, 0, 0.55),
    c.motor.tw(0.55, curva.suave, (k) => (c.paraguasCierre = k)),
    c.pose({ cadera: { py: -0.03 }, columna: { rx: 0.05 } }, 0.4),
  ]);
  c.paraguasCerrado = true;
  // Lo gira hacia abajo y deja caer el brazo; la otra mano vuelve al tirante.
  c.foco = null;
  aTirante(c);
  c.pose({ cadera: { py: -0.014 }, columna: { rx: 0 } }, 0.5, curva.asienta);
  await Promise.all([
    c.motor.tw(0.6, curva.suave, (k) => (c.paraguasGiro = k)),
    c.alcanzar("I", marca.bastonI, 0.6, curva.asienta, [0.8, -0.2, -0.6]),
  ]);
  marca.corredera.position.y = 0.55;
}

/** Abrir: lo sube por delante, empuja la corredera y la tela se abre de golpe (con rebote). */
export async function abrirParaguas(c: Cuerpo) {
  if (!c.paraguasCerrado) return;
  const { marca } = c;
  c.foco = marca.paraguasBajo;
  await Promise.all([
    c.motor.tw(0.55, curva.suave, (k) => (c.paraguasGiro = 1 - k)),
    c.alcanzar("I", marca.paraguasBajo, 0.55, curva.suave, [0.9, -0.6, -0.3]),
  ]);
  marca.corredera.position.y = 0.25;
  c.foco = marca.corredera;
  await c.alcanzar("D", marca.corredera, 0.35, curva.sale, POLO_CARA);
  // Preparación: un pequeño tirón hacia abajo antes de empujar.
  await moverMarca(c, marca.corredera, 0, -0.03, 0, 0.12);
  await Promise.all([
    moverMarca(c, marca.corredera, 0, 0.33, 0, 0.3, curva.sale),
    c.motor.tw(0.3, curva.rebota, (k) => (c.paraguasCierre = 1 - k)),
  ]);
  c.rafaga(0.35);
  c.paraguasCerrado = false;
  marca.corredera.position.y = 0.55;
  c.foco = null;
  aTirante(c);
  await c.alcanzar("I", marca.paraguasI, 0.6, curva.asienta, [0.8, -0.5, -0.6]);
}

/**
 * Votar a mano alzada, como en las asambleas. Con el paraguas abierto no hay mano libre que
 * se vea: primero lo cierra.
 */
export async function votar(c: Cuerpo, ctx: Contexto) {
  const { marca } = c;
  await cerrarParaguas(c);
  c.foco = marca.espectador;
  await c.motor.espera(0.3);
  // Coge aire y se agacha un poco: la preparación del gesto.
  await c.pose({ cadera: { py: -0.04 }, formaPecho: { sy: 0.04, sz: 0.06 }, cejaI: { py: 0.008 }, cejaD: { py: 0.008 } }, 0.3, curva.entra);
  // ¡Arriba! Rápido y firme; el cuerpo se estira detrás del brazo.
  c.expresion("sonrisa", 0.2);
  c.pose(
    { cadera: { py: -0.006 }, columna: { rz: 0.05, rx: -0.03 }, pecho: { rz: 0.03 }, cabeza: { rz: -0.04 }, formaPecho: { sy: 0.02, sz: 0.03 } },
    0.35,
    curva.asienta,
  );
  await c.alcanzar("D", marca.voto, 0.32, curva.rebota, [-1, -0.1, -0.4]);
  ctx.decir("voto");
  // Mantiene la mano en alto mientras se cuenta: quieta, con un leve reajuste.
  await c.motor.espera(0.7);
  await moverMarca(c, marca.voto, 0, 0.025, 0, 0.18, curva.sale);
  await moverMarca(c, marca.voto, 0, -0.025, 0, 0.3, curva.asienta);
  await c.motor.espera(1.2);
  c.pose({ cejaI: { py: 0 }, cejaD: { py: 0 }, formaPecho: { sy: 0, sz: 0 } }, 0.4);
  c.volverReposo(0.7);
  await aTirante(c);
  await c.motor.espera(0.5);
  c.expresion("neutra", 0.5);
}

export async function paraguas(c: Cuerpo) {
  const { m, marca } = c;
  // Cerrado no hay tela que ajustar ni que se lleve el viento: lo abre.
  if (c.paraguasCerrado) return abrirParaguas(c);
  if (Math.random() < 0.5) {
    // Lo ajusta: lo mira, lo sube un poco, lo gira un cuarto de vuelta y lo inclina.
    c.foco = m.obj.tela;
    await c.motor.espera(0.3);
    await moverMarca(c, marca.paraguasI, 0, 0.05, 0, 0.3, curva.sale);
    await c.motor.tw(0.9, curva.suave, (k) => (c.acc.paraguas.ry = (k * Math.PI) / 4));
    await c.pose({ paraguas: { rz: 0.3, rx: -0.1 } }, 0.35, curva.asienta);
    await c.motor.espera(0.4);
    await c.pose({ paraguas: { rz: 0.02, rx: -0.08 } }, 0.5, curva.asienta);
    await moverMarca(c, marca.paraguasI, 0, -0.05, 0, 0.4, curva.asienta);
    c.acc.paraguas.ry = 0;
    c.foco = null;
    return;
  }
  // Una ráfaga: la tela cede, él se encoge contra el viento y se sujeta el sombrero.
  const dir = Math.random() < 0.5 ? 1 : -1;
  c.rafaga(1.2, dir);
  c.expresion("o", 0.1);
  c.pose({ sombrero: { py: 0.022, rx: -0.3, rz: -0.1 * dir } }, 0.14, curva.sale);
  c.pose({ columna: { rz: 0.09 * dir, rx: 0.08 }, cadera: { px: 0.02 * dir, py: -0.04 }, parpadoI: { rx: 1.1 }, parpadoD: { rx: 1.1 } }, 0.25, curva.sale);
  await c.alcanzar("D", marca.sombrero, 0.28, curva.sale, POLO_HOMBRO);
  await c.pose({ sombrero: { py: 0, rx: 0, rz: 0 } }, 0.3, curva.asienta);
  await c.motor.espera(0.25);
  c.rafaga(0.5, dir);
  await c.motor.espera(0.7);
  c.expresion("neutra", 0.4);
  c.foco = m.obj.tela;
  c.pose({ columna: { rz: 0, rx: 0 }, cadera: { px: 0, py: -0.014 }, parpadoI: { rx: 0 }, parpadoD: { rx: 0 } }, 0.6, curva.asienta);
  await c.motor.espera(0.5);
  await aTirante(c);
}

export async function gafas(c: Cuerpo) {
  const { m, marca } = c;
  c.foco = m.obj.gafas;
  await c.motor.espera(0.25);
  await c.alcanzar("D", m.ranura.gafasCuello, 0.45, curva.sale, POLO_CARA);
  await c.agarrar(m.obj.gafas, "D", 0.12, [0, 0, 0], [0.03, -0.05, 0.05]);
  // La cabeza baja un poco al encuentro de las gafas: las dos cosas se mueven.
  c.foco = marca.ojos;
  c.pose({ cabeza: { rx: 0.12 }, cuello: { rx: 0.05 } }, 0.45);
  await c.alcanzar("D", marca.ojos, 0.5, curva.suave, POLO_CARA);
  await c.dejar(m.obj.gafas, m.ranura.gafasCara, 0.22);
  c.pose({ cabeza: { rx: -0.04 }, cuello: { rx: 0 } }, 0.35, curva.asienta);
  c.expresion("sonrisa", 0.3);
  await aTirante(c);
  // Mira alrededor, con las gafas puestas.
  const h = marca.horizonte;
  c.foco = h;
  await moverMarca(c, h, -1.7, 0.1, 0, 0.55);
  await c.motor.espera(0.7);
  await moverMarca(c, h, 3.1, -0.1, 0, 0.9);
  await c.motor.espera(0.6);
  await moverMarca(c, h, -1.4, 0, 0, 0.5);
  c.foco = marca.espectador;
  await c.pose({ cabeza: { rx: 0.1 } }, 0.15);
  await c.pose({ cabeza: { rx: -0.04 } }, 0.25, curva.asienta);
  await c.motor.espera(0.8);
  // Se las quita y las devuelve al cordón.
  c.foco = marca.ojos;
  await c.alcanzar("D", m.ranura.gafasCara, 0.4, curva.sale, POLO_CARA);
  await c.agarrar(m.obj.gafas, "D", 0.1, [0, 0, 0], [0.03, -0.05, 0.05]);
  c.pose({ cabeza: { rx: 0 } }, 0.3);
  c.foco = m.ranura.gafasCuello;
  await c.alcanzar("D", m.ranura.gafasCuello, 0.5, curva.suave, POLO_CARA);
  await c.dejar(m.obj.gafas, m.ranura.gafasCuello, 0.12);
  c.empujarColgante("gafas", -2, 1.5);
  c.expresion("neutra", 0.5);
  await aTirante(c);
}

export async function silbato(c: Cuerpo, ctx: Contexto) {
  const { m, marca } = c;
  c.foco = m.obj.silbato;
  await c.alcanzar("D", m.ranura.silbato, 0.28, curva.sale, POLO_CARA);
  await c.agarrar(m.obj.silbato, "D", 0.08, [0, 0, 0], [0.01, -0.05, 0.04]);
  c.foco = marca.espectador;
  // Coge aire: pecho arriba, hombros arriba, cabeza atrás. Es la preparación del golpe.
  c.pose({ formaPecho: { sy: 0.05, sz: 0.09 }, hombroI: { py: 0.018 }, hombroD: { py: 0.018 }, cabeza: { rx: -0.08 } }, 0.3, curva.entra);
  await c.alcanzar("D", marca.boca, 0.3, curva.sale, POLO_CARA);
  c.expresion("soplar", 0.08);
  ctx.silbar();
  await c.pose({ formaPecho: { sy: -0.03, sz: -0.04 }, cabeza: { rx: 0.05 }, cejaI: { py: 0.014 }, cejaD: { py: 0.014 }, parpadoI: { rx: 0.5 }, parpadoD: { rx: 0.5 } }, 0.12, curva.rebota);
  await c.motor.espera(0.18);
  await c.pose({ formaPecho: { sy: 0.02, sz: 0.03 }, cabeza: { rx: -0.03 } }, 0.1);
  await c.pose({ formaPecho: { sy: -0.04, sz: -0.05 }, cabeza: { rx: 0.06 } }, 0.12, curva.rebota);
  await c.motor.espera(0.3);
  // Lo suelta: cae al cordón y se balancea él solo.
  c.expresion("sonrisa", 0.2);
  await c.dejar(m.obj.silbato, m.ranura.silbato, 0.1);
  c.empujarColgante("silbato", -3.5, 2);
  c.volverReposo(0.6);
  await aTirante(c);
  await c.motor.espera(0.6);
  c.expresion("neutra", 0.5);
}

export async function saludar(c: Cuerpo, ctx: Contexto) {
  const { marca } = c;
  c.foco = marca.espectador;
  c.pose({ cejaI: { py: 0.012 }, cejaD: { py: 0.012 }, cadera: { py: -0.035 } }, 0.18);
  c.expresion("sonrisa", 0.25);
  await c.alcanzar("D", marca.saludo, 0.35, curva.sale, [-1, -0.3, -0.2]);
  ctx.decir("saludo");
  c.pose({ cadera: { py: -0.014 } }, 0.3, curva.asienta);
  for (let i = 0; i < 3; i++) {
    c.pose({ cadera: { rz: 0.02 } }, 0.16);
    await moverMarca(c, marca.saludo, 0.08, -0.01, 0, 0.16);
    c.pose({ cadera: { rz: -0.01 } }, 0.16);
    await moverMarca(c, marca.saludo, -0.08, 0.01, 0, 0.16);
  }
  c.pose({ cejaI: { py: 0 }, cejaD: { py: 0 }, cadera: { rz: 0 } }, 0.4);
  await aTirante(c);
  await c.motor.espera(0.8);
  c.expresion("neutra", 0.5);
}

export async function pan(c: Cuerpo, ctx: Contexto) {
  const { m, marca } = c;
  const panIx = marca.panI.position.x;
  const panDx = marca.panD.position.x;
  // Lo busca por encima del hombro.
  c.foco = m.obj.pan;
  await c.motor.espera(0.2);
  await c.pose({ columna: { ry: -0.16 }, pecho: { ry: -0.14 } }, 0.4);
  await c.alcanzar("D", m.ranura.pan, 0.6, curva.sale, POLO_HOMBRO);
  await c.agarrar(m.obj.pan, "D", 0.15, [0, 0, Math.PI / 2 - 0.2], [0, -0.05, 0.03]);
  c.pose({ columna: { ry: 0 }, pecho: { ry: 0 } }, 0.5);
  c.foco = marca.pechoFrente;
  await c.alcanzar("D", marca.pechoFrente, 0.55, curva.suave, POLO_REPOSO_D);
  // El paraguas se apoya en el hombro para dejar libre la otra mano (cerrado, cuelga sin más).
  if (!c.paraguasCerrado) c.pose({ paraguas: { rx: -0.6, rz: 0.4 } }, 0.5);
  await c.alcanzar("I", marca.panI, 0.5, curva.suave, POLO_REPOSO_I);
  await c.alcanzar("D", marca.panD, 0.2, curva.suave, POLO_REPOSO_D);
  // Preparación: aprieta. El vientre se comprime, los hombros suben, las cejas se juntan.
  await c.pose(
    { formaVientre: { sy: -0.05, sx: 0.03, sz: 0.03 }, cadera: { py: -0.045 }, hombroI: { py: 0.015 }, hombroD: { py: 0.015 }, cejaI: { py: -0.006 }, cejaD: { py: -0.006 } },
    0.4,
    curva.entra,
  );
  // ¡Crac! Cada mano se queda con una mitad, y saltan migas.
  c.agarrar(m.obj.panA, "I", 0.08, [0, 0, -Math.PI / 2], [0, -0.05, 0.03]);
  c.agarrar(m.obj.panB, "D", 0.08, [0, 0, Math.PI / 2], [0, -0.05, 0.03]);
  c.migas(m.obj.pan, 9);
  moverMarca(c, marca.panI, 0.07, 0.01, 0, 0.16, curva.rebota);
  moverMarca(c, marca.panD, -0.07, 0.01, 0, 0.16, curva.rebota);
  await c.pose(
    { formaVientre: { sy: 0.02, sx: -0.01, sz: -0.01 }, cadera: { py: -0.01 }, hombroI: { py: 0 }, hombroD: { py: 0 }, cejaI: { py: 0.01 }, cejaD: { py: 0.01 } },
    0.2,
    curva.rebota,
  );
  await c.motor.espera(0.35);
  // Ofrece su mitad a quien mira: se inclina, ladea la cabeza, sonríe.
  c.foco = marca.espectador;
  c.expresion("sonrisa", 0.3);
  c.pose({ columna: { rx: 0.08 }, pecho: { rx: 0.05 }, cabeza: { rz: -0.1 }, formaVientre: { sy: 0, sx: 0, sz: 0 } }, 0.5);
  await c.alcanzar("D", marca.ofrecer, 0.6, curva.asienta, [-0.8, -0.7, -0.1]);
  ctx.decir("pan");
  await c.motor.espera(1.8);
  // Lo recoge y junta las mitades.
  c.pose({ columna: { rx: 0 }, pecho: { rx: 0 }, cabeza: { rz: 0 } }, 0.5);
  c.foco = marca.pechoFrente;
  await c.alcanzar("D", marca.panD, 0.5, curva.suave, POLO_REPOSO_D);
  await Promise.all([moverMarca(c, marca.panI, -0.07, -0.01, 0, 0.3), moverMarca(c, marca.panD, 0.07, -0.01, 0, 0.3)]);
  await c.agarrar(m.obj.pan, "D", 0, [0, 0, Math.PI / 2 - 0.2], [0, -0.05, 0.03]);
  await Promise.all([c.dejar(m.obj.panA, m.obj.pan, 0.2, [0, 0.078, 0]), c.dejar(m.obj.panB, m.obj.pan, 0.2, [0, -0.078, 0])]);
  marca.panI.position.x = panIx;
  marca.panD.position.x = panDx;
  c.pose({ paraguas: { rx: -0.08, rz: 0.02 } }, 0.5, curva.asienta);
  c.alcanzar("I", marcaParaguas(c), 0.5, curva.asienta, POLO_REPOSO_I);
  // A la mochila.
  c.foco = m.ranura.pan;
  await c.pose({ columna: { ry: -0.16 }, pecho: { ry: -0.14 } }, 0.4);
  await c.alcanzar("D", m.ranura.pan, 0.6, curva.suave, POLO_HOMBRO);
  await c.dejar(m.obj.pan, m.ranura.pan, 0.18);
  c.volverReposo(0.7);
  await aTirante(c);
  c.expresion("neutra", 0.6);
}

/**
 * El baile que trae el propio modelo de Meshy (`Boom_Dance`, 7,1 s). Mientras suena manda la
 * animación y la maqueta la copia, así que el paraguas y lo que cuelga siguen el baile solos.
 * Con el paraguas abierto no hay sitio para mover los brazos: se cierra antes.
 */
export async function bailar(c: Cuerpo, ctx: Contexto) {
  if (!c.tieneClip("baile")) return mirarAlrededor(c);
  await cerrarParaguas(c);
  c.foco = c.marca.espectador;
  await c.motor.espera(0.3);
  // Una miradita y media sonrisa antes de arrancar: que se vea que es a propósito.
  c.expresion("sonrisa", 0.3);
  await c.pose({ cadera: { py: -0.04 }, cejaI: { py: 0.01 }, cejaD: { py: 0.01 } }, 0.3, curva.entra);
  ctx.decir("baile");
  c.foco = null;
  // Dos vueltas: la coordinación lo quiere el doble de largo, y repetirlo mantiene el brío (bajarle la
  // velocidad lo dejaría en cámara lenta).
  await c.reproducirClip("baile", { veces: 2 });
  c.volverReposo(0.6);
  await aTirante(c);
  await c.motor.espera(0.6);
  c.expresion("neutra", 0.5);
}

/**
 * Asentir: el gesto de conformidad que trae el modelo (`Agree_Gesture`, recortado a 6,3 s).
 * Mueve los dos brazos de par en par, así que cierra el paraguas antes, como el baile.
 */
export async function asentir(c: Cuerpo, ctx: Contexto) {
  if (!c.tieneClip("asentir")) return mirarAlrededor(c);
  await cerrarParaguas(c);
  c.foco = c.marca.espectador;
  await c.motor.espera(0.35);
  c.expresion("sonrisa", 0.3);
  ctx.decir("asentir");
  await c.reproducirClip("asentir");
  c.volverReposo(0.6);
  await aTirante(c);
  await c.motor.espera(0.5);
  c.expresion("neutra", 0.5);
}

// ── Buzón de sugerencias ──────────────────────────────────────────────────────────────────
// La libreta se lleva en la mano izquierda —la del paraguas, que se apoya en el hombro como al
// partir el pan— y el lápiz en la derecha.
//
// Las rotaciones NO son a ojo: salen de congelar cada gesto en el estudio y probar 13.824
// orientaciones (pasos de 15°) puntuando contra lo que se quiere ver. Al enseñarla, la tapa de
// cara a la cámara y el lomo arriba (1,99 de 2); al escribir, las hojas hacia la cara y el lomo
// inclinado hacia delante (1,99); el lápiz, punta abajo hacia la hoja. A ojo, la libreta salía
// de canto: una raya roja que no se reconocía.
const LIBRETA_EN_D: [number, number, number] = [1.571, -2.88, -0.785];
const LIBRETA_EN_I: [number, number, number] = [-3.142, 2.88, 0.785];
const LAPIZ_EN_D: [number, number, number] = [2.618, 0.524, -2.618];

/**
 * Saca la libreta de la mochila con la derecha, mirándola por encima del hombro.
 *
 * La saca TAL CUAL está y la lleva por fuera del hombro (`ladoD`) antes de girarla: en línea recta
 * de la mochila al pecho, una libreta de 13 × 17 cm pasaba por el cuello (medido: esquinas dentro
 * de la malla del cuerpo en 1,9–2,0 s). Por fuera ya no estorba, y ahí se gira.
 */
async function sacarLibreta(c: Cuerpo) {
  const { m, marca } = c;
  c.foco = m.obj.libreta;
  await c.motor.espera(0.15);
  await c.pose({ columna: { ry: -0.16 }, pecho: { ry: -0.14 } }, 0.4);
  await c.alcanzar("D", m.ranura.libreta, 0.55, curva.sale, POLO_HOMBRO);
  await c.agarrar(m.obj.libreta, "D", 0.12, null, null);
  // Primero hacia arriba, fuera de la mochila y por encima del hombro; luego al lado. En diagonal
  // directa al lateral, el canto aún rozaba el cuello (1 fotograma, medido).
  await c.alcanzar("D", marca.hombroD, 0.3, curva.sale, POLO_HOMBRO);
  c.pose({ columna: { ry: 0 }, pecho: { ry: 0 } }, 0.5);
  await c.alcanzar("D", marca.ladoD, 0.4, curva.suave, POLO_HOMBRO);
  await c.agarrar(m.obj.libreta, "D", 0.25, LIBRETA_EN_D);
}

/** La devuelve a la mochila por el mismo camino (por fuera del hombro) y se recoloca. */
async function guardarLibreta(c: Cuerpo) {
  const { m, marca } = c;
  c.foco = m.ranura.libreta;
  await c.alcanzar("D", marca.ladoD, 0.45, curva.suave, POLO_HOMBRO);
  // Se orienta ya como en la mochila: girarla al encajarla, con la mano a la espalda, la metía
  // por el torso (medido a los 6,5 s de `anotar` y a los 5,2 s de `invitarBuzon`).
  await c.orientarComo(m.obj.libreta, m.ranura.libreta, 0.25);
  await c.pose({ columna: { ry: -0.16 }, pecho: { ry: -0.14 } }, 0.4);
  await c.alcanzar("D", marca.hombroD, 0.35, curva.suave, POLO_HOMBRO);
  await c.alcanzar("D", m.ranura.libreta, 0.4, curva.suave, POLO_HOMBRO);
  await c.dejar(m.obj.libreta, m.ranura.libreta, 0.18);
  c.volverReposo(0.7);
  await aTirante(c);
  c.expresion("neutra", 0.6);
}

/**
 * Le ha llegado una sugerencia: asiente, saca la libreta, la apunta y la guarda en la mochila.
 * El bocadillo («¡Recibido! Lo tendremos en cuenta.») lo pone la web EN EL ACTO, antes que este
 * gesto: si estaba a media acción —un baile entero son 14 s— la respuesta no puede esperar.
 */
export async function anotar(c: Cuerpo) {
  const { m, marca } = c;
  c.foco = marca.espectador;
  c.expresion("sonrisa", 0.3);
  // Dos cabeceos cortos: «te he oído».
  for (let i = 0; i < 2; i++) {
    await c.pose({ cabeza: { rx: 0.13 } }, 0.16, curva.sale);
    await c.pose({ cabeza: { rx: 0 } }, 0.2);
  }
  await sacarLibreta(c);
  // La pasa a la izquierda; el paraguas, al hombro (cerrado cuelga sin más).
  if (!c.paraguasCerrado) c.pose({ paraguas: { rx: -0.6, rz: 0.4 } }, 0.5);
  c.alcanzar("D", marca.panD, 0.5, curva.suave, POLO_REPOSO_D);
  await c.alcanzar("I", marca.panI, 0.5, curva.suave, POLO_REPOSO_I);
  await c.agarrar(m.obj.libreta, "I", 0.18, LIBRETA_EN_I);
  // Coge el lápiz del canto y escribe mirando la hoja. Sin inclinar más el cuello: la mirada ya
  // baja sola, y con la cámara por encima, el ala del sombrero le tapaba la cara entera.
  c.foco = m.obj.libreta;
  c.pose({ cejaI: { py: 0.006 }, cejaD: { py: 0.006 } }, 0.4);
  await c.alcanzar("D", m.ranura.lapiz, 0.35, curva.suave, POLO_REPOSO_D);
  await c.agarrar(m.obj.lapiz, "D", 0.12, LAPIZ_EN_D, [0, -0.03, 0.03]);
  await c.alcanzar("D", m.ranura.escribir, 0.3, curva.suave, POLO_REPOSO_D);
  const hoja = m.ranura.escribir;
  const x0 = hoja.position.x;
  const y0 = hoja.position.y;
  for (let renglon = 0; renglon < 3; renglon++) {
    // Un renglón: la mano avanza a saltitos, como la letra.
    for (let k = 0; k < 4; k++) {
      await moverMarca(c, hoja, 0.012, 0.004, 0, 0.07, curva.sale);
      await moverMarca(c, hoja, 0.002, -0.004, 0, 0.06);
    }
    // Vuelta al principio del siguiente.
    await c.motor.tw(0.16, curva.suave, (k) => hoja.position.set(x0 + 0.056 * (1 - k), y0 - 0.02 * (renglon + k), hoja.position.z));
  }
  // Punto final, con énfasis, y levanta la vista hacia quien la ha mandado.
  c.foco = marca.espectador;
  await moverMarca(c, hoja, 0, 0, -0.008, 0.08, curva.entra);
  await moverMarca(c, hoja, 0, 0, 0.008, 0.12, curva.rebota);
  hoja.position.set(x0, y0, hoja.position.z);
  // Lápiz a su sitio y libreta a la derecha, para guardarla.
  c.pose({ cejaI: { py: 0 }, cejaD: { py: 0 } }, 0.4);
  // El lápiz se endereza mientras vuelve, no al encajar: girando en el sitio, la punta rozaba
  // la camiseta (con el paraguas cerrado la libreta va más baja, a la altura de la tripa).
  await Promise.all([
    c.alcanzar("D", m.ranura.lapiz, 0.3, curva.suave, POLO_REPOSO_D),
    c.orientarComo(m.obj.lapiz, m.ranura.lapiz, 0.3),
  ]);
  await c.dejar(m.obj.lapiz, m.ranura.lapiz, 0.12);
  // La recoge la derecha SIN girarla: el giro a su postura de mano, a 0,15 s, barría el brazo.
  await c.agarrar(m.obj.libreta, "D", 0.15, null, null);
  // Y la mano pasa a un punto fijo del pecho: su destino era la ranura del lápiz, que ahora va
  // en la libreta que ella misma sostiene.
  c.alcanzar("D", marca.panD, 0.3, curva.suave, POLO_REPOSO_D);
  c.pose({ paraguas: { rx: -0.08, rz: 0.02 } }, 0.5, curva.asienta);
  c.alcanzar("I", marcaParaguas(c), 0.5, curva.asienta, POLO_REPOSO_I);
  // Una palmadita a la libreta antes de guardarla: queda apuntado.
  c.foco = marca.espectador;
  await c.motor.espera(0.25);
  await guardarLibreta(c);
}

/** Invita a usar el buzón: saca la libreta y la enseña. El bocadillo abre el buzón al pulsarlo. */
export async function invitarBuzon(c: Cuerpo, ctx: Contexto) {
  const { marca } = c;
  await sacarLibreta(c);
  c.foco = marca.espectador;
  c.expresion("sonrisa", 0.3);
  c.pose({ columna: { rx: 0.06 }, pecho: { rx: 0.04 }, cabeza: { rz: -0.1 } }, 0.5);
  await c.alcanzar("D", marca.ofrecer, 0.6, curva.asienta, [-0.8, -0.7, -0.1]);
  ctx.decir("invitacion");
  // Un meneo de la libreta, para llamar la atención sin aspavientos.
  for (const z of [0.012, -0.012, 0]) await moverMarca(c, marca.ofrecer, 0, z, 0, 0.14);
  await c.motor.espera(3);
  c.pose({ columna: { rx: 0 }, pecho: { rx: 0 }, cabeza: { rz: 0 } }, 0.5);
  await guardarLibreta(c);
}

export async function mirarAlrededor(c: Cuerpo) {
  const h = c.marca.horizonte;
  c.foco = h;
  const lado = Math.random() < 0.5 ? 1 : -1;
  await moverMarca(c, h, 1.5 * lado, azar(-0.1, 0.3), 0, 0.5);
  await c.motor.espera(azar(0.6, 1.2));
  await moverMarca(c, h, -2.6 * lado, 0, 0, 0.8);
  await c.motor.espera(azar(0.5, 1));
  await moverMarca(c, h, 1.1 * lado, 0, 0, 0.5);
  h.position.set(0, 1.55, 2.2);
  c.foco = null;
}

export const ACCIONES: Record<NombreAccion, (c: Cuerpo, ctx: Contexto) => Promise<void>> = {
  refrescarse,
  crema,
  paraguas,
  gafas,
  pan,
  silbato,
  saludar,
  cerrarParaguas,
  abrirParaguas,
  votar,
  bailar,
  asentir,
  anotar,
  invitarBuzon,
  mirarAlrededor,
};
