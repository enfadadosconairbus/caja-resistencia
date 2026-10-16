import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * MAQUETA PROVISIONAL del huelguista, construida con primitivas.
 *
 * Existe para que el comportamiento (cerebro, bordes, muelles, controles) se pueda construir y
 * probar en la web mientras el modelo de verdad se produce — ver `clientes/caja-resistencia/
 * huelguista/BRIEF-3D.md`. Es un muñeco de piezas rígidas con esferas en las articulaciones: NO
 * tiene la piel continua ni las formas correctivas del modelo final, y no pretende parecerlo.
 *
 * Lo que SÍ fija, y el modelo final hereda:
 * - los NOMBRES de las articulaciones (el glTF usará los mismos huesos),
 * - las RANURAS donde viven los objetos (mochila, cinturón, cuello, cara),
 * - la paleta intensificada (29-sep-2026, decisión de la coordinación: "colores algo más intensos").
 *
 * Convenio: mira hacia +z (la cámara), +y arriba, 1 unidad ≈ 1 metro. "I" y "D" son la
 * izquierda y la derecha DEL PERSONAJE: su izquierda cae a la derecha de la pantalla (+x).
 */

export const COLORES = {
  piel: "#EDB48F",
  pelo: "#7A3E1C",
  sombrero: "#E3A21A",
  sombreroCinta: "#C27F0B",
  camiseta: "#CFE7F0",
  pantalon: "#3D86B6",
  pantalonDobladillo: "#2F6F9C",
  calcetin: "#F3ECDD",
  zapato: "#E8432B",
  suela: "#F4EFE6",
  suelaCanto: "#2E4A40",
  mochila: "#3E6F6C",
  tirante: "#4B7D89",
  paraguasTela: "#8FC3DB",
  paraguasVarilla: "#6F98AA",
  silbato: "#E4442B",
  cordon: "#2A2622",
  gafas: "#35261A",
  pan: "#C8732C",
  panCorte: "#EDC58B",
  crema: "#F5EEDC",
  cremaTapon: "#E7A726",
  pulverizador: "#CFE6E7",
  ojo: "#FBF8F2",
  pupila: "#2B1C12",
  boca: "#7A3A2C",
  libreta: "#D9442E",
  libretaHojas: "#FAF6EC",
  libretaEspiral: "#5C5C5C",
  lapiz: "#F2C230",
  lapizMadera: "#E9C9A0",
  lapizMina: "#3A3A3A",
  lapizGoma: "#E58BA0",
} as const;

export type Articulacion =
  | "cadera"
  | "piernaI"
  | "rodillaI"
  | "tobilloI"
  | "piernaD"
  | "rodillaD"
  | "tobilloD"
  | "columna"
  | "pecho"
  | "cuello"
  | "cabeza"
  | "hombroI"
  | "brazoI"
  | "codoI"
  | "manoI"
  | "hombroD"
  | "brazoD"
  | "codoD"
  | "manoD"
  | "mochila"
  | "sombrero"
  | "cejaI"
  | "cejaD"
  | "parpadoI"
  | "parpadoD";

