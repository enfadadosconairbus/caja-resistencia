"use client";
import * as React from "react";
import { BUZON, TURNSTILE_PRUEBA, type ErrorBuzon } from "@/config/buzon";
import { ABRIR_BUZON, BUZON_ENVIADO } from "@/lib/buzon-eventos";

/**
 * Buzón de sugerencias: un diálogo modal que se abre desde el huelguista o desde el pie.
 *
 * Es un formulario normal a propósito, no algo que dependa del personaje: en móvil el huelguista
 * puede ser una imagen fija, quien lo oculta con la X lo pierde de vista, y un personaje 3D no se
 * maneja con teclado ni con lector de pantalla. El `<dialog>` nativo trae el foco atrapado, el
 * Escape y el fondo inerte sin código propio.
 *
 * Turnstile (el filtro antibots de Cloudflare) solo se descarga al ABRIR el buzón: quien no lo
 * abre no contacta con nadie más que con esta web. Va en modo "solo si hace falta": casi siempre
 * es invisible.
 */

export type TextosBuzon = {
  titulo: string;
  intro: string;
  anonimo: string;
  etiquetaTexto: string;
  placeholder: string;
  etiquetaContacto: string;
  ayudaContacto: string;
  privacidad: string;
  enviar: string;
  enviando: string;
  cancelar: string;
  cerrar: string;
  gracias: string;
  contador: string;
  errores: Record<ErrorBuzon | "red", string>;
};

type Turnstile = {
  render: (el: HTMLElement, op: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let cargaTurnstile: Promise<Turnstile | null> | null = null;
function cargarTurnstile(): Promise<Turnstile | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  cargaTurnstile ??= new Promise((resolver) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolver(window.turnstile ?? null);
    // Bloqueado (extensiones, red): el formulario sigue y el servidor decide.
    s.onerror = () => {
      cargaTurnstile = null;
      resolver(null);
    };
    document.head.appendChild(s);
  });
  return cargaTurnstile;
}

type Estado = "editando" | "enviando" | "enviado";

