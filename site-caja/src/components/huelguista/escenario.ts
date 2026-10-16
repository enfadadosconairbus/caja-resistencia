import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Cuerpo } from "./cuerpo";
import { ACCIONES, type Bocadillo, type Contexto, type NombreAccion } from "./acciones";
import { azar, limitar } from "./motor";

/**
 * Escena + cerebro. Se carga SOLO en diferido (import dinámico desde `huelguista.tsx`, tras el
 * `load` y en tiempo ocioso): three.js no pisa el LCP ni el presupuesto de la carga inicial.
 *
 * El personaje no se desplaza dentro de su escena: se desplaza su CAJA (un `div` fijo, movido
 * con `transform`, que el compositor mueve sin repintar la página). La escena es pequeña y el
 * coste de dibujarla no depende del ancho de la pantalla.
 */

export type Medidas = { ancho: number; alto: number };
export const MEDIDAS_ESCRITORIO: Medidas = { ancho: 200, alto: 270 };
export const MEDIDAS_MOVIL: Medidas = { ancho: 128, alto: 172 };

export type OpcionesEscenario = {
  caja: HTMLElement;
  lienzo: HTMLElement;
  movil: boolean;
  /**
   * "entrar": llega andando desde el borde. "saludar": ya estaba (póster) y saluda al tocarlo.
   * "aparecer": ya estaba (póster) y sigue a lo suyo; es el relevo automático del póster en móvil.
   */
  inicio: "entrar" | "saludar" | "aparecer";
  alDecir: (b: Bocadillo) => void;
  alSilbar: () => void;
  /**
   * Se llama UNA vez, cuando el 3D ya está pintando de verdad: modelo cargado, sombreadores
   * compilados y un par de fotogramas en pantalla. Hasta entonces la web sigue enseñando el
   * póster; sin esto, en móvil se veía un muñeco atascado mientras la GPU compilaba.
   */
  alListo?: () => void;
  /**
   * Modo estudio (`?huelguista=estudio`): grande, centrado y sin cerebro. Sirve para revisar
   * cada acción por separado con `probar()` — para quien anime y para dar el visto bueno.
   */
  estudio?: { escala: number };
};

export type Escenario = {
  interactuar: (clienteX?: number, clienteY?: number) => void;
  silbar: () => void;
  /** Ha llegado una sugerencia del buzón: la apunta en la libreta. */
  recibido: () => void;
  /** Invita a usar el buzón (una vez por visita; la web decide cuándo). */
  invitar: () => void;
  probar: (n: NombreAccion | "andar") => Promise<void>;
  destruir: () => void;
};

type Espera = { queda: number; resolver: () => void };

/**
 * El modelo de verdad (Meshy, preparado con `scripts/preparar-huelguista.mjs`). Si no carga —red,
 * WebAssembly bloqueado para el descompresor meshopt—, la maqueta hace de huelguista: se ve más
 * tosco, pero se mueve igual.
 */
async function cargarModelo(): Promise<{ escena: THREE.Object3D; animaciones: THREE.AnimationClip[] } | null> {
  try {
    const cargador = new GLTFLoader();
    cargador.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await cargador.loadAsync("/huelguista/huelguista.gltf");
    return { escena: gltf.scene, animaciones: gltf.animations };
  } catch (e) {
    console.warn("huelguista: sin modelo, se usa la maqueta", e);
    return null;
  }
}

