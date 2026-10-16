import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COLORES, construirMaqueta, type Articulacion, type Maqueta, type Proporciones } from "./maqueta";
import { Motor, Muelle, Suave, curva, limitar, azar, type Curva } from "./motor";

/**
 * El cuerpo del huelguista: compone, cada fotograma, CUATRO capas sobre la maqueta.
 *
 *  1. AUTORÍA (`acc`)   — lo que las acciones piden: poses, gestos, expresiones. Interpolado.
 *  2. VIDA (`proc`)     — lo que nunca para: respirar, cambiar el peso, parpadear, mirar, andar.
 *  3. CONTACTO (IK)     — pies clavados al suelo y manos que llegan a los objetos, pase lo que
 *                         pase arriba. Es lo que hace que agacharse doble las rodillas solas.
 *  4. INERCIA (muelles) — mochila, silbato, gafas, pulverizador y tela del paraguas. Nadie los
 *                         anima: reaccionan a cómo se ha movido aquello de lo que cuelgan.
 *
 * Las acciones (`acciones.ts`) solo hablan con esta API; el cerebro (`cerebro.ts`) solo decide
 * cuándo. Cuando llegue el modelo glTF, esta clase cambia su fuente de huesos y nada más.
 */

type Base = Record<string, { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }>;
type Canal = { rx: number; ry: number; rz: number; px: number; py: number; pz: number; sx: number; sy: number; sz: number };
const canal = (): Canal => ({ rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, sx: 0, sy: 0, sz: 0 });
const CANALES = ["rx", "ry", "rz", "px", "py", "pz", "sx", "sy", "sz"] as const;

export type Nodo = Articulacion | "formaVientre" | "formaPecho" | "paraguas";
export type Pose = Partial<Record<Nodo, Partial<Canal>>>;
export type Lado = "I" | "D";
export type Expresion = "neutra" | "sonrisa" | "o" | "soplar";

/** Pose de reposo: la de la ilustración (las dos manos en los tirantes, el paraguas al hombro). */
export const POSE_REPOSO: Pose = {
  cadera: { py: -0.014 },
  paraguas: { rx: -0.08, rz: 0.02 },
};

const ABAJO = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _eu = new THREE.Euler();
const EULER_CERO = new THREE.Euler();
const _q4 = new THREE.Quaternion();
/** Paraguas cerrado "de bastón": punta abajo, un poco hacia fuera y hacia delante (libra la pierna). */
const EULER_BASTON = new THREE.Euler(-0.24, 0, -Math.PI + 0.14);

type BrazoIK = {
  peso: number;
  a: THREE.Object3D;
  b: THREE.Object3D | null;
  mezcla: number;
  polo: THREE.Vector3;
  fantasma: THREE.Object3D;
  /** Último destino resuelto, en el marco del pecho: donde se queda la mano si el suyo no vale. */
  ultimo: THREE.Vector3 | null;
};

type Marcas = Record<
  | "tiranteD"
  | "paraguasI"
  | "cara"
  | "nariz"
  | "boca"
  | "ojos"
  | "pechoFrente"
  | "ofrecer"
  | "panI"
  | "panD"
  | "saludo"
  | "sombrero"
  | "bastonI"
  | "paraguasBajo"
  | "voto"
  | "ladoD",
  [number, number, number]
>;

const MARCAS_MAQUETA: Marcas = {
  tiranteD: [-0.105, 0.06, 0.2],
  paraguasI: [0.24, 0.1, 0.18],
  cara: [-0.02, 0.1, 0.34],
  nariz: [-0.01, 0.1, 0.17],
  boca: [-0.004, 0.06, 0.19],
  ojos: [0, 0.12, 0.3],
  pechoFrente: [-0.02, 0.05, 0.34],
  ofrecer: [-0.34, 0.06, 0.4],
  panI: [0.08, 0.06, 0.32],
  panD: [-0.08, 0.06, 0.32],
  saludo: [-0.36, 0.5, 0.1],
  sombrero: [-0.02, 0.3, 0.08],
  bastonI: [0.27, -0.22, 0.14],
  paraguasBajo: [0.16, -0.02, 0.3],
  voto: [-0.22, 0.6, 0.07],
  ladoD: [-0.46, 0.12, 0.12],
};

/**
 * Las mismas marcas sobre el modelo de Meshy. Sale de medir su malla en reposo: pecho de +0,06 a
 * −0,14 m en z (la maqueta, ±0,15), hombros a 1,18 m, cara a +0,15 m, ojos a 1,46 m, y brazo de
 * 0,22 + 0,20 m. Coordenadas en el marco del pecho (Spine2) o de la cabeza (Head).
 */
const MARCAS_MODELO: Marcas = {
  tiranteD: [-0.085, -0.02, 0.155],
  paraguasI: [0.2, 0, 0.16],
  cara: [-0.02, 0.09, 0.36],
  nariz: [-0.01, 0.09, 0.27],
  boca: [0, 0.04, 0.23],
  ojos: [0, 0.11, 0.3],
  pechoFrente: [-0.02, 0, 0.28],
  ofrecer: [-0.32, 0.02, 0.36],
  panI: [0.08, 0, 0.26],
  panD: [-0.08, 0, 0.26],
  saludo: [-0.32, 0.4, 0.1],
  sombrero: [-0.02, 0.27, 0.1],
  bastonI: [0.25, -0.19, 0.14],
  paraguasBajo: [0.14, -0.05, 0.26],
  voto: [-0.19, 0.44, 0.06],
  ladoD: [-0.4, 0.08, 0.1],
};

