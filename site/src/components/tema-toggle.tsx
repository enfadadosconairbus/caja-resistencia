"use client";
import * as React from "react";
import { TEMA_CLAVE } from "@/lib/tema";

// El tema real vive en el DOM (lo pone el guion de arriba), no en un estado de React: así
// no hay dos fuentes de verdad ni un primer render que contradiga a lo ya pintado.
const subscribe = (cb: () => void) => {
  window.addEventListener("caja-tema-cambio", cb);
  // Otra pestaña del mismo sitio también cuenta: cambiar el tema allí lo cambia aquí.
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("caja-tema-cambio", cb);
    window.removeEventListener("storage", cb);
  };
};
const leerCliente = () => document.documentElement.classList.contains("dark");
/** En el servidor no hay `localStorage`: se pinta el modo claro, que es el defecto. */
const leerServidor = () => false;

export function TemaToggle({ label }: { label: { oscuro: string; claro: string } }) {
  const oscuro = React.useSyncExternalStore(subscribe, leerCliente, leerServidor);

  const cambiar = () => {
    const raiz = document.documentElement;
    const siguiente = !raiz.classList.contains("dark");

    // La transición se enciende solo para el cruce y se apaga a los 240 ms (ver
    // `.tema-cambiando` en globals.css): dejarla puesta gravaría cada hover de la página.
    raiz.classList.add("tema-cambiando");
    window.setTimeout(() => raiz.classList.remove("tema-cambiando"), 240);

    raiz.classList.toggle("dark", siguiente);
    try {
      localStorage.setItem(TEMA_CLAVE, siguiente ? "oscuro" : "claro");
    } catch {
      // Navegación privada con almacenamiento bloqueado: el tema vale para esta página y
      // se pierde al recargar. Es un grado menos de comodidad, no un error que contar.
    }
    window.dispatchEvent(new Event("caja-tema-cambio"));
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      // `aria-pressed` en vez de un `switch`: es un botón que conmuta un ajuste, y así el
      // lector de pantalla anuncia el estado sin necesidad de texto visible.
      aria-pressed={oscuro}
      aria-label={oscuro ? label.claro : label.oscuro}
      title={oscuro ? label.claro : label.oscuro}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-linea)] text-[var(--color-tinta-suave)] transition-colors hover:border-[var(--color-tinta)] hover:text-[var(--color-tinta)]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {oscuro ? (
          // En noche se ofrece volver al papel: sol.
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11Z" />
        )}
      </svg>
    </button>
  );
}
