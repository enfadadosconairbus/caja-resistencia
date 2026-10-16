"use client";
import * as React from "react";
import { ABRIR_BUZON, BUZON_ENVIADO, abrirBuzon } from "@/lib/buzon-eventos";
import type { Bocadillo } from "./acciones";
import type { Escenario } from "./escenario";

/**
 * El huelguista de la caja: un personaje que vive en el borde inferior de la página.
 *
 * Este fichero es lo ÚNICO que entra en la carga inicial (unos pocos KB). three.js y el
 * personaje llegan después, en diferido, y solo donde tiene sentido:
 *
 * | Situación                         | Qué se ve                                                  |
 * |-----------------------------------|------------------------------------------------------------|
 * | Escritorio                        | Entra andando tras el `load` + tiempo ocioso               |
 * | Móvil                             | Póster que respira; al primer gesto (desplazar, tocar), el |
 * |                                   | 3D lo releva con un fundido. Al tocar el póster, saluda.   |
 * | Ahorro de datos, conexión lenta   | Póster; el 3D solo si se pide tocándolo                    |
 * | Movimiento reducido               | Póster quieto; al tocarlo, solo el bocadillo               |
 * | Sin WebGL                         | Póster                                                     |
 * | Oculto por el visitante           | Un botón pequeño para volver a mostrarlo                   |
 *
 * En móvil el 3D espera al primer gesto a propósito: el modelo son ~585 KB y así no se gastan en
 * quien abre la página y se va, ni entran en la medida de Lighthouse. El póster no se quita hasta
 * que el 3D está pintando de verdad (`alListo`): antes desaparecía al tocarlo y no se veía nada
 * mientras llegaba el modelo, y luego el muñeco salía atascado mientras la GPU compilaba.
 *
 * Además es una de las dos puertas del buzón de sugerencias (la otra está en el pie): un sobre
 * entre sus controles, una invitación una vez por visita, y cuando llega una sugerencia la apunta
 * en su libreta. Ver `components/buzon.tsx` y `lib/buzon-eventos.ts`.
 *
 * Las dos preferencias (oculto, sonido) se guardan en `localStorage`, igual que el tema.
 * El sonido está APAGADO por defecto y no se crea nada de audio hasta que se enciende.
 */

export type TextosHuelguista = {
  nombre: string;
  saludar: string;
  silbato: string;
  sonidoActivar: string;
  sonidoDesactivar: string;
  ocultar: string;
  mostrar: string;
  buzon: string;
  bocadillos: {
    saludo: string[];
    pan: string;
    sol: string;
    fresco: string;
    voto: string;
    baile: string;
    asentir: string;
    recibido: string;
    invitacion: string;
  };
};

const CLAVE_OCULTO = "caja-huelguista";
const CLAVE_SONIDO = "caja-huelguista-sonido";
/** La invitación al buzón sale una vez por visita, a este tiempo de tenerlo en pantalla. */
const ESPERA_INVITACION_MS = 45_000;

/**
 * Preferencias como almacén externo (igual que el tema en `tema-toggle.tsx`): la verdad vive
 * en `localStorage`, React solo la lee. Si el almacenamiento está bloqueado, `memoria` hace que
 * la elección valga al menos para esta visita.
 */