/** Nombres de Mixamo sin prefijo: GLTFLoader quita los ":" ("mixamorig:Hips" → "mixamorigHips"). */
const nombreHueso = (n: string) => n.replace(/[^A-Za-z0-9]/g, "").replace(/^mixamorig\d*/i, "");
const HUESOS_NECESARIOS = ["Hips", "Spine", "Spine2", "Neck", "Head", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandMiddle1", "RightArm", "RightForeArm", "RightHand", "RightHandMiddle1"];

function huesosMixamo(modelo: THREE.Object3D) {
  const h: Record<string, THREE.Object3D> = {};
  modelo.traverse((o) => {
    if ((o as THREE.Bone).isBone) h[nombreHueso(o.name)] = o;
  });
  return HUESOS_NECESARIOS.every((n) => h[n]) ? h : null;
}

/** Proporciones de la maqueta sacadas del esqueleto del modelo, simétricas (media de lados). */
function proporcionesDesdeModelo(h: Record<string, THREE.Object3D>): Proporciones {
  h.Hips.parent?.updateWorldMatrix(true, true);
  h.Hips.updateWorldMatrix(false, true);
  const w = (n: string) => h[n].getWorldPosition(new THREE.Vector3());
  const d = (a: string, b: string) => w(a).distanceTo(w(b));
  const media = (a: number, b: number) => (a + b) / 2;
  const [hips, sp, sp2, neck, head] = ["Hips", "Spine", "Spine2", "Neck", "Head"].map(w);
  const [upL, upR, footL, footR, armL, armR] = ["LeftUpLeg", "RightUpLeg", "LeftFoot", "RightFoot", "LeftArm", "RightArm"].map(w);
  return {
    cadera: [0, hips.y, hips.z],
    pierna: [(upL.x - upR.x) / 2, media(upL.y, upR.y) - hips.y, media(upL.z, upR.z) - hips.z],
    muslo: media(d("LeftUpLeg", "LeftLeg"), d("RightUpLeg", "RightLeg")),
    tibia: media(d("LeftLeg", "LeftFoot"), d("RightLeg", "RightFoot")),
    alturaTobillo: media(footL.y, footR.y),
    pieZ: media(footL.z, footR.z),
    columna: [0, sp.y - hips.y, sp.z - hips.z],
    pecho: [0, sp2.y - sp.y, sp2.z - sp.z],
    cuello: [0, neck.y - sp2.y, neck.z - sp2.z],
    cabeza: [0, head.y - neck.y, head.z - neck.z],
    hombro: [(armL.x - armR.x) / 2, media(armL.y, armR.y) - sp2.y, media(armL.z, armR.z) - sp2.z],
    brazo: media(d("LeftArm", "LeftForeArm"), d("RightArm", "RightForeArm")),
    antebrazo: media(d("LeftForeArm", "LeftHand"), d("RightForeArm", "RightHand")),
  };
}

/** Péndulo que cuelga de un punto: se alinea con la gravedad y se retrasa con la inercia. */
class Colgante {
  private mx: Muelle;
  private mz: Muelle;
  private prev = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private acel = new THREE.Vector3();
  private iniciado = false;
  constructor(
    readonly obj: THREE.Object3D,
    private largo: number,
    /** Cuánto puede irse hacia atrás (+rx) antes de "tocar" el pecho. */
    private tope = 0.06,
    rigidez = 40,
    amort = 2.4,
  ) {
    this.mx = new Muelle(rigidez, amort);
    this.mz = new Muelle(rigidez, amort);
  }

  paso(dt: number, desplX: number) {
    const padre = this.obj.parent!;
    this.obj.getWorldPosition(_a);
    _a.x += desplX;
    if (!this.iniciado) {
      this.prev.copy(_a);
      this.iniciado = true;
    }
    _b.subVectors(_a, this.prev).divideScalar(dt);
    _c.subVectors(_b, this.vel).divideScalar(dt);
    this.acel.lerp(_c, 0.35);
    this.vel.copy(_b);
    this.prev.copy(_a);

    padre.getWorldQuaternion(_q).invert();
    _d.copy(ABAJO).applyQuaternion(_q);
    _e.copy(this.acel).applyQuaternion(_q);
    const gz = Math.atan2(_d.x, -_d.y);
    const gx = Math.atan2(-_d.z, -_d.y);
    const k = 0.55 / this.largo;
    const x = this.mx.paso(dt, gx, limitar(_e.z * k, -60, 60));
    const z = this.mz.paso(dt, gz, limitar(-_e.x * k, -60, 60));
    this.obj.rotation.set(Math.min(x, this.tope), 0, z);
  }

  empujar(ix: number, iz: number) {
    this.mx.empujar(ix);
    this.mz.empujar(iz);
  }
}

/** Mochila y tela del paraguas: no cuelgan libres, se retrasan respecto a su soporte. */
class Retraso {
  readonly mx: Muelle;
  readonly mz: Muelle;
  readonly my: Muelle;
  private prev = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private acel = new THREE.Vector3();
  private iniciado = false;
  constructor(
    readonly obj: THREE.Object3D,
    private ganancia: number,
    rigidez: number,
    amort: number,
  ) {
    this.mx = new Muelle(rigidez, amort);
    this.mz = new Muelle(rigidez, amort);
    this.my = new Muelle(rigidez * 1.6, amort * 1.2);
  }

  paso(dt: number, desplX: number, base: THREE.Euler, basePy: number) {
    const padre = this.obj.parent!;
    this.obj.getWorldPosition(_a);
    _a.x += desplX;
    if (!this.iniciado) {
      this.prev.copy(_a);
      this.iniciado = true;
    }
    _b.subVectors(_a, this.prev).divideScalar(dt);
    _c.subVectors(_b, this.vel).divideScalar(dt);
    this.acel.lerp(_c, 0.3);
    this.vel.copy(_b);
    this.prev.copy(_a);
    padre.getWorldQuaternion(_q).invert();
    _e.copy(this.acel).applyQuaternion(_q);
    const g = this.ganancia;
    const x = this.mx.paso(dt, 0, limitar(_e.z * g, -40, 40));
    const z = this.mz.paso(dt, 0, limitar(-_e.x * g, -40, 40));
    const y = this.my.paso(dt, 0, limitar(-_e.y * g * 0.02, -2, 2));
    this.obj.rotation.set(base.x + x, base.y, base.z + z);
    this.obj.position.y = basePy + y;
  }
}

export class Cuerpo {
  readonly m: Maqueta;
  readonly motor = new Motor();
  readonly acc: Record<Nodo, Canal>;
  private proc: Record<Nodo, Canal>;
  private nodos: Record<Nodo, THREE.Object3D>;
  private base: Base;
  private t = 0;

  // ── Andar ──
  /** Velocidad en unidades/s, con signo: + hacia la derecha de la pantalla. */
  velocidad = 0;
  private fase = 0;
  private pesoAndar = new Suave(0);
  orientacionObjetivo = 0;
  private orientacion = new Suave(0);
  /** Desplazamiento virtual en x (el cuerpo no se mueve en su escena: se mueve su lienzo). */
  private desplX = 0;

  // ── Mirada ──
  /** Hacia dónde mira cuando nadie le dirige la mirada (lo pone el puntero). */
  miradaLibre = { yaw: 0, pitch: 0 };
  /** Si hay foco, manda sobre `miradaLibre`: las acciones miran a lo que van a coger. */
  foco: THREE.Object3D | null = null;
  private cabezaYaw = new Suave();
  private cabezaPitch = new Suave();
  private ojosYaw = new Suave();
  private ojosPitch = new Suave();

  // ── Peso, parpadeo, boca ──
  private ladoPeso = 1;
  private proximoPeso = 3;
  private pesoLateral = new Suave(0);
  private proximoParpadeo = 1.5;
  private parpadeo = -1;
  readonly boca = { neutra: 1, sonrisa: 0, o: 0, mejillas: 0 };

  // ── Brazos, colgantes, retrasos ──
  readonly ik: Record<Lado, BrazoIK>;
  private colgantes: Colgante[];
  private colgante: { silbato: Colgante; gafas: Colgante; pulverizador: Colgante };
  private mochila: Retraso;
  private tela: Retraso;
  private telaHinchado = new Muelle(140, 7);
  /** Viento sobre la tela: lo empuja `rafaga()`, decae solo. */
  private viento = 0;

  // ── Paraguas: abierto/cerrado y arriba/abajo son dos cosas que se animan por separado ──
  /** 0 = tela abierta · 1 = plegada sobre la varilla. */
  paraguasCierre = 0;
  /** 0 = arriba, sobre la cabeza · 1 = abajo, sujeto como un bastón. */
  paraguasGiro = 0;
  /** Estado lógico (lo consultan las acciones y el cerebro). */
  paraguasCerrado = false;

  /** Puntos de referencia a los que llegan las manos. Se pueden mover durante un gesto. */
  readonly marca: Record<
    | "tiranteD"
    | "paraguasI"
    | "cara"
    | "nariz"
    | "boca"
    | "ojos"
    | "pechoFrente"
    | "ofrecer"
    | "panI"
    | "panD"
    | "saludo"
    | "sombrero"
    | "hombroD"
    | "ladoD"
    | "bastonI"
    | "paraguasBajo"
    | "corredera"
    | "voto"
    | "horizonte"
    | "espectador",
    THREE.Object3D
  >;

  private particulas: { malla: THREE.Mesh; v: THREE.Vector3; vida: number; gravedad: number }[] = [];
  private matGota: THREE.MeshStandardMaterial;
  private matMiga: THREE.MeshStandardMaterial;
  private geoParticula: THREE.SphereGeometry;

  // ── Modelo (cuando lo hay) ──
  private retarget: { p: THREE.Object3D; b: THREE.Object3D; desfase: THREE.Quaternion }[] = [];
  private hips: THREE.Object3D | null = null;
  private hipsReposo = new THREE.Vector3();
  private caderaReposo = new THREE.Vector3();
  private extras: { dispose(): void }[] = [];
  private huesoSombrero: THREE.Object3D | null = null;
  private sombreroReposo = new THREE.Vector3();
  // ── Clips del propio modelo (el baile de Meshy) ──
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<string, THREE.AnimationClip>();
  private accionClip: THREE.AnimationAction | null = null;
  /** 0 = manda la maqueta (IK, vida, acciones) · 1 = manda el clip. Se cruza con una curva. */
  private mezclaClip = 0;
  /** Cuánto gira el párpado al cerrarse. Depende de cuán abierto esté en reposo. */
  private cierreParpado = 1.95;
  // ── Andar con el clip del modelo ──
  private accionAndar: THREE.AnimationAction | null = null;
  /** Metros por segundo que "anda" el clip, deducidos de la zancada (anda en el sitio). */
  private velocidadClipAndar = 1;
  /**
   * Cuánto manda el clip de andar en cada articulación (1 = del todo). Dos excepciones:
   * cuello, cabeza y sombrero se quedan fuera, para que la mirada siga siendo nuestra; y el
   * brazo del paraguas depende de la copa (ver `actualizar`): el clip de Meshy es de manos
   * vacías y su braceo bajaba la copa 22 cm, hasta atravesar el sombrero.
   */
  private pesoAndarHueso = new Map<THREE.Object3D, number>();
  /** ¿Se está viendo el modelo de verdad (y no la maqueta)? */
  get conModelo() {
    return this.retarget.length > 0;
  }

  /** ¿Hay un clip del modelo sonando (el baile)? Mientras tanto, la IK y la vida se apartan. */
  get enClip() {
    return this.mezclaClip > 0.001;
  }

  tieneClip(nombre: string) {
    return this.clips.has(nombre);
  }

  constructor(modelo?: THREE.Object3D, animaciones: THREE.AnimationClip[] = []) {
    // Con modelo: la maqueta se construye con SUS proporciones y queda como esqueleto invisible
    // que anima al modelo (ver `prepararModelo`). Sin modelo (no cargó): la maqueta a la vista.
    const huesos = modelo ? huesosMixamo(modelo) : null;
    this.m = construirMaqueta(huesos ? proporcionesDesdeModelo(huesos) : undefined);
    const conModelo = !!huesos;
    const { j, forma, obj } = this.m;
    if (conModelo) this.ajustarAtrezo();
    if (conModelo) this.ajustarCara();
    this.nodos = { ...j, formaVientre: forma.vientre, formaPecho: forma.pecho, paraguas: obj.paraguas };
    const nombres = Object.keys(this.nodos) as Nodo[];
    this.acc = Object.fromEntries(nombres.map((n) => [n, canal()])) as Record<Nodo, Canal>;
    this.proc = Object.fromEntries(nombres.map((n) => [n, canal()])) as Record<Nodo, Canal>;
    this.base = Object.fromEntries(
      nombres.map((n) => {
        const o = this.nodos[n];
        return [n, { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() }];
      }),
    ) as Base;
    this.aplicarPose(POSE_REPOSO);

    const marca = (padre: THREE.Object3D, p: [number, number, number]) => {
      const o = new THREE.Object3D();
      o.position.set(...p);
      padre.add(o);
      return o;
    };
    // Dónde llegan las manos. Dos juegos: el de la maqueta (pecho de ±15 cm) y el del modelo de
    // Meshy (pecho de +6/−14 cm: más fino y más atrás). Medidas del modelo en reposo, 30-sep-2026.
    const M = conModelo ? MARCAS_MODELO : MARCAS_MAQUETA;
    this.marca = {
      tiranteD: marca(j.pecho, M.tiranteD),
      paraguasI: marca(j.pecho, M.paraguasI),
      cara: marca(j.cabeza, M.cara),
      nariz: marca(j.cabeza, M.nariz),
      boca: marca(j.cabeza, M.boca),
      ojos: marca(j.cabeza, M.ojos),
      pechoFrente: marca(j.pecho, M.pechoFrente),
      // En diagonal y no recto a cámara: de frente, el brazo se escorza y el gesto no se lee.
      ofrecer: marca(j.pecho, M.ofrecer),
      panI: marca(j.pecho, M.panI),
      panD: marca(j.pecho, M.panD),
      saludo: marca(j.pecho, M.saludo),
      sombrero: marca(j.cabeza, M.sombrero),
      hombroD: marca(j.pecho, [-0.26, 0.34, -0.08]),
      // Paraguas cerrado: el brazo cae y la mano queda a la altura de la cadera.
      bastonI: marca(j.pecho, M.bastonI),
      // Paraguas bajado por delante, para cerrarlo o abrirlo con la otra mano.
      paraguasBajo: marca(j.pecho, M.paraguasBajo),
      // En la varilla: la mano derecha baja (cierra) o sube (abre) la corredera.
      corredera: marca(this.m.obj.paraguas, [0, 0.55, 0]),
      // Mano alzada para votar: arriba, casi estirada, un pelo por delante del hombro.
      voto: marca(j.pecho, M.voto),
      // Por FUERA del hombro derecho, a media altura: punto de paso entre la mochila y el pecho
      // para lo que es grande (la libreta). En línea recta, la mano lo hacía pasar por el cuello.
      ladoD: marca(j.pecho, M.ladoD),
      // Para mirar lejos: un punto que se pasea por delante (mirar alrededor) y la cámara.
      horizonte: marca(this.m.raiz, [0, conModelo ? 1.45 : 1.55, 2.2]),
      espectador: marca(this.m.raiz, [0, conModelo ? 1.15 : 1.25, 6]),
    };

    const fantasma = (lado: Lado) => marca(j.pecho, lado === "I" ? M.paraguasI : M.tiranteD);
    this.ik = {
      D: { peso: 1, a: this.marca.tiranteD, b: null, mezcla: 0, polo: new THREE.Vector3(-0.8, -0.5, -0.6), fantasma: fantasma("D"), ultimo: null },
      I: { peso: 1, a: this.marca.paraguasI, b: null, mezcla: 0, polo: new THREE.Vector3(0.8, -0.5, -0.6), fantasma: fantasma("I"), ultimo: null },
    };

    const p = this.m.pendulo;
    this.colgante = {
      // Los topes son negativos: el pecho empuja el colgante hacia delante y descansa sobre
      // la camiseta en vez de atravesarla. Puede separarse (inercia), no hundirse.
      silbato: new Colgante(p.silbato, 0.21, conModelo ? -0.24 : -0.34),
      gafas: new Colgante(p.gafas, 0.1, conModelo ? -0.4 : -0.62, 55, 2.6),
      pulverizador: new Colgante(p.pulverizador, 0.08, 0.1, 60, 3),
    };
    this.colgantes = Object.values(this.colgante);
    this.mochila = new Retraso(j.mochila, 0.045, 70, 6.5);
    this.tela = new Retraso(obj.tela, 0.03, 110, 5);

    this.geoParticula = new THREE.SphereGeometry(0.009, 6, 4);
    this.matGota = new THREE.MeshStandardMaterial({ color: "#D6F0FA", roughness: 0.1, transparent: true, opacity: 0.85 });
    this.matMiga = new THREE.MeshStandardMaterial({ color: "#E2B070", roughness: 0.9 });

    if (modelo && huesos) this.prepararModelo(modelo, huesos, animaciones);
  }

  /**
   * Recoloca el atrezo sobre el cuerpo del modelo, más fino que el de la maqueta. Va ANTES de
   * fijar el reposo (`base`), porque la mochila es una articulación y su sitio es su reposo.
   */
  private ajustarAtrezo() {
    const { j, pendulo, ranura, obj } = this.m;
    // El modelo mide 1,70 m (la maqueta, 1,84): el paraguas, al 90 %, para que no lo empequeñezca
    // y para que cerrado, de bastón, no atraviese el suelo.
    obj.paraguas.scale.setScalar(0.9);
    j.mochila.position.set(0, 0.06, -0.15);
    j.mochila.scale.setScalar(0.85);
    pendulo.silbato.position.set(0, 0.05, 0.075);
    pendulo.gafas.position.set(0, 0.05, 0.085);
    pendulo.pulverizador.position.set(-0.16, -0.02, 0.07);
    ranura.gafasCara.position.set(0, 0.113, 0.235);
    // Tirantes de la mochila sobre la camiseta del modelo (los de la maqueta van en su torso,
    // que se oculta): bajan del hombro al pecho.
    const material = new THREE.MeshStandardMaterial({ color: COLORES.tirante, roughness: 0.62 });
    const geo = new RoundedBoxGeometry(0.034, 0.3, 0.014, 2, 0.006);
    const geoHombro = new RoundedBoxGeometry(0.034, 0.12, 0.014, 2, 0.006);
    for (const lado of [1, -1]) {
      const t = new THREE.Mesh(geo, material);
      t.position.set(0.085 * lado, -0.06, 0.1);
      t.rotation.set(0.12, 0, 0.05 * lado);
      j.pecho.add(t);
      const h = new THREE.Mesh(geoHombro, material);
      h.position.set(0.085 * lado, 0.06, 0.03);
      h.rotation.set(-1.15, 0, 0);
      j.pecho.add(h);
    }
    this.extras.push(geo, geoHombro, material);
  }

  /**
   * Recoloca la cara sobre el rostro del modelo. Los ojos y la boca del modelo venían PINTADOS
   * en la textura y `preparar-huelguista.mjs` los borra: los de verdad son estos, de geometría,
   * que son los que pueden parpadear, mirar y cambiar de expresión.
   *
   * Medidas tomadas sobre el modelo en reposo (30-sep-2026), relativas al hueso `Head`: ojos a
   * 12,9 cm por encima y ±4,45 cm del eje; boca a 3,0 cm. La cara del modelo es más alargada y
   * algo más ancha que la de la maqueta, de ahí las escalas.
   */
  private ajustarCara() {
    const c = this.m.cara;
    for (const [ojo, pupila, parpado, lado] of [
      [c.ojoI, c.pupilaI, this.m.j.parpadoI, 1],
      [c.ojoD, c.pupilaD, this.m.j.parpadoD, -1],
    ] as [THREE.Object3D, THREE.Object3D, THREE.Object3D, number][]) {
      // La z es crítica: la superficie de la cara está a 0,134 y la esfera del ojo sobresale.
      // Metida hasta 0,121 asoma el casquete justo, como un ojo y no como una canica.
      ojo.position.set(0.0445 * lado, 0.129, 0.1235);
      ojo.scale.set(1.35, 1.25, 1);
      // Pupila más pequeña que en la maqueta: al agrandar el ojo, la de origen (55 % del blanco)
      // se comía la esclerótica y quedaba una mirada de botón.
      pupila.scale.setScalar(0.85);
      // Y el párpado más abierto: el del muñeco iba caído y aquí tapaba casi todo el blanco.
      parpado.rotation.x = -0.88;
    }
    this.cierreParpado = 2.3;
    for (const [ceja, lado] of [
      [this.m.j.cejaI, 1],
      [this.m.j.cejaD, -1],
    ] as [THREE.Object3D, number][]) {
      // Justo encima del ojo: más arriba se meten bajo el ala del sombrero, que en este
      // modelo cae a solo 3 cm de los ojos.
      ceja.position.set(0.05 * lado, 0.158, 0.132);
      ceja.scale.setScalar(1.2);
    }
    // A 0,147 la boca quedaba DENTRO de la cara (la superficie está a 0,156) y solo asomaba un
    // punto por el lado. Va por delante, y algo más estrecha para que no flote en las comisuras.
    const boca = c.bocaNeutra.parent!;
    boca.position.set(0, 0.031, 0.158);
    boca.scale.set(1.2, 1.2, 1);
    for (const [mejilla, lado] of [
      [c.mejillaI, 1],
      [c.mejillaD, -1],
    ] as [THREE.Object3D, number][]) {
      mejilla.position.set(0.063 * lado, 0.055, 0.1);
    }
  }

  /**
   * Retargeting: cada fotograma, el hueso del modelo copia la rotación EN EL MUNDO de su
   * articulación de la maqueta, corregida por la diferencia que tenían en reposo.
   *
   * Para que esa diferencia sea solo de "ejes" y no de postura, antes de medirla se coloca la
   * maqueta en la pose del modelo (brazos en A, piernas como estén): cada segmento apuntando a
   * donde apunta el del modelo. Así, cuando la IK pone la mano de la maqueta en el tirante, la
   * del modelo acaba en el mismo sitio.
   */
  private prepararModelo(modelo: THREE.Object3D, h: Record<string, THREE.Object3D>, animaciones: THREE.AnimationClip[]) {
    const j = this.m.j;
    this.m.raiz.add(modelo);
    modelo.traverse((o) => {
      // La malla con esqueleto se deforma fuera de su caja original: sin esto, desaparece al
      // levantar un brazo por "estar fuera de cámara".
      if (!(o as THREE.Mesh).isMesh) return;
      o.frustumCulled = false;
      const malla = o as THREE.Mesh;
      const mat = malla.material as THREE.MeshStandardMaterial;
      this.extras.push(malla.geometry, mat, ...(mat.map ? [mat.map] : []));
    });
    for (const o of this.m.mallasCuerpo) o.visible = false;
    this.m.raiz.updateMatrixWorld(true);

    const w = (n: string) => h[n].getWorldPosition(new THREE.Vector3());
    const alinear = (p: THREE.Object3D, desde: string, hasta: string) => {
      const dir = w(hasta).sub(w(desde)).normalize();
      p.parent!.getWorldQuaternion(_q).invert();
      p.quaternion.setFromUnitVectors(ABAJO, dir.applyQuaternion(_q));
      p.updateMatrixWorld(true);
    };
    for (const [l, m] of [
      ["I", "Left"],
      ["D", "Right"],
    ] as const) {
      alinear(j[`pierna${l}`], `${m}UpLeg`, `${m}Leg`);
      alinear(j[`rodilla${l}`], `${m}Leg`, `${m}Foot`);
      alinear(j[`brazo${l}`], `${m}Arm`, `${m}ForeArm`);
      alinear(j[`codo${l}`], `${m}ForeArm`, `${m}Hand`);
      alinear(j[`mano${l}`], `${m}Hand`, `${m}HandMiddle1`);
    }

    // Padres antes que hijos: así cada hueso lee la rotación ya corregida de su padre.
    const pares: [Articulacion, string][] = [
      ["cadera", "Hips"],
      ["columna", "Spine"],
      ["pecho", "Spine2"],
      ["cuello", "Neck"],
      ["cabeza", "Head"],
      ["piernaI", "LeftUpLeg"],
      ["rodillaI", "LeftLeg"],
      ["tobilloI", "LeftFoot"],
      ["piernaD", "RightUpLeg"],
      ["rodillaD", "RightLeg"],
      ["tobilloD", "RightFoot"],
      ["brazoI", "LeftArm"],
      ["codoI", "LeftForeArm"],
      ["manoI", "LeftHand"],
      ["brazoD", "RightArm"],
      ["codoD", "RightForeArm"],
      ["manoD", "RightHand"],
      // El sombrero tiene hueso propio (se lo pone `preparar-huelguista.mjs`): en el modelo iba
      // pegado a la cabeza y así la ráfaga puede volver a levantarlo.
      ...((h.Sombrero ? [["sombrero", "Sombrero"]] : []) as [Articulacion, string][]),
    ];
    this.retarget = pares.map(([p, b]) => ({
      p: j[p],
      b: h[b],
      desfase: j[p].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(h[b].getWorldQuaternion(new THREE.Quaternion())),
    }));
    this.hips = h.Hips;
    this.hipsReposo = h.Hips.position.clone();
    if (h.Sombrero) {
      this.huesoSombrero = h.Sombrero;
      this.sombreroReposo.copy(h.Sombrero.position);
    }
    if (animaciones.length) {
      this.mixer = new THREE.AnimationMixer(modelo);
      for (const a of animaciones) this.clips.set(a.name, a);
      for (const n of ["cuello", "cabeza", "sombrero"] as Articulacion[]) this.pesoAndarHueso.set(j[n], 0);
      // El brazo del paraguas se ajusta en cada fotograma (ver `actualizar`): depende de si la
      // copa está abierta o cerrada.
      for (const n of ["brazoI", "codoI", "manoI"] as Articulacion[]) this.pesoAndarHueso.set(j[n], 0);
      const andar = this.clips.get("andar");
      if (andar) {
        this.velocidadClipAndar = this.medirVelocidadClip(andar, h.LeftFoot, h.RightFoot);
        this.accionAndar = this.mixer.clipAction(andar);
        this.accionAndar.play();
        this.accionAndar.setEffectiveWeight(1);
      }
    }
    this.caderaReposo = this.m.raiz.worldToLocal(j.cadera.getWorldPosition(new THREE.Vector3()));
    // La maqueta vuelve a su reposo: la composición de cada fotograma manda desde aquí.
    for (const l of ["I", "D"] as const) {
      for (const n of [`pierna${l}`, `rodilla${l}`, `brazo${l}`, `codo${l}`, `mano${l}`] as Articulacion[]) j[n].quaternion.identity();
    }
  }

  /**
   * A qué velocidad "anda" el clip. Es un andar EN EL SITIO (la cadera no avanza), así que la
   * velocidad sale de la zancada: la separación máxima entre los pies es la longitud de un paso,
   * y en un ciclo completo se dan dos. Sin esto, los pies patinarían: el clip iría a su ritmo y
   * el personaje al suyo.
   */
  private medirVelocidadClip(clip: THREE.AnimationClip, pieI: THREE.Object3D, pieD: THREE.Object3D) {
    const accion = this.mixer!.clipAction(clip);
    accion.reset().play();
    let min = Infinity;
    let max = -Infinity;
    const N = 48;
    for (let i = 0; i <= N; i++) {
      this.mixer!.setTime((i / N) * clip.duration);
      this.m.raiz.updateMatrixWorld(true);
      const dz = pieI.getWorldPosition(_a).z - pieD.getWorldPosition(_b).z;
      min = Math.min(min, dz);
      max = Math.max(max, dz);
    }
    accion.stop();
    this.mixer!.setTime(0);
    // (max − min) = dos pasos; en un ciclo se recorren exactamente esos dos pasos.
    return Math.max(0.2, (max - min) / clip.duration);
  }

  /** Lleva el modelo a la pose de la maqueta (último paso del fotograma). */
  private aplicarModelo() {
    if (!this.retarget.length || !this.hips) return;
    this.m.raiz.updateMatrixWorld(true);
    const c = this.m.raiz.worldToLocal(this.m.j.cadera.getWorldPosition(_a));
    this.hips.position.copy(this.hipsReposo).add(c.sub(this.caderaReposo));
    for (const r of this.retarget) {
      r.p.getWorldQuaternion(_q).multiply(r.desfase);
      r.b.parent!.getWorldQuaternion(_q2).invert();
      r.b.quaternion.copy(_q2).multiply(_q);
      r.b.updateMatrixWorld(true);
    }
    // El sombrero además SALTA (la ráfaga lo levanta): se le pasa el desplazamiento de la
    // maqueta, girado al marco del hueso.
    if (this.huesoSombrero) {
      const s = this.m.j.sombrero;
      _a.copy(s.position).sub(this.base.sombrero.p);
      s.parent!.getWorldQuaternion(_q);
      this.huesoSombrero.parent!.getWorldQuaternion(_q2).invert();
      this.huesoSombrero.position.copy(this.sombreroReposo).add(_a.applyQuaternion(_q).applyQuaternion(_q2));
      this.huesoSombrero.updateMatrixWorld(true);
    }
  }

  /**
   * Al revés que `aplicarModelo`: mientras suena un clip del modelo (el baile), manda la
   * animación y es la MAQUETA la que copia al modelo. Así el atrezo que llevan las manos, los
   * colgantes y la mochila siguen el baile sin tocar una línea de las acciones.
   *
   * `k` cruza entre lo compuesto (IK y vida) y el clip, para entrar y salir sin salto.
   */
  private retargetInverso(k: number, pesos?: Map<THREE.Object3D, number>) {
    if (!this.hips) return;
    for (const r of this.retarget) {
      const kk = k * (pesos?.get(r.p) ?? 1);
      if (kk <= 0.001) continue;
      r.b.getWorldQuaternion(_q).multiply(_q3.copy(r.desfase).invert());
      r.p.parent!.getWorldQuaternion(_q2).invert();
      r.p.quaternion.slerp(_q2.multiply(_q), kk);
      r.p.updateMatrixWorld(true);
    }
    _a.copy(this.hips.position).sub(this.hipsReposo).add(this.caderaReposo);
    this.m.j.cadera.position.lerp(_a, k);
  }

  /**
   * Reproduce un clip del modelo de principio a fin. Devuelve cuando ha terminado de salir. Si el
   * modelo no trae ese clip, no hace nada y se resuelve en el acto.
   *
   * `veces` lo repite seguido: es la forma de alargar un baile sin ralentizarlo (a media
   * velocidad parecería cámara lenta). El de Meshy empalma bien consigo mismo — entre el último
   * fotograma y el primero hay 10,5° en el peor hueso—, así que la costura no se nota.
   */
  async reproducirClip(nombre: string, { entrada = 0.4, salida = 0.5, veces = 1 } = {}) {
    const clip = this.clips.get(nombre);
    if (!clip || !this.mixer) return;
    const accion = this.mixer.clipAction(clip);
    accion.reset().setLoop(veces > 1 ? THREE.LoopRepeat : THREE.LoopOnce, veces);
    accion.clampWhenFinished = true;
    accion.play();
    this.accionClip = accion;
    await this.motor.tw(entrada, curva.suave, (k) => (this.mezclaClip = k));
    await this.motor.espera(Math.max(0, clip.duration * veces - entrada - salida));
    await this.motor.tw(salida, curva.suave, (k) => (this.mezclaClip = 1 - k));
    this.mezclaClip = 0;
    accion.stop();
    this.accionClip = null;
  }

  get raiz() {
    return this.m.raiz;
  }

  // ── API para las acciones ─────────────────────────────────────────────────────────────

  /** Salta sin interpolar (para el estado inicial). */
  aplicarPose(pose: Pose) {
    for (const [n, c] of Object.entries(pose) as [Nodo, Partial<Canal>][]) {
      Object.assign(this.acc[n], c);
    }
  }

  /** Interpola hacia una pose. Lo que la pose no nombra, se queda como esté. */
  pose(pose: Pose, dur: number, c: Curva = curva.suave) {
    const tramos: { o: Canal; k: keyof Canal; de: number; a: number }[] = [];
    for (const [n, cs] of Object.entries(pose) as [Nodo, Partial<Canal>][]) {
      for (const k of Object.keys(cs) as (keyof Canal)[]) {
        tramos.push({ o: this.acc[n], k, de: this.acc[n][k], a: cs[k]! });
      }
    }
    return this.motor.tw(dur, c, (t) => {
      for (const s of tramos) s.o[s.k] = s.de + (s.a - s.de) * t;
    });
  }

  /** Vuelve al reposo: todo lo autorado a cero salvo lo que fija `POSE_REPOSO`. */
  volverReposo(dur: number, c: Curva = curva.asienta) {
    const objetivo: Pose = {};
    for (const n of Object.keys(this.acc) as Nodo[]) {
      const cero: Partial<Canal> = {};
      for (const k of CANALES) cero[k] = POSE_REPOSO[n]?.[k] ?? 0;
      objetivo[n] = cero;
    }
    return this.pose(objetivo, dur, c);
  }

  /** Lleva una mano a un punto. La mano llega por un arco (curva) y el codo busca `polo`. */
  alcanzar(lado: Lado, destino: THREE.Object3D, dur: number, c: Curva = curva.suave, polo?: [number, number, number]) {
    const st = this.ik[lado];
    // Lo que hubiera a medias se congela donde está: así un gesto puede cortar a otro.
    this.objetivoMano(lado, _a);
    st.fantasma.position.copy(this.m.j.pecho.worldToLocal(_a));
    st.a = st.fantasma;
    st.b = destino;
    st.mezcla = 0;
    const poloDe = st.polo.clone();
    const poloA = polo ? new THREE.Vector3(...polo) : poloDe;
    return this.motor.tw(dur, c, (k) => {
      st.mezcla = k;
      st.polo.lerpVectors(poloDe, poloA, k);
    }).then(() => {
      if (st.b === destino) {
        st.a = destino;
        st.b = null;
        st.mezcla = 0;
      }
    });
  }

  /** Pasa un objeto a la mano, conservando dónde estaba, y lo acomoda en la palma. */
  /**
   * `rot: null` y `pos: null` conservan la orientación y el sitio con los que ya estaba el objeto:
   * sirve para pasarlo de una mano a otra sin que gire ni se deslice de golpe (al girar 13 × 17 cm
   * en 0,15 s, la libreta barría el brazo).
   */
  agarrar(
    o: THREE.Object3D,
    lado: Lado,
    dur: number,
    rot: [number, number, number] | null = [0, 0, 0],
    pos: [number, number, number] | null = [0, -0.05, 0.02],
  ) {
    const mano = this.m.j[`mano${lado}`];
    return this.acomodar(o, mano, dur, pos, rot);
  }

  /** Deja un objeto en su sitio (una ranura), deslizándolo hasta encajar. */
  dejar(o: THREE.Object3D, ranura: THREE.Object3D, dur: number, pos: [number, number, number] = [0, 0, 0]) {
    return this.acomodar(o, ranura, dur, pos, [0, 0, 0]);
  }

  /**
   * Gira un objeto que ya se sostiene hasta que su orientación en el mundo coincida con la de
   * `referencia` (p. ej. la ranura donde se va a guardar). Así entra derecho y no gira al encajar,
   * que es cuando más estorba: con la mano a la espalda, el giro lo metía por el torso.
   */
  orientarComo(o: THREE.Object3D, referencia: THREE.Object3D, dur: number) {
    o.parent!.updateWorldMatrix(true, false);
    referencia.updateWorldMatrix(true, false);
    const q0 = o.quaternion.clone();
    const q1 = o.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(referencia.getWorldQuaternion(new THREE.Quaternion()));
    return this.motor.tw(dur, curva.suave, (k) => o.quaternion.slerpQuaternions(q0, q1, k));
  }

  private acomodar(o: THREE.Object3D, destino: THREE.Object3D, dur: number, pos: [number, number, number] | null, rot: [number, number, number] | null) {
    destino.updateWorldMatrix(true, false);
    o.updateWorldMatrix(true, false);
    destino.attach(o);
    const p0 = o.position.clone();
    const q0 = o.quaternion.clone();
    const p1 = pos ? new THREE.Vector3(...pos) : p0.clone();
    const q1 = rot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)) : q0.clone();
    return this.motor.tw(dur, curva.suave, (k) => {
      o.position.lerpVectors(p0, p1, k);
      o.quaternion.slerpQuaternions(q0, q1, k);
    });
  }

  expresion(e: Expresion, dur = 0.25) {
    const objetivo = {
      neutra: { neutra: 1, sonrisa: 0, o: 0, mejillas: 0 },
      sonrisa: { neutra: 0, sonrisa: 1, o: 0, mejillas: 0 },
      o: { neutra: 0, sonrisa: 0, o: 1, mejillas: 0 },
      soplar: { neutra: 0, sonrisa: 0, o: 0.7, mejillas: 1 },
    }[e];
    const de = { ...this.boca };
    return this.motor.tw(dur, curva.suave, (k) => {
      for (const key of Object.keys(objetivo) as (keyof typeof objetivo)[]) {
        this.boca[key] = de[key] + (objetivo[key] - de[key]) * k;
      }
    });
  }

  parpadear() {
    this.parpadeo = 0;
  }

  /** Una ráfaga: empuja la tela, la hincha y la hace ceder. `dir` = +1 viene de la izquierda. */
  rafaga(fuerza: number, dir: 1 | -1 = 1) {
    this.tela.mz.empujar(-2.4 * fuerza * dir);
    this.tela.mx.empujar(1.4 * fuerza);
    this.telaHinchado.empujar(-3.2 * fuerza);
    this.viento = fuerza * dir;
    this.colgante.silbato.empujar(0.6 * fuerza, -2 * fuerza * dir);
    this.colgante.gafas.empujar(0.3 * fuerza, -1.5 * fuerza * dir);
  }

  /** Suelta un colgante con un impulso: cae y se balancea de su cordón o su gancho. */
  empujarColgante(cual: "silbato" | "gafas" | "pulverizador", ix: number, iz: number) {
    this.colgante[cual].empujar(ix, iz);
  }

  gotas(origen: THREE.Object3D, hacia: THREE.Object3D, n = 10) {
    origen.getWorldPosition(_a);
    hacia.getWorldPosition(_b);
    this.m.raiz.worldToLocal(_a);
    this.m.raiz.worldToLocal(_b);
    const dir = _b.sub(_a).normalize();
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(azar(0.9, 1.5));
      v.x += azar(-0.25, 0.25);
      v.y += azar(-0.15, 0.25);
      this.soltarParticula(this.matGota, _a, v, azar(0.35, 0.6), 1.2);
    }
  }

  migas(origen: THREE.Object3D, n = 7) {
    origen.getWorldPosition(_a);
    this.m.raiz.worldToLocal(_a);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(azar(-0.35, 0.35), azar(0.1, 0.5), azar(0, 0.35));
      this.soltarParticula(this.matMiga, _a, v, azar(0.8, 1.2), 5);
    }
  }

  private soltarParticula(mat: THREE.Material, p: THREE.Vector3, v: THREE.Vector3, vida: number, gravedad: number) {
    const malla = new THREE.Mesh(this.geoParticula, mat);
    malla.position.copy(p);
    malla.scale.setScalar(azar(0.6, 1.3));
    this.m.raiz.add(malla);
    this.particulas.push({ malla, v, vida, gravedad });
  }

  // ── Fotograma ─────────────────────────────────────────────────────────────────────────

  /**
   * @param dt  segundos desde el fotograma anterior (ya acotados por la escena)
   * @param desplazamientoX  cuánto se ha movido el lienzo en este fotograma, en unidades
   */
  actualizar(dt: number, desplazamientoX = 0) {
    this.t += dt;
    this.desplX += desplazamientoX;
    this.motor.actualizar(dt);

    for (const n in this.proc) {
      const c = this.proc[n as Nodo];
      for (const k of CANALES) c[k] = 0;
    }
    const P = this.proc;
    const andar = this.pesoAndar.paso(Math.abs(this.velocidad) > 0.02 ? 1 : 0, 0.16, dt);
    const quieto = 1 - andar;

    // Respirar: el pecho se llena más en profundidad que en anchura; los hombros acompañan.
    const r = Math.sin((this.t / 3.8) * Math.PI * 2);
    P.formaPecho.sy += 0.012 * r;
    P.formaPecho.sz += 0.02 * r;
    P.formaPecho.sx += 0.006 * r;
    P.hombroI.py += 0.005 * r;
    P.hombroD.py += 0.005 * r;
    P.cabeza.rx -= 0.012 * r;

    // Cambiar el peso de pierna (contrapposto): la cadera se va a un lado y el otro lado cae,
    // así la rodilla libre se dobla sola por la IK. El tronco compensa hacia el otro lado.
    if (this.t > this.proximoPeso) {
      this.ladoPeso = -this.ladoPeso;
      this.proximoPeso = this.t + azar(4, 9);
    }
    const w = this.pesoLateral.paso(this.ladoPeso * quieto, 0.9, dt);
    P.cadera.px += 0.026 * w;
    P.cadera.rz += 0.05 * w;
    P.columna.rz -= 0.035 * w;
    P.pecho.rz -= 0.02 * w;
    P.cabeza.rz += 0.025 * w;

    // Andar: la fase avanza con la velocidad REAL, y la zancada sale de ella → sin patinar.
    // El ciclo se acorta con piernas más cortas (el modelo las tiene de 0,61 m; la maqueta, 0,82).
    const T = 0.96 * Math.sqrt((this.m.pierna.muslo + this.m.pierna.tibia) / 0.82);
    const beta = 0.6;
    if (andar > 0.001) this.fase = (this.fase + dt / T) % 1;
    const zancada = Math.abs(this.velocidad) * beta * T;
    const f = this.fase * Math.PI * 2;
    P.cadera.py += (-0.022 + 0.012 * Math.cos(2 * (f - 0.3 * Math.PI * 2))) * andar;
    P.cadera.ry += -0.1 * Math.cos(f) * andar;
    P.cadera.rz += 0.04 * Math.sin(f - 0.3) * andar;
    P.pecho.ry += 0.12 * Math.cos(f) * andar;
    P.pecho.rx += 0.05 * andar;
    P.cabeza.rx -= 0.03 * andar;

    // Mirar: los ojos llegan primero, la cabeza después y el tronco un poco — todo el cuerpo.
    let yaw = this.miradaLibre.yaw;
    let pitch = this.miradaLibre.pitch;
    if (this.foco) {
      this.m.j.cabeza.getWorldPosition(_a);
      this.foco.getWorldPosition(_b);
      _b.sub(_a);
      this.m.raiz.getWorldQuaternion(_q).invert();
      _b.applyQuaternion(_q);
      yaw = Math.atan2(_b.x, _b.z);
      pitch = Math.atan2(-_b.y, Math.hypot(_b.x, _b.z));
    }
    yaw = limitar(yaw, -1.1, 1.1) * (1 - andar * 0.8);
    pitch = limitar(pitch, -0.5, 0.75);
    // La cabeza compensa lo que ya giran o inclinan la columna y el pecho: quien se inclina a
    // ofrecer algo sigue mirándote, no al suelo.
    const A = this.acc;
    yaw -= A.columna.ry + A.pecho.ry;
    pitch -= (A.columna.rx + A.pecho.rx) * 0.85;
    const cy = this.cabezaYaw.paso(yaw, 0.26, dt);
    const cp = this.cabezaPitch.paso(pitch, 0.26, dt);
    const oy = this.ojosYaw.paso(yaw, 0.05, dt);
    const op = this.ojosPitch.paso(pitch, 0.05, dt);
    P.cabeza.ry += cy * 0.6;
    P.cuello.ry += cy * 0.25;
    P.pecho.ry += cy * 0.1;
    P.columna.ry += cy * 0.05;
    P.cabeza.rx += cp * 0.6;
    P.cuello.rx += cp * 0.3;
    P.pecho.rx += cp * 0.07;
    const px = limitar((oy - cy) * 0.025 + oy * 0.004, -0.0085, 0.0085);
    const py = limitar(-(op - cp) * 0.02 - op * 0.004, -0.007, 0.007);
    this.m.cara.pupilaI.position.set(px, py, 0.01);
    this.m.cara.pupilaD.position.set(px, py, 0.01);

    // Parpadear: rápido al cerrar, más lento al abrir. A veces, dos seguidos.
    if (this.parpadeo < 0 && this.t > this.proximoParpadeo) {
      this.parpadeo = 0;
      this.proximoParpadeo = this.t + (Math.random() < 0.2 ? 0.28 : azar(2.2, 5.5));
    }
    let cierre = 0;
    if (this.parpadeo >= 0) {
      this.parpadeo += dt;
      const b = this.parpadeo;
      cierre = b < 0.06 ? b / 0.06 : b < 0.1 ? 1 : Math.max(0, 1 - (b - 0.1) / 0.11);
      if (b > 0.21) this.parpadeo = -1;
    }
    P.parpadoI.rx += cierre * this.cierreParpado;
    P.parpadoD.rx += cierre * this.cierreParpado;

    // Componer: reposo + autoría + vida.
    for (const n of Object.keys(this.nodos) as Nodo[]) {
      const o = this.nodos[n];
      const b = this.base[n];
      const a = this.acc[n];
      const p = P[n];
      o.position.set(b.p.x + a.px + p.px, b.p.y + a.py + p.py, b.p.z + a.pz + p.pz);
      o.rotation.set(b.r.x + a.rx + p.rx, b.r.y + a.ry + p.ry, b.r.z + a.rz + p.rz);
      o.scale.set(b.s.x * (1 + a.sx + p.sx), b.s.y * (1 + a.sy + p.sy), b.s.z * (1 + a.sz + p.sz));
    }
    const { cara } = this.m;
    cara.bocaNeutra.scale.setScalar(Math.max(0.001, this.boca.neutra));
    cara.bocaSonrisa.scale.setScalar(Math.max(0.001, this.boca.sonrisa));
    cara.bocaO.scale.setScalar(Math.max(0.001, this.boca.o));
    cara.mejillaI.scale.setScalar(Math.max(0.001, this.boca.mejillas));
    cara.mejillaD.scale.setScalar(Math.max(0.001, this.boca.mejillas));

    this.m.raiz.rotation.y = this.orientacion.paso(this.orientacionObjetivo, 0.24, dt);
    this.m.raiz.updateMatrixWorld(true);

    // Clip del modelo (baile): manda él, y la maqueta lo copia. La IK se aparta.
    // El ritmo del clip de andar se ata a la velocidad real (si no, los pies patinan). Se le
    // deja un mínimo para que siga ciclando mientras arranca y mientras frena.
    if (this.accionAndar) {
      this.accionAndar.timeScale = Math.max(0.35, Math.abs(this.velocidad) / this.velocidadClipAndar);
      this.accionAndar.setEffectiveWeight(this.enClip ? 0 : 1);
    }
    if (this.mixer && (this.accionClip || this.accionAndar)) this.mixer.update(dt);
    if (this.enClip) {
      this.m.raiz.updateMatrixWorld(true);
      this.retargetInverso(this.mezclaClip);
      this.m.raiz.updateMatrixWorld(true);
      this.aplicarModelo();
      this.aplicarColgantes(dt);
      this.sombra();
      return;
    }

    // Pies: en reposo, clavados bajo la cadera; andando, planta atrás y vuelo adelante.
    const tobillo = this.m.pierna.alturaTobillo;
    for (const lado of ["I", "D"] as Lado[]) {
      const s = lado === "I" ? 1 : -1;
      const relajado = quieto * Math.max(0, -w * s);
      let z = 0.03 * relajado;
      let y = tobillo;
      let incl = 0;
      if (andar > 0.001) {
        const u = (this.fase + (lado === "I" ? 0 : 0.5)) % 1;
        if (u < beta) {
          const k = u / beta;
          z += (zancada / 2 - zancada * k) * andar;
          const talon = k > 0.72 ? (k - 0.72) / 0.28 : 0;
          incl += 0.45 * talon * andar;
          y += 0.035 * talon * andar;
        } else {
          const k = (u - beta) / (1 - beta);
          const ke = curva.suave(k);
          z += (-zancada / 2 + zancada * ke) * andar;
          y += 0.075 * Math.sin(Math.PI * k) * andar * Math.min(1, zancada * 4);
          incl += (-0.3 * Math.sin(Math.PI * k) - 0.12 * k) * andar;
        }
      }
      incl += 0.12 * relajado;
      _c.set(this.m.pierna.pieX * s, y, z + this.m.pierna.pieZ);
      this.piernaIK(lado, _c, incl);
    }

    // Manos. Si el destino de una mano cuelga de la OTRA (escribir en la libreta que sostiene la
    // izquierda), primero se resuelve la que sostiene. Al revés, la derecha apuntaba a donde estaba
    // la libreta con el brazo izquierdo aún en reposo, colgando: medido, la mano del lápiz se
    // quedaba a la altura de la cadera, 40 cm por debajo de la hoja, y el lápiz atravesaba el cuerpo.
    this.m.raiz.updateMatrixWorld(true);
    if (this.cuelgaDeLaOtra("D")) {
      this.brazoIK("I");
      this.m.raiz.updateMatrixWorld(true);
      // Y el paraguas, que va en esa mano, se endereza YA: la corredera está a 55 cm por la
      // varilla, y apuntar a ella con la orientación del fotograma anterior dejaba la mano derecha
      // a medio metro de la varilla al cerrarlo o abrirlo (medido: hasta 53 cm, 69 con el orden nuevo).
      this.orientarParaguas(andar);
      this.brazoIK("D");
    } else {
      this.brazoIK("D");
      this.m.raiz.updateMatrixWorld(true);
      this.brazoIK("I");
    }
    this.m.raiz.updateMatrixWorld(true);

    // Andar: si el modelo trae su propio clip, se cruza con lo compuesto. `andar` ya viene
    // suavizado, así que sirve de peso: 0 = de pie (IK), 1 = el clip de Meshy.
    if (this.accionAndar && andar > 0.001) {
      // El brazo que lleva el paraguas: CERRADO bracea con el clip, como un bastón; ABIERTO no
      // lo sigue nada. Medido: con el braceo la copa bajaba de 13,5 cm por encima del sombrero a
      // 9 cm por DEBAJO, y lo atravesaba. Sin él, la copa solo acompaña el vaivén del pecho.
      const pesoBrazo = this.paraguasCerrado ? 0.45 : 0;
      for (const n of ["brazoI", "codoI", "manoI"] as Articulacion[]) this.pesoAndarHueso.set(this.m.j[n], pesoBrazo);
      this.m.raiz.updateMatrixWorld(true);
      this.retargetInverso(andar, this.pesoAndarHueso);
    }
    this.aplicarColgantes(dt, andar);
    this.aplicarModelo();
    this.sombra(andar);
  }

  /** Paraguas, inercia de lo que cuelga y partículas. Corren también durante un clip. */
  /** El paraguas se sostiene derecho respecto al cuerpo, lo mueva como lo mueva la muñeca. */
  private orientarParaguas(andar: number) {
    const par = this.m.obj.paraguas;
    const ap = this.acc.paraguas;
    par.parent!.getWorldQuaternion(_q).invert();
    this.m.raiz.getWorldQuaternion(_q2);
    _q3.setFromEuler(_eu.set(ap.rx - 0.03 * andar, ap.ry, ap.rz - this.viento * 0.05));
    if (this.paraguasGiro > 0) _q3.slerp(_q4.setFromEuler(EULER_BASTON), this.paraguasGiro);
    par.quaternion.copy(_q).multiply(_q2).multiply(_q3);
    par.updateMatrixWorld(true);
  }

  private aplicarColgantes(dt: number, andar = 0) {
    this.orientarParaguas(andar);

    for (const cg of this.colgantes) cg.paso(dt, this.desplX);
    this.mochila.paso(dt, this.desplX, this.base.mochila.r, this.base.mochila.p.y);
    this.tela.paso(dt, this.desplX, EULER_CERO, 0.82);
    const h = this.telaHinchado.paso(dt, 0);
    // Plegada, la tela se estrecha contra la varilla y se alarga hacia el puño (la punta del
    // cono queda arriba, en la contera): así es un paraguas cerrado. Y ya no ondea.
    const cz = this.paraguasCierre;
    const tela = this.m.obj.tela;
    tela.rotation.x *= 1 - cz;
    tela.rotation.z *= 1 - cz;
    const ancho = (1 - h * 0.35) * (1 - 0.91 * Math.min(1, cz * 1.15));
    tela.scale.set(ancho, (1 + h * (1 - cz)) * (1 + 2.3 * cz), ancho);
    this.viento *= Math.exp(-dt * 2.2);

    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const q = this.particulas[i];
      q.vida -= dt;
      q.v.y -= q.gravedad * dt;
      q.malla.position.addScaledVector(q.v, dt);
      if (q.malla.position.y < 0.005) {
        q.malla.position.y = 0.005;
        q.v.multiplyScalar(0.3);
      }
      q.malla.scale.multiplyScalar(q.vida < 0.2 ? 0.85 : 1);
      if (q.vida <= 0) {
        this.m.raiz.remove(q.malla);
        this.particulas.splice(i, 1);
      }
    }
  }

  /** Sombra de contacto: más ancha al andar, más débil si la cadera sube. */
  private sombra(andar = 0) {
    const alto = this.m.j.cadera.position.y;
    const sm = this.m.sombra;
    sm.scale.set(1 + 0.25 * andar, 1 + 0.35 * andar, 1);
    (sm.material as THREE.MeshBasicMaterial).opacity = limitar(1 - (alto - 0.9) * 4, 0.5, 1);
  }

  /** Dónde está ahora mismo el objetivo de una mano (en mundo). */
  private objetivoMano(lado: Lado, out: THREE.Vector3) {
    const st = this.ik[lado];
    st.a.getWorldPosition(out);
    if (st.b) {
      st.b.getWorldPosition(_e);
      out.lerp(_e, st.mezcla);
    }
    return out;
  }

  private piernaIK(lado: Lado, objetivo: THREE.Vector3, inclinacion: number) {
    const { j, pierna } = this.m;
    const cad = j.cadera;
    const muslo = j[`pierna${lado}`];
    const rod = j[`rodilla${lado}`];
    const tob = j[`tobillo${lado}`];
    cad.updateMatrix();
    _a.copy(muslo.position).applyMatrix4(cad.matrix);
    _d.subVectors(objetivo, _a).applyQuaternion(_q.copy(cad.quaternion).invert());
    const L1 = pierna.muslo;
    const L2 = pierna.tibia;
    const D = limitar(_d.length(), 0.05, L1 + L2 - 0.002);
    const flex = Math.PI - Math.acos(limitar((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    const alfa = Math.acos(limitar((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    const cabeceo = Math.atan2(_d.z, -_d.y);
    const alabeo = Math.atan2(_d.x, Math.hypot(_d.y, _d.z));
    const mx = -(cabeceo + alfa);
    muslo.rotation.set(mx, 0, alabeo);
    rod.rotation.set(flex, 0, 0);
    tob.rotation.set(inclinacion - (cad.rotation.x + mx + flex), -cad.rotation.y, -(cad.rotation.z + alabeo));
  }

  /** ¿El destino de esta mano (de dónde viene o adónde va) cuelga de `mano`? */
  private destinoCuelgaDe(lado: Lado, mano: THREE.Object3D) {
    const st = this.ik[lado];
    for (const o of [st.a, st.b]) {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === mano) return true;
    }
    return false;
  }

  private cuelgaDeLaOtra(lado: Lado) {
    return this.destinoCuelgaDe(lado, this.m.j[lado === "D" ? "manoI" : "manoD"]);
  }

  private brazoIK(lado: Lado) {
    const st = this.ik[lado];
    if (st.peso <= 0.001) return;
    const { j } = this.m;
    const hombro = j[`hombro${lado}`];
    const brazo = j[`brazo${lado}`];
    const codo = j[`codo${lado}`];
    // Un destino que cuelga de la PROPIA mano (la ranura del lápiz, en la libreta que esa mano
    // acaba de coger) se mueve con ella: perseguirlo hace que el brazo se escurra fotograma a
    // fotograma (medido: hasta la cadera). Saltarse la IK tampoco vale: cada fotograma parte del
    // reposo y el brazo caería colgando. Mientras dure, la mano se queda en su último destino.
    if (this.destinoCuelgaDe(lado, j[`mano${lado}`]) && st.ultimo) {
      _a.copy(st.ultimo);
      j.pecho.localToWorld(_a);
    } else {
      this.objetivoMano(lado, _a);
      st.ultimo = j.pecho.worldToLocal((st.ultimo ?? new THREE.Vector3()).copy(_a));
    }
    hombro.worldToLocal(_a);
    const L1 = this.m.brazo.brazo;
    const L2 = this.m.brazo.antebrazo + 0.035; // hasta el centro de la palma, no la muñeca
    const dist = _a.length() || 1;
    const D = limitar(dist, 0.08, L1 + L2 - 0.002);
    _b.copy(_a).divideScalar(dist); // dirección
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _c.copy(st.polo);
    _c.addScaledVector(_b, -_c.dot(_b)).normalize();
    _d.copy(_b).multiplyScalar(a).addScaledVector(_c, h); // codo
    _q.setFromUnitVectors(ABAJO, _e.copy(_d).normalize());
    _e.copy(_b).multiplyScalar(D).sub(_d).applyQuaternion(_q2.copy(_q).invert()).normalize();
    _q2.setFromUnitVectors(ABAJO, _e);
    brazo.quaternion.slerp(_q, st.peso);
    codo.quaternion.slerp(_q2, st.peso);
  }

  liberar() {
    for (const q of this.particulas) this.m.raiz.remove(q.malla);
    this.geoParticula.dispose();
    this.matGota.dispose();
    this.matMiga.dispose();
    for (const e of this.extras) e.dispose();
    this.m.liberar();
  }
}