export type Maqueta = {
  raiz: THREE.Group;
  j: Record<Articulacion, THREE.Object3D>;
  /** Objetos que cambian de mano: se re-emparentan con `attach` conservando su posición. */
  obj: {
    paraguas: THREE.Group;
    tela: THREE.Group;
    pan: THREE.Group;
    panA: THREE.Group;
    panB: THREE.Group;
    crema: THREE.Group;
    pulverizador: THREE.Group;
    silbato: THREE.Group;
    gafas: THREE.Group;
    /** La libreta del buzón de sugerencias y su lápiz, que va enganchado a ella. */
    libreta: THREE.Group;
    lapiz: THREE.Group;
  };
  /** Péndulos: cuelgan y los mueve la inercia, no la animación. */
  pendulo: {
    silbato: THREE.Group;
    gafas: THREE.Group;
    pulverizador: THREE.Group;
  };
  /** Dónde vive cada objeto cuando nadie lo sostiene. */
  ranura: {
    pan: THREE.Object3D;
    crema: THREE.Object3D;
    pulverizador: THREE.Object3D;
    silbato: THREE.Object3D;
    gafasCuello: THREE.Object3D;
    gafasCara: THREE.Object3D;
    boca: THREE.Object3D;
    libreta: THREE.Object3D;
    /** Dónde va el lápiz cuando no escribe: en el canto de la libreta. */
    lapiz: THREE.Object3D;
    /** Un punto sobre la hoja: la mano del lápiz va ahí, y se mueve para escribir. */
    escribir: THREE.Object3D;
  };
  cara: {
    /** Toda la cara (ojos, cejas, boca, mejillas). Es geometría NUESTRA: nunca se oculta. */
    grupo: THREE.Object3D;
    ojoI: THREE.Object3D;
    ojoD: THREE.Object3D;
    pupilaI: THREE.Object3D;
    pupilaD: THREE.Object3D;
    bocaNeutra: THREE.Object3D;
    bocaSonrisa: THREE.Object3D;
    bocaO: THREE.Object3D;
    mejillaI: THREE.Object3D;
    mejillaD: THREE.Object3D;
  };
  /** Mallas del tronco que respiran y se aplastan (ver el comentario de `formaVientre`). */
  forma: { vientre: THREE.Object3D; pecho: THREE.Object3D };
  sombra: THREE.Mesh;
  /** Volúmenes para el raycast del clic (el silbato es diminuto: su diana es más grande). */
  diana: { silbato: THREE.Object3D };
  /** Medidas de pierna para la IK de apoyo. */
  pierna: { muslo: number; tibia: number; alturaTobillo: number; pieZ: number; pieX: number };
  /** Medidas de brazo para la IK de las manos (L2 llega hasta el centro de la palma). */
  brazo: { brazo: number; antebrazo: number };
  /**
   * Mallas del CUERPO de la maqueta (no el atrezo). Con el modelo de verdad se ocultan: la
   * maqueta queda como esqueleto invisible que anima al modelo, y el atrezo sigue a la vista.
   */
  mallasCuerpo: THREE.Object3D[];
  liberar: () => void;
};

/**
 * Dónde está cada articulación (en metros, respecto a su padre, con todo en reposo y los
 * miembros colgando hacia -y). Las de la maqueta son las de por defecto; con el modelo de Meshy
 * se sacan de su esqueleto (`proporcionesDesdeModelo` en `cuerpo.ts`) para que la IK ponga
 * manos y pies donde el modelo los tiene de verdad.
 */
export type Proporciones = {
  cadera: [number, number, number];
  pierna: [number, number, number]; // la izquierda; la derecha es su espejo en x
  muslo: number;
  tibia: number;
  alturaTobillo: number;
  pieZ: number;
  columna: [number, number, number];
  pecho: [number, number, number];
  cuello: [number, number, number];
  cabeza: [number, number, number];
  hombro: [number, number, number]; // el izquierdo
  brazo: number;
  antebrazo: number;
};

export const PROPORCIONES_MAQUETA: Proporciones = {
  cadera: [0, 0.92, 0],
  pierna: [0.095, -0.04, 0],
  muslo: 0.44,
  tibia: 0.38,
  alturaTobillo: 0.06,
  pieZ: 0,
  columna: [0, 0.06, 0],
  pecho: [0, 0.24, 0],
  cuello: [0, 0.19, 0],
  cabeza: [0, 0.07, 0],
  hombro: [0.2, 0.13, 0],
  brazo: 0.25,
  antebrazo: 0.225,
};