export async function montar(op: OpcionesEscenario): Promise<Escenario> {
  const modelo = await cargarModelo();
  const base = op.movil ? MEDIDAS_MOVIL : MEDIDAS_ESCRITORIO;
  const escala = op.estudio?.escala ?? 1;
  const M = { ancho: Math.round(base.ancho * escala), alto: Math.round(base.alto * escala) };

  // ── Render ──────────────────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(M.ancho, M.alto);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  op.lienzo.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const fov = 22;
  const camara = new THREE.PerspectiveCamera(fov, M.ancho / M.alto, 0.1, 40);
  const distancia = 7.4;
  const altoVisible = 2 * distancia * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const suelo = -0.1; // lo que queda visible por debajo de los pies
  const centroY = suelo + altoVisible / 2;
  // Algo por encima, como el render de referencia: se ve la cara de arriba del paraguas.
  camara.position.set(0, centroY + 0.85, distancia);
  camara.lookAt(0, centroY, 0);
  const pxPorUnidad = M.alto / altoVisible;

  escena.add(new THREE.HemisphereLight("#fff8ec", "#7d8490", 1.55));
  const clave = new THREE.DirectionalLight("#ffffff", 2.1);
  clave.position.set(-2.5, 4, 5);
  escena.add(clave);
  const relleno = new THREE.DirectionalLight("#dfeaff", 0.55);
  relleno.position.set(3, 1, 2);
  escena.add(relleno);
  const contra = new THREE.DirectionalLight("#fff3e0", 0.9);
  contra.position.set(0.5, 3, -4);
  escena.add(contra);

  const cuerpo = new Cuerpo(modelo?.escena, modelo?.animaciones);
  escena.add(cuerpo.raiz);

  // ── Estado del cerebro ──────────────────────────────────────────────────────────────────
  const vw = () => document.documentElement.clientWidth;
  const maxX = () => Math.max(0, vw() - M.ancho);
  /**
   * Su sitio: el 25 % derecho de la ventana (el centro de la silueta no pasa de ahí a la
   * izquierda). Ahí pasa casi todo el tiempo, para no entorpecer la lectura; el resto del borde
   * inferior lo recorre solo de excursión, y vuelve.
   */
  const casa = () => {
    const hi = maxX();
    return [Math.min(hi, Math.max(0, vw() * 0.75 - M.ancho / 2)), hi] as const;
  };
  const enCasa = () => x >= casa()[0] - 2;
  const puntoEnCasa = () => {
    const [lo, hi] = casa();
    return azar(lo, hi);
  };

  let x = op.estudio ? maxX() / 2 : op.inicio === "entrar" ? vw() + 10 : maxX() - 8;
  let v = 0;
  let destino: { x: number; resolver: () => void } | null = null;
  let vivo = true;
  let enAccion = false;
  let deExcursion = false;
  /**
   * Cuántas acciones lleva hechas con el paraguas cerrado. La coordinación lo pidió así: que lo cierre,
   * siga a lo suyo un rato y al cabo lo vuelva a abrir. Antes de `MIN` no se le ofrece abrirlo, y
   * a partir de `MAX` lo abre sí o sí.
   */
  let accionesCerrado = 0;
  const CERRADO_MIN = 3;
  const CERRADO_MAX = 7;
  let cola: NombreAccion | null = op.inicio === "saludar" ? "saludar" : null;
  const esperas: Espera[] = [];
  const recientes: NombreAccion[] = [];

  const VMAX = (op.movil ? 55 : 72) * escala; // px/s
  const ACEL = 120 * escala;

  const ctx: Contexto = { decir: op.alDecir, silbar: op.alSilbar };

  const esperar = (seg: number) => new Promise<void>((resolver) => esperas.push({ queda: seg, resolver }));
  const despertar = () => {
    for (const e of esperas.splice(0)) e.resolver();
  };

  const andarA = (x1: number) =>
    new Promise<void>((resolver) => {
      destino = { x: limitar(x1, 0, maxX()), resolver };
    });

  async function caminar(x1: number) {
    const dir = Math.sign(x1 - x) || 1;
    // Mira antes de ir, y gira el cuerpo detrás de la mirada.
    cuerpo.miradaLibre = { yaw: dir * 0.8, pitch: 0.05 };
    await esperar(0.22);
    cuerpo.orientacionObjetivo = dir * 1.3;
    await esperar(0.18);
    await andarA(x1);
    // Frena, se da la vuelta hacia ti y se acomoda.
    await esperar(0.15);
    cuerpo.orientacionObjetivo = 0;
    cuerpo.miradaLibre = { yaw: 0, pitch: 0 };
    await esperar(0.35);
  }

  /** Un paseo por el borde de la página, fuera de su sitio, y de vuelta. */
  async function excursion() {
    const lo = casa()[0];
    if (lo < M.ancho) return; // en pantallas estrechas no hay "fuera de casa" que recorrer
    deExcursion = true;
    try {
      await caminar(azar(0, lo - M.ancho * 0.5));
      if (cola) return;
      await esperar(azar(1.2, 3));
      if (!cola && Math.random() < 0.5) await hacer("mirarAlrededor");
      if (!cola) await esperar(azar(0.5, 1.5));
    } finally {
      deExcursion = false;
    }
  }

  function elegirAccion(): NombreAccion {
    // Abierto: lo ajusta o lo cierra. Cerrado: sigue a lo suyo unas cuantas acciones y luego lo
    // vuelve a abrir (`accionesCerrado`).
    let segunParaguas: [NombreAccion, number][];
    if (!cuerpo.paraguasCerrado) {
      segunParaguas = [
        ["paraguas", 1],
        ["cerrarParaguas", 0.5],
      ];
    } else if (accionesCerrado >= CERRADO_MAX) {
      return "abrirParaguas";
    } else {
      segunParaguas = accionesCerrado >= CERRADO_MIN ? [["abrirParaguas", 0.9]] : [];
    }
    const pesos: [NombreAccion, number][] = [
      ["refrescarse", 1],
      ["crema", 1],
      ["gafas", 1],
      ["pan", 0.8],
      ["votar", 0.8],
      ["bailar", cuerpo.tieneClip("baile") ? 0.7 : 0],
      ["asentir", cuerpo.tieneClip("asentir") ? 0.7 : 0],
      ["mirarAlrededor", 1],
      ...segunParaguas,
    ];
    const posibles = pesos.filter(([n, p]) => p > 0 && !recientes.includes(n));
    const total = posibles.reduce((s, [, p]) => s + p, 0);
    let r = Math.random() * total;
    for (const [n, p] of posibles) {
      if ((r -= p) <= 0) return n;
    }
    return "mirarAlrededor";
  }

  async function hacer(n: NombreAccion) {
    enAccion = true;
    try {
      await ACCIONES[n](cuerpo, ctx);
    } finally {
      enAccion = false;
    }
    // El contador del paraguas: las acciones con él cerrado se cuentan; abrirlo lo reinicia.
    accionesCerrado = cuerpo.paraguasCerrado ? accionesCerrado + 1 : 0;
    recientes.push(n);
    if (recientes.length > 3) recientes.shift();
  }

  async function vivir() {
    if (op.inicio === "entrar") await caminar(puntoEnCasa());
    while (vivo) {
      if (cola) {
        const que = cola;
        cola = null;
        await hacer(que);
        continue;
      }
      // Fuera de su sitio (tras una excursión cortada, o porque la ventana cambió): vuelve.
      if (!enCasa() && !deExcursion) {
        await caminar(puntoEnCasa());
        continue;
      }
      // Quietud: un personaje expresivo no necesita moverse todo el rato. Mismo ritmo en
      // móvil que en escritorio (la coordinación, 6-oct-2026): antes el móvil esperaba el doble
      // (12-26 s) y casi no salía de paseo, y parecía que no hacía nada.
      await esperar(azar(6, 15));
      if (!vivo || cola) continue;
      const r = Math.random();
      const [lo, hi] = casa();
      if (r < 0.12) await excursion();
      else if (r < 0.3) {
        if (hi - lo > 40) await caminar(puntoEnCasa());
      } else if (r < 0.92) await hacer(elegirAccion());
    }
  }

  // ── Entrada del usuario ─────────────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tocaSilbato = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camara);
    return raycaster.intersectObject(cuerpo.m.diana.silbato, false).length > 0;
  };

  const interactuar = (cx?: number, cy?: number) => {
    if (cola) return;
    cola = cx !== undefined && cy !== undefined && tocaSilbato(cx, cy) ? "silbato" : "saludar";
    if (destino) destino.x = x + Math.sign(v) * Math.min(30, (v * v) / (2 * ACEL));
    if (!enAccion) despertar();
  };
  const silbar = () => {
    if (cola) return;
    cola = "silbato";
    if (!enAccion) despertar();
  };
  // Apuntar una sugerencia pasa por delante de cualquier otra cosa que esperara turno.
  const recibido = () => {
    cola = "anotar";
    if (destino) destino.x = x + Math.sign(v) * Math.min(30, (v * v) / (2 * ACEL));
    if (!enAccion) despertar();
  };
  const invitar = () => {
    if (cola) return;
    cola = "invitarBuzon";
    if (!enAccion) despertar();
  };

  // La mirada sigue al puntero (solo con ratón: en táctil no hay puntero que seguir).
  let ultimoPuntero = 0;
  const alMover = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = op.caja.getBoundingClientRect();
    const hx = r.left + M.ancho / 2;
    const hy = r.bottom - (1.62 - suelo) * pxPorUnidad;
    const dx = e.clientX - hx;
    const dy = e.clientY - hy;
    cuerpo.miradaLibre = { yaw: Math.atan2(dx, 700) * 1.3, pitch: Math.atan2(dy, 900) * 0.9 };
    ultimoPuntero = performance.now();
  };
  const alRedimensionar = () => {
    x = limitar(x, 0, maxX());
    if (!enAccion && !destino && !enCasa()) despertar();
  };
  window.addEventListener("pointermove", alMover, { passive: true });
  window.addEventListener("resize", alRedimensionar);

  // ── Bucle ───────────────────────────────────────────────────────────────────────────────
  let raf = 0;
  let fotogramasPintados = 0;
  const avisarListo = () => {
    if (++fotogramasPintados === 3) op.alListo?.();
  };
  let ultimo = performance.now();
  let acumulado = 0;
  const fotograma = (ahora: number) => {
    raf = requestAnimationFrame(fotograma);
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    // En calma basta con 30 fps: la respiración no necesita más, y la batería lo agradece.
    const calma = !enAccion && !destino && !cuerpo.motor.ocupado;
    acumulado += dt;
    if (calma && acumulado < 1 / 31) return;
    dt = Math.min(acumulado, 1 / 20);
    acumulado = 0;
    paso(dt);
  };

  /** Un paso de simulación. Separado del bucle para que el estudio pueda avanzar a mano. */
  const paso = (dt: number) => {
    for (let i = esperas.length - 1; i >= 0; i--) {
      esperas[i].queda -= dt;
      if (esperas[i].queda <= 0) esperas.splice(i, 1)[0].resolver();
    }

    // Andar con aceleración y frenada (v = √(2·a·d) al final: frena sin pasarse).
    let dx = 0;
    if (destino) {
      const dist = destino.x - x;
      const deseada = Math.sign(dist) * Math.min(VMAX, Math.sqrt(2 * ACEL * Math.abs(dist)));
      v += limitar(deseada - v, -ACEL * dt, ACEL * dt);
      dx = v * dt;
      x += dx;
      if (Math.abs(dist) < 1.5 && Math.abs(v) < 12) {
        v = 0;
        const d = destino;
        destino = null;
        d.resolver();
      }
    }
    cuerpo.velocidad = v / pxPorUnidad;

    if (performance.now() - ultimoPuntero > 2500 && !cuerpo.foco && !destino) {
      cuerpo.miradaLibre.yaw *= Math.exp(-dt * 0.8);
      cuerpo.miradaLibre.pitch *= Math.exp(-dt * 0.8);
    }

    op.caja.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    // El bocadillo sale hacia el centro de la pantalla: a su izquierda casi siempre, a su
    // derecha cuando la excursión lo lleva al borde izquierdo.
    const lado = x + M.ancho / 2 < vw() * 0.4 ? "derecha" : "izquierda";
    if (op.caja.dataset.lado !== lado) op.caja.dataset.lado = lado;

    cuerpo.actualizar(dt, dx / pxPorUnidad);
    renderer.render(escena, camara);
    if (fotogramasPintados < 3) avisarListo();
  };

  const alVisibilidad = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else {
      ultimo = performance.now();
      raf = requestAnimationFrame(fotograma);
    }
  };
  document.addEventListener("visibilitychange", alVisibilidad);
  op.caja.style.transform = `translate3d(${x}px, 0, 0)`;
  // Compilar los sombreadores ANTES del primer fotograma: en un móvil son cientos de ms de GPU, y
  // si se hace al pintar, el personaje sale congelado. Si el navegador no lo soporta, se sigue.
  try {
    await renderer.compileAsync(escena, camara);
  } catch {
    // compileAsync es una optimización: sin ella se compila en el primer render, como antes.
  }
  raf = requestAnimationFrame(fotograma);
  if (!op.estudio) void vivir();
  if (op.estudio || process.env.NODE_ENV === "development") {
    // Solo en estudio y en desarrollo: una foto del lienzo al instante, para revisar poses sin captura de
    // pantalla (el búfer WebGL se vacía tras cada pintado; aquí se pinta y se lee seguido).
    (window as unknown as { __huelguista: unknown }).__huelguista = {
      foto: (calidad = 0.85) => {
        renderer.render(escena, camara);
        return renderer.domElement.toDataURL("image/jpeg", calidad);
      },
      /** Avanza la simulación `seg` segundos sin esperar al navegador (que puede no pintar). */
      avanzar: async (seg: number) => {
        for (let t = 0; t < seg; t += 1 / 60) {
          paso(1 / 60);
          // Deja correr las promesas de las acciones entre paso y paso (una macrotarea por
          // MessageChannel: los setTimeout se frenan cuando la ventana no pinta).
          await new Promise<void>((r) => {
            const mc = new MessageChannel();
            mc.port1.onmessage = () => r();
            mc.port2.postMessage(0);
          });
        }
      },
      probar: (n: NombreAccion | "andar") => void probar(n),
      estado: () => ({ x, casa: casa(), enCasa: enCasa(), deExcursion, enAccion, andando: !!destino, cola, cerrado: cuerpo.paraguasCerrado, accionesCerrado }),
      cuerpo,
    };
  }

  const probar = async (n: NombreAccion | "andar") => {
    if (enAccion || destino) return;
    if (n === "andar") {
      const centro = maxX() / 2;
      await caminar(centro - M.ancho);
      await esperar(0.6);
      await caminar(centro);
      return;
    }
    await hacer(n);
  };

  return {
    interactuar: op.estudio ? (cx, cy) => void probar(cx !== undefined && cy !== undefined && tocaSilbato(cx, cy) ? "silbato" : "saludar") : interactuar,
    silbar: op.estudio ? () => void probar("silbato") : silbar,
    recibido: op.estudio ? () => void probar("anotar") : recibido,
    invitar: op.estudio ? () => void probar("invitarBuzon") : invitar,
    probar,
    destruir: () => {
      vivo = false;
      despertar();
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("resize", alRedimensionar);
      document.removeEventListener("visibilitychange", alVisibilidad);
      cuerpo.liberar();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
