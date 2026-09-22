/**
 * Contrato del modo noche, compartido por el layout (servidor) y el interruptor (cliente).
 *
 * Vive fuera de `tema-toggle.tsx` a propósito: ese fichero es `"use client"`, y lo que se
 * importa de un módulo cliente desde un componente de servidor llega como referencia, no
 * como el valor — el layout no podría meter el guion en el HTML.
 */

/** Clave de `localStorage`. Valores: `"oscuro"` | `"claro"`. Ausente = claro. */
export const TEMA_CLAVE = "caja-tema";

/**
 * Se ejecuta ANTES del primer pintado: si la última visita eligió noche, pone la clase en
 * `<html>` sin que llegue a verse el papel blanco. Va como script inline por lo mismo que
 * `guionSinParpadeo` del pie — un fichero externo llegaría tarde, y el destello de fondo
 * claro en una web que se lee de noche es de lo más agresivo que hay.
 *
 * Ojo con lo que NO hace: no mira `prefers-color-scheme`. Si lo hiciera, quien tenga el
 * sistema en oscuro entraría en oscuro sin haberlo pedido, y eso es el dark-default que
 * D-09 prohíbe. El defecto es papel; la noche se elige.
 */
export const guionTemaSinParpadeo = `try{if(localStorage.getItem('${TEMA_CLAVE}')==='oscuro'){document.documentElement.classList.add('dark')}}catch(e){}`;