export function construirMaqueta(P: Proporciones = PROPORCIONES_MAQUETA): Maqueta {
  const geos: THREE.BufferGeometry[] = [];
  const mats = new Map<string, THREE.Material>();

  const mat = (color: string, opciones: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const clave = color + JSON.stringify(opciones);
    let m = mats.get(clave);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...opciones });
      mats.set(clave, m);
    }
    return m;
  };
  const g = <T extends THREE.BufferGeometry>(geo: T) => {
    geos.push(geo);
    return geo;
  };
  const malla = (
    padre: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    p: [number, number, number] = [0, 0, 0],
    r: [number, number, number] = [0, 0, 0],
    e: [number, number, number] = [1, 1, 1],
  ) => {
    const m = new THREE.Mesh(g(geo), material);
    m.position.set(...p);
    m.rotation.set(...r);
    m.scale.set(...e);
    padre.add(m);
    return m;
  };
  const nodo = (padre: THREE.Object3D, nombre: string, p: [number, number, number] = [0, 0, 0]) => {
    const o = new THREE.Group();
    o.name = nombre;
    o.position.set(...p);
    padre.add(o);
    return o;
  };

  const raiz = new THREE.Group();
  raiz.name = "raiz";

  // ── Piernas ─────────────────────────────────────────────────────────────────────────────
  const MUSLO = P.muslo;
  const TIBIA = P.tibia;
  const ALTURA_TOBILLO = P.alturaTobillo;
  const cadera = nodo(raiz, "cadera", P.cadera);
  malla(cadera, new THREE.CylinderGeometry(0.172, 0.19, 0.2, 24), mat(COLORES.pantalon), [0, -0.02, 0], [0, 0, 0], [1, 1, 0.82]);

  const pierna = (lado: 1 | -1) => {
    const s = lado === 1 ? "I" : "D";
    const cad = nodo(cadera, `pierna${s}`, [P.pierna[0] * lado, P.pierna[1], P.pierna[2]]);
    malla(cad, new THREE.CylinderGeometry(0.092, 0.1, 0.27, 18), mat(COLORES.pantalon), [0.004 * lado, -0.12, 0]);
    malla(cad, new THREE.TorusGeometry(0.098, 0.018, 8, 20), mat(COLORES.pantalonDobladillo), [0.004 * lado, -0.255, 0], [Math.PI / 2, 0, 0]);
    malla(cad, new THREE.CylinderGeometry(0.046, 0.043, 0.2, 12), mat(COLORES.piel), [0, -0.34, 0]);
    const rod = nodo(cad, `rodilla${s}`, [0, -MUSLO, 0]);
    malla(rod, new THREE.SphereGeometry(0.045, 14, 10), mat(COLORES.piel));
    malla(rod, new THREE.CylinderGeometry(0.044, 0.036, 0.3, 12), mat(COLORES.piel), [0, -0.15, 0]);
    malla(rod, new THREE.CylinderGeometry(0.048, 0.046, 0.08, 12), mat(COLORES.calcetin), [0, -0.33, 0]);
    const tob = nodo(rod, `tobillo${s}`, [0, -TIBIA, 0]);
    malla(tob, g(new RoundedBoxGeometry(0.13, 0.09, 0.23, 3, 0.04)), mat(COLORES.zapato), [0, -0.005, 0.045]);
    malla(tob, g(new RoundedBoxGeometry(0.145, 0.032, 0.25, 2, 0.014)), mat(COLORES.suela), [0, -0.045, 0.045]);
    malla(tob, g(new RoundedBoxGeometry(0.147, 0.01, 0.252, 1, 0.004)), mat(COLORES.suelaCanto), [0, -0.058, 0.045]);
    malla(tob, new THREE.SphereGeometry(0.02, 8, 6), mat(COLORES.sombrero), [0, 0.035, 0.07], [0, 0, 0], [1.3, 0.5, 1]);
    return { cad, rod, tob };
  };
  const pI = pierna(1);
  const pD = pierna(-1);

  // ── Tronco ──────────────────────────────────────────────────────────────────────────────
  // Las mallas del tronco van en grupos "forma" aparte de las articulaciones: así la
  // respiración y el aplastamiento escalan la tela, no la cabeza ni los brazos que cuelgan.
  const columna = nodo(cadera, "columna", P.columna);
  const formaVientre = nodo(columna, "formaVientre", [0, 0.02, 0]);
  malla(formaVientre, new THREE.CapsuleGeometry(0.175, 0.14, 6, 20), mat(COLORES.camiseta), [0, 0.08, 0], [0, 0, 0], [1, 1, 0.84]);
  // El bajo de la camiseta cae POR ENCIMA de la cintura: sin él, las dos superficies casi
  // coinciden y la costura parpadea en dientes de sierra.
  malla(formaVientre, new THREE.CylinderGeometry(0.18, 0.194, 0.15, 24), mat(COLORES.camiseta), [0, 0.035, 0], [0, 0, 0], [1, 1, 0.85]);
  const pecho = nodo(columna, "pecho", P.pecho);
  const formaPecho = nodo(pecho, "formaPecho", [0, -0.06, 0]);
  malla(formaPecho, new THREE.CapsuleGeometry(0.19, 0.1, 6, 20), mat(COLORES.camiseta), [0, 0.1, 0], [0, 0, 0], [1, 1, 0.8]);
  for (const lado of [1, -1]) {
    malla(formaPecho, g(new RoundedBoxGeometry(0.038, 0.36, 0.02, 2, 0.008)), mat(COLORES.tirante), [0.11 * lado, 0.09, 0.148], [0.12, 0, 0.04 * lado]);
    malla(formaPecho, g(new RoundedBoxGeometry(0.045, 0.03, 0.03, 2, 0.008)), mat(COLORES.tirante), [0.108 * lado, -0.08, 0.15]);
  }
  malla(pecho, new THREE.TorusGeometry(0.058, 0.013, 8, 20), mat(COLORES.camiseta), [0, 0.19, 0.005], [Math.PI / 2, 0, 0]);

  // Mochila: cuelga del pecho con muelle (la mueve `cuerpo.ts`, no la animación). El pivote
  // está ARRIBA, donde los tirantes la sujetan: lo que oscila es el fondo, como en una de verdad.
  const mochila = nodo(pecho, "mochila", [0, 0.2, -0.19]);
  malla(mochila, g(new RoundedBoxGeometry(0.36, 0.42, 0.18, 4, 0.06)), mat(COLORES.mochila), [0, -0.2, -0.04]);
  malla(mochila, g(new RoundedBoxGeometry(0.26, 0.18, 0.06, 3, 0.03)), mat(COLORES.tirante), [0, -0.29, -0.14]);
  malla(mochila, new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI), mat(COLORES.tirante), [0, 0.01, -0.04]);
  // El pan asoma por arriba y la crema va en el bolsillo lateral, los dos del lado DERECHO del
  // personaje (izquierda de la pantalla), como en la ilustración: los alcanza la mano libre.
  const ranuraPan = nodo(mochila, "ranuraPan", [-0.1, 0.06, -0.02]);
  ranuraPan.rotation.set(0.1, 0, 0.22);
  const ranuraCrema = nodo(mochila, "ranuraCrema", [-0.2, -0.14, -0.02]);
  // La libreta del buzón asoma por arriba, detrás del pan.
  const ranuraLibreta = nodo(mochila, "ranuraLibreta", [0.04, -0.02, -0.075]);
  ranuraLibreta.rotation.set(0, 0, -0.1);

  // ── Brazos ──────────────────────────────────────────────────────────────────────────────
  const brazo = (lado: 1 | -1) => {
    const s = lado === 1 ? "I" : "D";
    const hombro = nodo(pecho, `hombro${s}`, [P.hombro[0] * lado, P.hombro[1], P.hombro[2]]);
    malla(hombro, new THREE.SphereGeometry(0.075, 16, 12), mat(COLORES.camiseta));
    const br = nodo(hombro, `brazo${s}`);
    malla(br, new THREE.CylinderGeometry(0.074, 0.066, 0.15, 16), mat(COLORES.camiseta), [0, -0.06, 0]);
    malla(br, new THREE.CylinderGeometry(0.039, 0.036, 0.2, 12), mat(COLORES.piel), [0, -0.15, 0]);
    const codo = nodo(br, `codo${s}`, [0, -P.brazo, 0]);
    malla(codo, new THREE.SphereGeometry(0.037, 12, 10), mat(COLORES.piel));
    malla(codo, new THREE.CylinderGeometry(0.036, 0.031, 0.22, 12), mat(COLORES.piel), [0, -0.11, 0]);
    const mano = nodo(codo, `mano${s}`, [0, -P.antebrazo, 0]);
    malla(mano, new THREE.SphereGeometry(0.048, 14, 10), mat(COLORES.piel), [0, -0.035, 0.005], [0, 0, 0], [0.8, 1.1, 0.95]);
    malla(mano, new THREE.CapsuleGeometry(0.016, 0.03, 4, 8), mat(COLORES.piel), [-0.03 * lado, -0.03, 0.03], [0.5, 0, -0.5 * lado]);
    return { hombro, br, codo, mano };
  };
  const bI = brazo(1);
  const bD = brazo(-1);

  // ── Cuello, cabeza, cara ────────────────────────────────────────────────────────────────
  const cuello = nodo(pecho, "cuello", P.cuello);
  malla(cuello, new THREE.CylinderGeometry(0.047, 0.05, 0.1, 12), mat(COLORES.piel), [0, 0.03, 0]);
  const cabeza = nodo(cuello, "cabeza", P.cabeza);
  malla(cabeza, new THREE.SphereGeometry(0.13, 28, 20), mat(COLORES.piel), [0, 0.12, 0], [0, 0, 0], [0.93, 1.1, 0.97]);
  malla(cabeza, new THREE.SphereGeometry(0.128, 24, 16), mat(COLORES.pelo, { roughness: 0.8 }), [0, 0.15, -0.035], [0, 0, 0], [0.97, 1, 0.95]);
  for (const lado of [1, -1]) {
    malla(cabeza, new THREE.SphereGeometry(0.03, 10, 8), mat(COLORES.piel), [0.122 * lado, 0.115, -0.005], [0, 0, 0], [0.5, 1, 0.8]);
  }
  malla(cabeza, new THREE.SphereGeometry(0.022, 12, 8), mat(COLORES.piel), [0, 0.105, 0.132], [0, 0, 0], [0.8, 1, 1.15]);

  const grupoCara = nodo(cabeza, "grupoCara");
  const ojo = (lado: 1 | -1) => {
    const o = nodo(grupoCara, `ojo${lado === 1 ? "I" : "D"}`, [0.046 * lado, 0.135, 0.107]);
    malla(o, new THREE.SphereGeometry(0.021, 14, 10), mat(COLORES.ojo, { roughness: 0.3 }), [0, 0, 0], [0, 0, 0], [1, 1, 0.6]);
    const pupila = nodo(o, "pupila", [0, 0, 0.01]);
    malla(pupila, new THREE.SphereGeometry(0.0115, 10, 8), mat(COLORES.pupila, { roughness: 0.25 }), [0, 0, 0], [0, 0, 0], [1, 1, 0.6]);
    // Párpado: casquete de piel que gira sobre el ojo. Abierto ≈ -0.55 (el render tiene los
    // párpados caídos, es parte del carácter); cerrado ≈ +1.4.
    const parpado = nodo(o, `parpado${lado === 1 ? "I" : "D"}`);
    malla(parpado, new THREE.SphereGeometry(0.0235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORES.piel), [0, 0, 0], [0, 0, 0], [1.05, 1, 0.75]);
    parpado.rotation.x = -0.55;
    const ceja = nodo(grupoCara, `ceja${lado === 1 ? "I" : "D"}`, [0.048 * lado, 0.172, 0.114]);
    // Cejas con la punta interior algo alzada: gesto amable. Al revés (como estaban) ponía
    // cara de enfado permanente, que no es el carácter.
    malla(ceja, new THREE.CapsuleGeometry(0.006, 0.03, 3, 6), mat(COLORES.pelo), [0, 0, 0], [0, 0, Math.PI / 2 - 0.1 * lado]);
    return { grupo: o, pupila, parpado, ceja };
  };
  const oI = ojo(1);
  const oD = ojo(-1);

  const boca = nodo(grupoCara, "boca", [0, 0.058, 0.118]);
  const bocaNeutra = malla(boca, new THREE.CapsuleGeometry(0.0055, 0.03, 3, 6), mat(COLORES.boca), [0, 0, 0], [0, 0, Math.PI / 2]);
  const bocaSonrisa = malla(boca, new THREE.TorusGeometry(0.022, 0.0055, 6, 14, Math.PI), mat(COLORES.boca), [0, 0.012, 0], [0, 0, Math.PI]);
  bocaSonrisa.scale.setScalar(0.001);
  const bocaO = malla(boca, new THREE.TorusGeometry(0.011, 0.005, 6, 14), mat(COLORES.boca));
  bocaO.scale.setScalar(0.001);
  const mejilla = (lado: 1 | -1) => {
    const m = malla(grupoCara, new THREE.SphereGeometry(0.03, 12, 8), mat(COLORES.piel), [0.058 * lado, 0.065, 0.085]);
    m.scale.setScalar(0.001);
    return m;
  };
  const mejillaI = mejilla(1);
  const mejillaD = mejilla(-1);

  const sombrero = nodo(cabeza, "sombrero", [0, 0.215, -0.008]);
  sombrero.rotation.x = -0.12;
  malla(sombrero, new THREE.SphereGeometry(0.146, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORES.sombrero, { roughness: 0.75 }), [0, 0, 0], [0, 0, 0], [1, 0.92, 1.05]);
  malla(sombrero, new THREE.CylinderGeometry(0.149, 0.149, 0.032, 28), mat(COLORES.sombreroCinta), [0, 0.014, 0], [0, 0, 0], [1, 1, 1.05]);
  malla(sombrero, new THREE.CylinderGeometry(0.225, 0.235, 0.016, 36), mat(COLORES.sombrero, { roughness: 0.75 }), [0, -0.004, 0.005]);
  malla(sombrero, new THREE.SphereGeometry(0.016, 8, 6), mat(COLORES.sombreroCinta), [0, 0.135, 0]);
  const gafasCara = nodo(cabeza, "ranuraGafasCara", [0, 0.135, 0.135]);
  const ranuraBoca = nodo(cabeza, "ranuraBoca", [0, 0.055, 0.145]);

  // ── Péndulos: silbato y gafas del cuello, pulverizador del cinturón ─────────────────────
  const cordon = (padre: THREE.Object3D, largo: number) =>
    malla(padre, new THREE.CylinderGeometry(0.003, 0.003, largo, 4), mat(COLORES.cordon), [0, -largo / 2, 0]);

  const penduloSilbato = nodo(pecho, "penduloSilbato", [0.0, 0.19, 0.1]);
  cordon(penduloSilbato, 0.2);
  const ranuraSilbato = nodo(penduloSilbato, "ranuraSilbato", [0, -0.21, 0.012]);
  const silbato = nodo(ranuraSilbato, "silbato");
  malla(silbato, g(new RoundedBoxGeometry(0.034, 0.05, 0.026, 3, 0.01)), mat(COLORES.silbato, { roughness: 0.4 }));
  malla(silbato, new THREE.TorusGeometry(0.008, 0.003, 6, 10), mat(COLORES.cordon), [0, 0.03, 0], [0, Math.PI / 2, 0]);
  const dianaSilbato = new THREE.Mesh(g(new THREE.SphereGeometry(0.09, 8, 6)), new THREE.MeshBasicMaterial({ visible: false }));
  silbato.add(dianaSilbato);

  const penduloGafas = nodo(pecho, "penduloGafas", [0.0, 0.19, 0.12]);
  cordon(penduloGafas, 0.1);
  const ranuraGafasCuello = nodo(penduloGafas, "ranuraGafasCuello", [0, -0.1, 0.012]);
  const gafas = nodo(ranuraGafasCuello, "gafas");
  for (const lado of [1, -1]) {
    malla(gafas, new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18), mat(COLORES.gafas, { roughness: 0.2 }), [0.038 * lado, 0, 0], [Math.PI / 2, 0, 0]);
    malla(gafas, new THREE.CylinderGeometry(0.0035, 0.0035, 0.1, 4), mat(COLORES.gafas), [0.07 * lado, 0.012, -0.05], [Math.PI / 2, 0, 0]);
  }
  malla(gafas, new THREE.CylinderGeometry(0.004, 0.004, 0.02, 4), mat(COLORES.gafas), [0, 0.01, 0], [0, 0, Math.PI / 2]);

  const penduloPulverizador = nodo(cadera, "penduloPulverizador", [-0.17, 0.05, 0.08]);
  const ranuraPulverizador = nodo(penduloPulverizador, "ranuraPulverizador", [0, -0.08, 0]);
  const pulverizador = nodo(ranuraPulverizador, "pulverizador");
  malla(pulverizador, new THREE.CapsuleGeometry(0.036, 0.04, 6, 14), mat(COLORES.pulverizador, { roughness: 0.35 }));
  malla(pulverizador, new THREE.CylinderGeometry(0.018, 0.022, 0.03, 12), mat(COLORES.cremaTapon), [0, 0.07, 0]);
  malla(pulverizador, g(new RoundedBoxGeometry(0.03, 0.018, 0.02, 2, 0.006)), mat(COLORES.cremaTapon), [0, 0.09, 0.008]);
  malla(penduloPulverizador, new THREE.TorusGeometry(0.014, 0.004, 6, 10), mat(COLORES.cremaTapon), [0, -0.01, 0], [0, Math.PI / 2, 0]);

  // ── Pan (dos mitades que parecen una) y crema, en la mochila ────────────────────────────
  const pan = nodo(ranuraPan, "pan");
  const mitad = (signo: 1 | -1) => {
    const m = nodo(pan, signo === 1 ? "panA" : "panB", [0, 0.078 * signo, 0]);
    malla(m, new THREE.CapsuleGeometry(0.037, 0.1, 8, 14), mat(COLORES.pan, { roughness: 0.8 }), [0, 0, 0], [0, 0, 0], [1, 1, 0.9]);
    for (const k of [-0.03, 0.02]) {
      malla(m, g(new RoundedBoxGeometry(0.03, 0.009, 0.01, 1, 0.004)), mat(COLORES.panCorte, { roughness: 0.9 }), [0, k, 0.032], [0, 0, 0.5]);
    }
    return m;
  };
  const panA = mitad(1);
  const panB = mitad(-1);

  // ── Libreta y lápiz (buzón de sugerencias) ────────────────────────────────────────────
  // Origen en el centro de la libreta; la hoja mira a +z. El lápiz vive en su canto derecho.
  // Algo más grande que una de verdad: al tamaño del personaje en la web (200 px de alto) una de
  // bolsillo eran 15 px y no se reconocía.
  const libreta = nodo(ranuraLibreta, "libreta");
  malla(libreta, g(new RoundedBoxGeometry(0.13, 0.17, 0.018, 2, 0.005)), mat(COLORES.libreta, { roughness: 0.6 }));
  malla(libreta, g(new RoundedBoxGeometry(0.116, 0.152, 0.004, 1, 0.001)), mat(COLORES.libretaHojas, { roughness: 0.9 }), [0.002, -0.005, 0.0095]);
  for (let i = 0; i < 7; i++) {
    malla(libreta, new THREE.TorusGeometry(0.008, 0.0018, 4, 8), mat(COLORES.libretaEspiral), [-0.048 + i * 0.016, 0.084, 0], [0, Math.PI / 2, 0]);
  }
  const ranuraLapiz = nodo(libreta, "ranuraLapiz", [0.072, -0.008, 0.004]);
  const lapiz = nodo(ranuraLapiz, "lapiz");
  malla(lapiz, new THREE.CylinderGeometry(0.0055, 0.0055, 0.09, 6), mat(COLORES.lapiz, { roughness: 0.5 }));
  malla(lapiz, new THREE.ConeGeometry(0.0055, 0.016, 6), mat(COLORES.lapizMadera), [0, -0.053, 0], [Math.PI, 0, 0]);
  malla(lapiz, new THREE.ConeGeometry(0.0022, 0.006, 6), mat(COLORES.lapizMina), [0, -0.0605, 0], [Math.PI, 0, 0]);
  malla(lapiz, new THREE.CylinderGeometry(0.0056, 0.0056, 0.008, 6), mat(COLORES.lapizGoma), [0, 0.049, 0]);
  const ranuraEscribir = nodo(libreta, "ranuraEscribir", [-0.03, 0.02, 0.022]);

  const crema = nodo(ranuraCrema, "crema");
  malla(crema, new THREE.CylinderGeometry(0.034, 0.036, 0.1, 16), mat(COLORES.crema, { roughness: 0.4 }));
  malla(crema, new THREE.CylinderGeometry(0.02, 0.024, 0.032, 12), mat(COLORES.cremaTapon), [0, 0.066, 0]);
  malla(crema, new THREE.CircleGeometry(0.016, 12), mat(COLORES.cremaTapon), [0.0, 0.0, 0.0361]);

  // ── Paraguas en la mano izquierda. Origen = donde lo agarra; el mango sale hacia +y ─────
  const paraguas = nodo(bI.mano, "paraguas", [0, -0.04, 0.01]);
  malla(paraguas, new THREE.CylinderGeometry(0.009, 0.009, 0.92, 8), mat(COLORES.paraguasVarilla, { roughness: 0.4 }), [0, 0.38, 0]);
  malla(paraguas, new THREE.TorusGeometry(0.03, 0.009, 8, 14, Math.PI), mat(COLORES.paraguasVarilla, { roughness: 0.4 }), [0.03, -0.08, 0], [0, 0, Math.PI]);
  const tela = nodo(paraguas, "tela", [0, 0.82, 0]);
  // Tela: ocho paños (facetado plano) y una emisión suave, porque una tela de paraguas al sol
  // deja pasar luz — sin ella, la cara interior sale casi negra.
  const telaMat = mat(COLORES.paraguasTela, {
    roughness: 0.7,
    flatShading: true,
    side: THREE.DoubleSide,
    emissive: COLORES.paraguasTela,
    emissiveIntensity: 0.28,
  });
  malla(tela, new THREE.ConeGeometry(0.52, 0.23, 8, 1, true), telaMat, [0, -0.115, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    malla(tela, new THREE.SphereGeometry(0.012, 6, 4), mat(COLORES.paraguasVarilla), [Math.sin(a) * 0.52, -0.23, Math.cos(a) * 0.52]);
  }
  malla(tela, new THREE.CylinderGeometry(0.008, 0.012, 0.07, 6), mat(COLORES.paraguasVarilla), [0, 0.03, 0]);

  // ── Sombra de contacto: una mancha, no una luz con sombras (sale casi gratis) ───────────
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 64;
  const ctx = lienzo.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texSombra = new THREE.CanvasTexture(lienzo);
  const sombra = new THREE.Mesh(
    g(new THREE.PlaneGeometry(0.95, 0.5)),
    new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.002;
  raiz.add(sombra);

  const j: Record<Articulacion, THREE.Object3D> = {
    cadera,
    piernaI: pI.cad,
    rodillaI: pI.rod,
    tobilloI: pI.tob,
    piernaD: pD.cad,
    rodillaD: pD.rod,
    tobilloD: pD.tob,
    columna,
    pecho,
    cuello,
    cabeza,
    hombroI: bI.hombro,
    brazoI: bI.br,
    codoI: bI.codo,
    manoI: bI.mano,
    hombroD: bD.hombro,
    brazoD: bD.br,
    codoD: bD.codo,
    manoD: bD.mano,
    mochila,
    sombrero,
    cejaI: oI.ceja,
    cejaD: oD.ceja,
    parpadoI: oI.parpado,
    parpadoD: oD.parpado,
  };

  return {
    raiz,
    j,
    obj: { paraguas, tela, pan, panA, panB, crema, pulverizador, silbato, gafas, libreta, lapiz },
    pendulo: { silbato: penduloSilbato, gafas: penduloGafas, pulverizador: penduloPulverizador },
    ranura: {
      pan: ranuraPan,
      crema: ranuraCrema,
      pulverizador: ranuraPulverizador,
      silbato: ranuraSilbato,
      gafasCuello: ranuraGafasCuello,
      gafasCara,
      boca: ranuraBoca,
      libreta: ranuraLibreta,
      lapiz: ranuraLapiz,
      escribir: ranuraEscribir,
    },
    cara: {
      grupo: grupoCara,
      ojoI: oI.grupo,
      ojoD: oD.grupo,
      pupilaI: oI.pupila,
      pupilaD: oD.pupila,
      bocaNeutra,
      bocaSonrisa,
      bocaO,
      mejillaI,
      mejillaD,
    },
    forma: { vientre: formaVientre, pecho: formaPecho },
    sombra,
    diana: { silbato: dianaSilbato },
    pierna: { muslo: MUSLO, tibia: TIBIA, alturaTobillo: ALTURA_TOBILLO, pieZ: P.pieZ, pieX: Math.abs(P.pierna[0]) + 0.005 },
    brazo: { brazo: P.brazo, antebrazo: P.antebrazo },
    mallasCuerpo: (() => {
      // Atrezo = todo lo que cuelga de un objeto, un péndulo, la mochila o la sombra.
      const atrezo = new Set<THREE.Object3D>([
        ...Object.values({ paraguas, tela, pan, panA, panB, crema, pulverizador, silbato, gafas, libreta, lapiz }),
        penduloSilbato,
        penduloGafas,
        penduloPulverizador,
        mochila,
        sombra,
        grupoCara,
      ]);
      const esAtrezo = (o: THREE.Object3D | null): boolean => !!o && (atrezo.has(o) || esAtrezo(o.parent));
      const cuerpo: THREE.Object3D[] = [];
      raiz.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !esAtrezo(o)) cuerpo.push(o);
      });
      return cuerpo;
    })(),
    liberar: () => {
      for (const geo of geos) geo.dispose();
      for (const m of mats.values()) m.dispose();
      texSombra.dispose();
    },
  };
}