const EVENTO = "caja-huelguista-cambio";
const memoria: Record<string, string> = {};
const leer = (k: string) => {
  try {
    return localStorage.getItem(k) ?? memoria[k] ?? null;
  } catch {
    return memoria[k] ?? null;
  }
};
const guardar = (k: string, v: string) => {
  memoria[k] = v;
  try {
    localStorage.setItem(k, v);
  } catch {
    // Navegación privada con almacenamiento bloqueado: queda en `memoria` hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO));
};
const suscribirPreferencias = (cb: () => void) => {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
};

const Q_REDUCIDO = "(prefers-reduced-motion: reduce)";
const Q_MOVIL = "(max-width: 767px), (pointer: coarse)";
const suscribirMedia = (q: string) => (cb: () => void) => {
  const m = window.matchMedia(q);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const suscribirReducido = suscribirMedia(Q_REDUCIDO);
const suscribirMovil = suscribirMedia(Q_MOVIL);
const sinSuscripcion = () => () => {};

type Modo = "esperando" | "oculto" | "poster" | "3d";
type Inicio = "entrar" | "saludar" | "aparecer";
type TextoBocadillo = { texto: string; invita: boolean };

let webgl: boolean | null = null;
function hayWebGL() {
  if (webgl === null) {
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
type Conexion = { saveData?: boolean; effectiveType?: string };
const conexion = () => (navigator as Navigator & { connection?: Conexion }).connection;
/** Ahorro de datos, una conexión lenta o sin WebGL: el 3D solo si se pide tocando el póster. */
const conexionPobre = () => {
  const c = conexion();
  return c?.saveData === true || ["slow-2g", "2g", "3g"].includes(c?.effectiveType ?? "") || !hayWebGL();
};

export function Huelguista({ textos }: { textos: TextosHuelguista }) {
  // En el servidor todo es `false`: no se pinta nada hasta hidratar, y así no hay desajuste.
  const cliente = React.useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const estudio = React.useSyncExternalStore(
    sinSuscripcion,
    () => new URLSearchParams(window.location.search).get("huelguista") === "estudio",
    () => false,
  );
  const reducido = React.useSyncExternalStore(suscribirReducido, () => window.matchMedia(Q_REDUCIDO).matches, () => false);
  const movil = React.useSyncExternalStore(suscribirMovil, () => window.matchMedia(Q_MOVIL).matches, () => false);
  const pobre = React.useSyncExternalStore(sinSuscripcion, conexionPobre, () => false);
  const oculto = React.useSyncExternalStore(suscribirPreferencias, () => leer(CLAVE_OCULTO) === "oculto", () => false);
  const sonido = React.useSyncExternalStore(suscribirPreferencias, () => leer(CLAVE_SONIDO) === "si", () => false);
  /** Ya pasó el `load` y hubo un momento ocioso (y en móvil, además, un gesto del visitante). */
  const [listo, setListo] = React.useState(false);
  /** El visitante tocó el póster y quiere verlo moverse. */
  const [tocado, setTocado] = React.useState(false);
  /** Cómo arranca el 3D: andando desde el borde, saludando, o relevando al póster sin más. */
  const [inicio, setInicio] = React.useState<Inicio>("entrar");
  /** El 3D ya pinta: el póster puede irse. */
  const [listo3d, setListo3d] = React.useState(false);
  const [posterRetirado, setPosterRetirado] = React.useState(false);
  const [bocadillo, setBocadillo] = React.useState<TextoBocadillo | null>(null);
  const [abierto, setAbierto] = React.useState(false);

  // Primero se ve el póster en móvil, con poca conexión o con movimiento reducido.
  const conPoster = cliente && (reducido || movil || pobre);
  // En móvil con buena conexión, el 3D releva al póster por su cuenta (tras el gesto).
  const relevoAutomatico = conPoster && movil && !reducido && !pobre;
  let modo: Modo = "esperando";
  if (!cliente) modo = "esperando";
  else if (estudio) modo = "3d";
  else if (oculto) modo = "oculto";
  else if (conPoster) modo = (tocado && !reducido) || (relevoAutomatico && listo) ? "3d" : "poster";
  else modo = listo ? "3d" : "esperando";

  const cajaRef = React.useRef<HTMLDivElement>(null);
  const lienzoRef = React.useRef<HTMLDivElement>(null);
  const posterRef = React.useRef<HTMLImageElement>(null);
  const escenarioRef = React.useRef<Escenario | null>(null);
  const sonidoRef = React.useRef(false);
  const audioRef = React.useRef<typeof import("./sonido") | null>(null);
  const saludoRef = React.useRef(0);
  const temporizadores = React.useRef<number[]>([]);
  const modoRef = React.useRef<Modo>(modo);
  /** Ya se abrió el buzón o ya se invitó: no se vuelve a invitar en esta visita. */
  const invitadoRef = React.useRef(false);

  React.useEffect(() => {
    sonidoRef.current = sonido;
  }, [sonido]);
  React.useEffect(() => {
    modoRef.current = modo;
    if (modo !== "3d") {
      setListo3d(false);
      setPosterRetirado(false);
    }
  }, [modo]);

  const decir = React.useCallback(
    (b: Bocadillo) => {
      const texto =
        b === "saludo"
          ? textos.bocadillos.saludo[saludoRef.current++ % textos.bocadillos.saludo.length]
          : textos.bocadillos[b];
      const invita = b === "invitacion";
      setBocadillo({ texto, invita });
      // La invitación se queda más, para dar tiempo a pulsarla; el «¡Recibido!», algo más que
      // un comentario suelto, porque es la respuesta a lo que acaba de hacer el visitante.
      const ms = invita ? 7000 : b === "recibido" ? 5500 : 3600;
      const id = window.setTimeout(() => setBocadillo((actual) => (actual?.texto === texto ? null : actual)), ms);
      temporizadores.current.push(id);
    },
    [textos],
  );

  const silbar = React.useCallback(() => {
    if (sonidoRef.current) audioRef.current?.silbido();
  }, []);

  // Esperar al `load` y a un momento ocioso: que el primer pintado sea de la web. En móvil,
  // además, a un gesto del visitante. El gesto se escucha DESDE EL PRINCIPIO y se recuerda: quien
  // desplaza la página nada más abrirla ya ha dado su gesto, aunque la carga no haya acabado
  // (escuchándolo solo al final, ese primer desplazamiento se perdía y el póster no se iba).
  const esperaCarga = cliente && !estudio && !oculto && !listo && (!conPoster || relevoAutomatico);
  React.useEffect(() => {
    if (!esperaCarga) return;
    let cancelado = false;
    let cargado = false;
    let gesto = !relevoAutomatico;
    const gestos = ["scroll", "touchstart", "pointerdown", "keydown"] as const;
    const quitarGestos = () => gestos.forEach((g) => window.removeEventListener(g, alGesto));
    const intentar = () => {
      if (cancelado || !cargado || !gesto) return;
      quitarGestos();
      if (relevoAutomatico) setInicio("aparecer");
      setListo(true);
    };
    function alGesto() {
      gesto = true;
      intentar();
    }
    if (relevoAutomatico) gestos.forEach((g) => window.addEventListener(g, alGesto, { passive: true }));
    const arrancar = () => {
      const ocioso = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      const seguir = () => {
        const id = window.setTimeout(() => {
          cargado = true;
          intentar();
        }, 1200);
        temporizadores.current.push(id);
      };
      if (ocioso) ocioso(seguir, { timeout: 4000 });
      else seguir();
    };
    if (document.readyState === "complete") arrancar();
    else window.addEventListener("load", arrancar, { once: true });
    return () => {
      cancelado = true;
      window.removeEventListener("load", arrancar);
      quitarGestos();
    };
  }, [esperaCarga, relevoAutomatico]);

  // Montar / desmontar la escena 3D.
  React.useEffect(() => {
    if (modo !== "3d") return;
    let vivo = true;
    void Promise.all([import("./escenario"), import("./sonido")]).then(async ([esc, audio]) => {
      if (!vivo || !cajaRef.current || !lienzoRef.current) return;
      audioRef.current = audio;
      const montado = await esc.montar({
        caja: cajaRef.current,
        lienzo: lienzoRef.current,
        movil,
        inicio,
        alDecir: decir,
        alSilbar: silbar,
        alListo: () => vivo && setListo3d(true),
        estudio: estudio ? { escala: ESCALA_ESTUDIO } : undefined,
      });
      // Si mientras cargaba el modelo se ocultó o cambió el modo, se desmonta en el acto.
      if (vivo) escenarioRef.current = montado;
      else montado.destruir();
    });
    return () => {
      vivo = false;
      escenarioRef.current?.destruir();
      escenarioRef.current = null;
    };
  }, [modo, movil, inicio, decir, silbar, estudio]);

  // Cuando el 3D pinta, el póster se funde (300 ms de CSS) y luego se retira. Con un
  // temporizador y no con `transitionend`: ese evento no llega si el navegador no está pintando
  // (pestaña en segundo plano), y el póster se quedaba montado, invisible y respirando.
  React.useEffect(() => {
    if (!listo3d) return;
    const id = window.setTimeout(() => setPosterRetirado(true), 400);
    return () => clearTimeout(id);
  }, [listo3d]);

  // El póster respira mientras está a la vista (con movimiento reducido, quieto).
  const posterVisible = modo === "poster" || (modo === "3d" && conPoster && inicio !== "entrar" && !posterRetirado);
  React.useEffect(() => {
    const img = posterRef.current;
    if (!posterVisible || reducido || !img?.animate) return;
    const a = img.animate(
      [{ transform: "scale(1, 1)" }, { transform: "scale(1.006, 1.014)" }, { transform: "scale(1, 1)" }],
      { duration: 3800, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => a.cancel();
    // `modo` también: al pasar de póster a relevo, la imagen cambia de caja (es otro elemento).
  }, [posterVisible, reducido, modo]);

  // Buzón: cuando alguien lo abre, ya no hace falta invitar; y cuando llega una sugerencia, la
  // contesta él (cancelando el evento, el buzón se cierra sin su propio agradecimiento).
  React.useEffect(() => {
    const alAbrir = () => {
      invitadoRef.current = true;
    };
    const alEnviar = (e: Event) => {
      const m = modoRef.current;
      if (m !== "3d" && m !== "poster") return;
      e.preventDefault();
      decir("recibido");
      escenarioRef.current?.recibido();
    };
    window.addEventListener(ABRIR_BUZON, alAbrir);
    window.addEventListener(BUZON_ENVIADO, alEnviar);
    return () => {
      window.removeEventListener(ABRIR_BUZON, alAbrir);
      window.removeEventListener(BUZON_ENVIADO, alEnviar);
    };
  }, [decir]);

  // La invitación: una vez por visita, tras un rato con él en pantalla, y nunca a quien ya abrió
  // el buzón. Si la pestaña está en segundo plano, espera a que vuelva.
  const aLaVista = modo === "3d" || modo === "poster";
  React.useEffect(() => {
    if (!aLaVista || estudio || invitadoRef.current) return;
    const id = window.setTimeout(function intentar() {
      if (invitadoRef.current) return;
      if (document.hidden) {
        document.addEventListener("visibilitychange", intentar, { once: true });
        return;
      }
      invitadoRef.current = true;
      if (modoRef.current === "3d" && escenarioRef.current) escenarioRef.current.invitar();
      else decir("invitacion");
    }, ESPERA_INVITACION_MS);
    return () => clearTimeout(id);
  }, [aLaVista, estudio, decir]);

  React.useEffect(() => {
    const ts = temporizadores.current;
    return () => ts.forEach((t) => clearTimeout(t));
  }, []);

  const abrirControles = () => {
    setAbierto(true);
    const id = window.setTimeout(() => setAbierto(false), 6000);
    temporizadores.current.push(id);
  };

  const alPulsar = (e: React.MouseEvent<HTMLButtonElement>) => {
    abrirControles();
    if (sonidoRef.current) audioRef.current?.prepararAudio();
    if (modo === "3d") {
      // `detail === 0` = activado con teclado: no hay punto de clic, así que saluda.
      if (e.detail === 0) escenarioRef.current?.interactuar();
      else escenarioRef.current?.interactuar(e.clientX, e.clientY);
      return;
    }
    if (modo === "poster" && !reducido) {
      setInicio("saludar");
      setTocado(true);
      return;
    }
    decir("saludo");
  };

  const alSilbato = () => {
    if (sonidoRef.current) audioRef.current?.prepararAudio();
    if (modo === "3d") escenarioRef.current?.silbar();
    else if (sonidoRef.current) void import("./sonido").then((a) => a.silbido());
  };

  const alternarSonido = () => {
    const nuevo = !sonido;
    sonidoRef.current = nuevo;
    guardar(CLAVE_SONIDO, nuevo ? "si" : "no");
    if (nuevo) {
      // El gesto de activar es el que desbloquea el audio del navegador.
      void import("./sonido").then((a) => {
        audioRef.current = a;
        a.prepararAudio();
      });
    }
  };

  const ocultar = () => {
    setBocadillo(null);
    setTocado(false);
    guardar(CLAVE_OCULTO, "oculto");
  };

  const mostrar = () => {
    setInicio("entrar");
    setListo(true);
    guardar(CLAVE_OCULTO, "visible");
  };

  if (modo === "esperando") return null;

  if (modo === "oculto") {
    return (
      <button
        type="button"
        data-huelguista
        onClick={mostrar}
        aria-label={textos.mostrar}
        title={textos.mostrar}
        className="fixed bottom-3 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-linea)] bg-[var(--color-superficie)] text-[var(--color-tinta-suave)] opacity-80 shadow-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 print:hidden"
      >
        <IconoSombrero />
      </button>
    );
  }

  const factor = estudio ? ESCALA_ESTUDIO : 1;
  const medidas = movil ? { ancho: 128 * factor, alto: 172 * factor } : { ancho: 200 * factor, alto: 270 * factor };
  const poster = modo === "poster";
  // El póster, del MISMO tamaño y en el mismo sitio que el 3D al relevarlo. Medido en pantalla
  // por siluetas (no por cajas): con 150 px salía un 28 % más grande y 22 px más a la derecha, y
  // el fundido daba un salto. Ahora póster 57 × 115 px y 3D 57 × 116 px, en el mismo sitio. La
  // base es el centro de la caja del 3D (a 8 px del borde); el resto, el desfase medido, en
  // proporción al alto para que valga también en escritorio.
  const altoPoster = movil ? 117 : 184;
  const anchoPoster = Math.round((altoPoster * 253) / 460);
  const derechaPoster = Math.round(8 + (movil ? 128 : 200) / 2 - anchoPoster / 2 - altoPoster * 0.068);
  const cajaPoster = {
    left: "auto",
    right: derechaPoster,
    bottom: Math.round(altoPoster * 0.043),
    height: altoPoster,
    width: anchoPoster,
  } as const;
  const imagenPoster = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={posterRef}
      src="/huelguista/de-pie.webp"
      alt=""
      width={253}
      height={460}
      decoding="async"
      fetchPriority="low"
      className="pointer-events-none block h-full w-auto origin-bottom select-none"
      draggable={false}
    />
  );
  // Mientras el 3D carga, el póster sigue donde estaba; cuando el 3D pinta, se funden.
  const relevoEnCurso = modo === "3d" && posterVisible;
  const visible3d = estudio || listo3d;
  // La diana, el bocadillo y los controles van con lo que se VE: el póster hasta que el 3D pinta,
  // y el 3D después. Si fueran siempre en la caja del 3D, durante la carga (segundos, en un móvil)
  // tocar al huelguista sacaría unos controles invisibles, sobre una caja aún transparente.
  const adornosEnPoster = poster || (relevoEnCurso && !listo3d);

  /** Diana, bocadillo y controles. `comoPoster`: colocados para el póster (caja estrecha). */
  const adornos = (comoPoster: boolean) => (
    <>
      {/* Diana: la silueta, no la caja entera. Llega hasta el paraguas. */}
      <button
        type="button"
        onClick={alPulsar}
        aria-label={textos.saludar}
        className="pointer-events-auto absolute bottom-0 left-1/2 h-[92%] w-[46%] -translate-x-1/2 cursor-pointer rounded-t-full bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-acento-tinta)]"
        style={comoPoster ? { height: "100%", width: "100%" } : undefined}
      />

      {/* Bocadillo pegado a la cara, a la altura de la boca y con el pico hacia ella. Sale
          hacia el centro de la pantalla: a su izquierda salvo cuando anda por el borde
          izquierdo (el escenario pone `data-lado` en la caja). La invitación al buzón es un
          botón: pulsarla lo abre. */}
      {bocadillo && (
        <div
          role="status"
          className={
            "absolute w-max max-w-[200px] " +
            (bocadillo.invita ? "pointer-events-auto " : "pointer-events-none ") +
            (comoPoster
              ? "bottom-[64%] right-[72%]"
              : "bottom-[52%] right-[63%] group-data-[lado=derecha]:left-[63%] group-data-[lado=derecha]:right-auto")
          }
        >
          {bocadillo.invita ? (
            <button
              type="button"
              onClick={() => {
                setBocadillo(null);
                abrirBuzon();
              }}
              className="flex items-start gap-2 rounded-2xl border border-[var(--color-acento-tinta)] bg-[var(--color-superficie)] px-3 py-2 text-left text-sm leading-snug text-[var(--color-tinta)] shadow-md transition-colors hover:bg-[var(--color-fondo)]"
            >
              <IconoSobre />
              <span className="underline decoration-[var(--color-acento-tinta)] underline-offset-2">{bocadillo.texto}</span>
            </button>
          ) : (
            <p className="rounded-2xl border border-[var(--color-linea)] bg-[var(--color-superficie)] px-3 py-2 text-left text-sm leading-snug text-[var(--color-tinta)] shadow-md">
              {bocadillo.texto}
            </p>
          )}
          <span
            aria-hidden="true"
            className="absolute bottom-3 -right-[6px] h-2.5 w-2.5 rotate-45 border-r border-t border-[var(--color-linea)] bg-[var(--color-superficie)] group-data-[lado=derecha]:-left-[6px] group-data-[lado=derecha]:right-auto group-data-[lado=derecha]:border-b group-data-[lado=derecha]:border-l group-data-[lado=derecha]:border-r-0 group-data-[lado=derecha]:border-t-0"
          />
        </div>
      )}

      {/* Controles pegados a la silueta: el ratón pasa de una a otros sin cruzar un hueco
          que los escondería. Con teclado aparecen al llegar el foco; en táctil, al tocarlo. */}
      <div
        className="pointer-events-none absolute left-[74%] top-[6%] flex flex-col gap-1 pl-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-data-[abierto=true]:pointer-events-auto group-data-[abierto=true]:opacity-100"
        style={comoPoster ? { left: "auto", right: 0, top: "auto", bottom: "100%", paddingBottom: 4 } : undefined}
      >
        <BotonControl etiqueta={textos.buzon} onClick={abrirBuzon}>
          <IconoSobre />
        </BotonControl>
        <BotonControl etiqueta={textos.silbato} onClick={alSilbato}>
          <IconoSilbato />
        </BotonControl>
        <BotonControl
          etiqueta={sonido ? textos.sonidoDesactivar : textos.sonidoActivar}
          onClick={alternarSonido}
          pulsado={sonido}
        >
          <IconoSonido activo={sonido} />
        </BotonControl>
        <BotonControl etiqueta={textos.ocultar} onClick={ocultar}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </BotonControl>
      </div>
    </>
  );

  return (
    <>
    {estudio && <PanelEstudio probar={(n) => void escenarioRef.current?.probar(n)} />}
    {relevoEnCurso && (
      <div
        data-abierto={abierto || undefined}
        className="group pointer-events-none fixed bottom-0 z-30 transition-opacity duration-300 print:hidden"
        style={{ ...cajaPoster, opacity: listo3d ? 0 : 1 }}
      >
        {imagenPoster}
        {!listo3d && adornos(true)}
      </div>
    )}
    <div
      ref={cajaRef}
      data-huelguista
      data-abierto={abierto || undefined}
      // La caja no captura el ratón: solo la silueta y los controles. Lo de alrededor, aunque
      // caiga dentro del rectángulo, sigue siendo la página.
      className="group pointer-events-none fixed bottom-0 left-0 z-30 transition-opacity duration-300 print:hidden"
      style={
        poster
          ? cajaPoster
          : { width: medidas.ancho, height: medidas.alto, willChange: "transform", opacity: visible3d ? 1 : 0 }
      }
    >
      {poster ? imagenPoster : <div ref={lienzoRef} className="pointer-events-none absolute inset-0" />}
      {(poster || (visible3d && !adornosEnPoster)) && adornos(poster)}
    </div>
    </>
  );
}

const ESCALA_ESTUDIO = 2.4;
const ACCIONES_ESTUDIO = [
  ["andar", "Andar"],
  ["refrescarse", "Refrescarse"],
  ["crema", "Crema solar"],
  ["paraguas", "Paraguas"],
  ["gafas", "Gafas"],
  ["silbato", "Silbato"],
  ["saludar", "Saludar"],
  ["pan", "Compartir el pan"],
  ["cerrarParaguas", "Cerrar paraguas"],
  ["abrirParaguas", "Abrir paraguas"],
  ["votar", "Votar a mano alzada"],
  ["bailar", "Bailar"],
  ["asentir", "Asentir"],
  ["anotar", "Anotar sugerencia"],
  ["invitarBuzon", "Invitar al buzón"],
  ["mirarAlrededor", "Mirar alrededor"],
] as const;

/** Botonera del modo estudio. Sin traducir a propósito: es una herramienta interna. */
function PanelEstudio({ probar }: { probar: (n: (typeof ACCIONES_ESTUDIO)[number][0]) => void }) {
  return (
    <div data-huelguista className="fixed left-3 top-28 z-30 flex max-w-[180px] flex-col gap-1 rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-2 text-sm shadow-md">
      <p className="px-1 pb-1 font-mono text-xs uppercase tracking-wide text-[var(--color-tinta-suave)]">Estudio</p>
      {ACCIONES_ESTUDIO.map(([n, etiqueta]) => (
        <button
          key={n}
          type="button"
          onClick={() => probar(n)}
          className="rounded-md px-2 py-1 text-left text-[var(--color-tinta)] hover:bg-[var(--color-linea)]"
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function BotonControl({
  etiqueta,
  onClick,
  pulsado,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  pulsado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={pulsado}
      title={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-linea)] bg-[var(--color-superficie)] text-[var(--color-tinta-suave)] shadow-sm transition-colors hover:border-[var(--color-tinta)] hover:text-[var(--color-tinta)]"
    >
      {children}
    </button>
  );
}

function IconoSombrero() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M2.5 15.5c2.5 1.2 16.5 1.2 19 0-1.2-1-3.5-1.5-3.5-1.5H6s-2.3.5-3.5 1.5Z" />
    </svg>
  );
}

function IconoSobre() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </svg>
  );
}

function IconoSilbato() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="14" r="5" />
      <path d="M13 11.5 21 8v4l-7.2 2" />
      <path d="M4 6l2 2M8 4v2.5" />
    </svg>
  );
}

function IconoSonido({ activo }: { activo: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {activo ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
    </svg>
  );
}