export function Buzon({ textos, lang, claveSitio }: { textos: TextosBuzon; lang: string; claveSitio?: string }) {
  const dialogo = React.useRef<HTMLDialogElement>(null);
  const zonaTurnstile = React.useRef<HTMLDivElement>(null);
  const widget = React.useRef<string | null>(null);
  const abiertoEn = React.useRef(0);
  const [abierto, setAbierto] = React.useState(false);
  const [estado, setEstado] = React.useState<Estado>("editando");
  const [texto, setTexto] = React.useState("");
  const [contacto, setContacto] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState("");
  const idTexto = React.useId();
  const idContacto = React.useId();
  const idAyuda = React.useId();
  const idError = React.useId();

  React.useEffect(() => {
    const abrir = () => {
      setEstado((e) => (e === "enviado" ? "editando" : e));
      setError(null);
      abiertoEn.current = Date.now();
      setAbierto(true);
    };
    window.addEventListener(ABRIR_BUZON, abrir);
    return () => window.removeEventListener(ABRIR_BUZON, abrir);
  }, []);

  React.useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  // Turnstile: se monta al abrir y se quita al cerrar (un token caduca a los 5 minutos).
  React.useEffect(() => {
    if (!abierto || estado !== "editando") return;
    let vivo = true;
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const clave = local ? TURNSTILE_PRUEBA.sitio : claveSitio;
    if (!clave) return;
    void cargarTurnstile().then((ts) => {
      if (!vivo || !ts || !zonaTurnstile.current || widget.current) return;
      widget.current = ts.render(zonaTurnstile.current, {
        sitekey: clave,
        language: lang,
        appearance: "interaction-only",
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    });
    return () => {
      vivo = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
      setToken("");
    };
  }, [abierto, estado, claveSitio, lang]);

  const cerrar = () => setAbierto(false);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (estado === "enviando") return;
    const limpio = texto.trim();
    if (limpio.length < BUZON.minTexto) {
      setError(textos.errores.corto.replace("{min}", String(BUZON.minTexto)));
      return;
    }
    setError(null);
    setEstado("enviando");
    const datos = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/sugerencia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          texto: limpio,
          contacto: contacto.trim(),
          web: datos.get("web") ?? "",
          segundos: (Date.now() - abiertoEn.current) / 1000,
          token,
          lang,
          pagina: location.pathname,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: ErrorBuzon };
      if (!r.ok || !j.ok) {
        const clave = j.error ?? "envio";
        setError(textos.errores[clave].replace("{min}", String(BUZON.minTexto)).replace("{email}", BUZON.destino));
        // Volver a "editando" vuelve a montar Turnstile: el token gastado no sirve dos veces.
        setEstado("editando");
        return;
      }
    } catch {
      setError(textos.errores.red.replace("{email}", BUZON.destino));
      setEstado("editando");
      return;
    }
    setTexto("");
    setContacto("");
    // ¿Está el huelguista para contestar él? Si cancela el evento, sí: el buzón se cierra.
    const nadieContesta = window.dispatchEvent(new Event(BUZON_ENVIADO, { cancelable: true }));
    if (nadieContesta) setEstado("enviado");
    else {
      setEstado("editando");
      setAbierto(false);
    }
  };

  const contador = textos.contador.replace("{n}", String(texto.length)).replace("{max}", String(BUZON.maxTexto));

  return (
    <dialog
      ref={dialogo}
      onClose={() => setAbierto(false)}
      aria-labelledby={`${idTexto}-titulo`}
      className="m-auto max-h-[90dvh] w-[min(92vw,520px)] overflow-y-auto rounded-xl border border-[var(--color-linea)] bg-[var(--color-superficie)] p-0 text-[var(--color-tinta)] backdrop:bg-black/50"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id={`${idTexto}-titulo`} className="font-[family-name:var(--ff-display)] text-xl font-bold">
            {textos.titulo}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label={textos.cerrar}
            className="rounded-md border border-[var(--color-linea)] px-2 py-1 text-sm"
          >
            ✕
          </button>
        </div>

        {estado === "enviado" ? (
          <div className="space-y-5">
            <p role="status" className="text-base leading-relaxed">
              {textos.gracias}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-full bg-[var(--color-tinta)] px-5 py-2 text-sm font-semibold text-[var(--color-fondo)]"
              >
                {textos.cerrar}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--color-tinta-suave)]">
              {textos.intro} <strong className="font-semibold text-[var(--color-tinta)]">{textos.anonimo}</strong>
            </p>

            <div>
              <label htmlFor={idTexto} className="mb-1.5 block text-sm font-semibold">
                {textos.etiquetaTexto}
              </label>
              <textarea
                id={idTexto}
                name="texto"
                required
                rows={5}
                maxLength={BUZON.maxTexto}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={textos.placeholder}
                aria-describedby={error ? idError : undefined}
                aria-invalid={error ? true : undefined}
                className="block w-full resize-y rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2 text-base leading-relaxed text-[var(--color-tinta)] placeholder:text-[var(--color-tinta-suave)] focus:border-[var(--color-tinta)] focus:outline-none"
              />
              <p aria-live="polite" className="mt-1 text-right font-[family-name:var(--ff-mono)] text-xs text-[var(--color-tinta-suave)]">
                {texto.length > BUZON.maxTexto * 0.8 ? contador : ""}
              </p>
            </div>

            <div>
              <label htmlFor={idContacto} className="mb-1.5 block text-sm font-semibold">
                {textos.etiquetaContacto}
              </label>
              <input
                id={idContacto}
                name="contacto"
                type="text"
                inputMode="email"
                autoComplete="email"
                maxLength={BUZON.maxContacto}
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                aria-describedby={idAyuda}
                className="block w-full rounded-lg border border-[var(--color-linea)] bg-[var(--color-fondo)] px-3 py-2 text-base text-[var(--color-tinta)] focus:border-[var(--color-tinta)] focus:outline-none"
              />
              <p id={idAyuda} className="mt-1 text-xs text-[var(--color-tinta-suave)]">
                {textos.ayudaContacto}
              </p>
            </div>

            {/* Campo trampa: fuera de la vista y del foco. Una persona no lo ve; un bot, sí. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Web
                <input type="text" name="web" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>

            <div ref={zonaTurnstile} />

            {error ? (
              <p id={idError} role="alert" className="rounded-lg border border-[var(--color-acento-tinta)] px-3 py-2 text-sm text-[var(--color-acento-tinta)]">
                {error}
              </p>
            ) : null}

            <p className="text-xs leading-relaxed text-[var(--color-tinta-suave)]">{textos.privacidad}</p>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button type="button" onClick={cerrar} className="rounded-full px-4 py-2 text-sm text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]">
                {textos.cancelar}
              </button>
              <button
                type="submit"
                disabled={estado === "enviando"}
                className="rounded-full bg-[var(--color-acento)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-acento-hondo)] disabled:opacity-60"
              >
                {estado === "enviando" ? textos.enviando : textos.enviar}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
