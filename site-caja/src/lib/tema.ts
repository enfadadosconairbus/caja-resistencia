/**
 * Contrato del modo noche, compartido por el layout (servidor) y el interruptor (cliente).
 *
 * Vive fuera de `tema-toggle.tsx` a propósito: ese fichero es `"use client"`, y lo que se
 * importa de un módulo cliente desde un componente de servidor llega como referencia, no
 * como el valor — el layout no podría meter el guion en el HTML.
 */

/** Clave de `localStorage`. Valores: `"oscuro"` | `"claro"`. Ausente = OSCURO. */
export const TEMA_CLAVE = "caja-tema";

/**
 * EXCEPCIÓN A D-09 PARA ESTA WEB (26-sep-2026). La regla del estudio prohíbe el
 * *dark-default* porque un fondo oscuro de salida es el cliché de una web hecha por IA.
 * Aquí se levanta, y no por gusto: con la paleta SEÑAL el modo fuerte es el oscuro —
 * lienzo casi negro, tintas de color brillando, la línea separando a 1,94:1 frente a
 * 1,56:1 en claro—, y el argumento de D-09 es sobre marca y hostelería, no sobre un
 * fondo de huelga que se lee en el móvil a pie de fábrica. Es decisión de la
 * coordinación, tomada sabiendo lo que se saltaba.
 *
 * **La excepción es de ESTA web, no del estudio.** `_PLANTILLA-SITE` sigue arrancando en
 * claro y D-09 sigue en pie para los demás sitios.
 *
 * El guion se ejecuta ANTES del primer pintado, y ahora va al revés: el HTML sale del
 * servidor CON la clase `dark` puesta, y esto la QUITA si la visita anterior eligió el
 * papel. Así el destello que se evita es el que más molesta — el fogonazo blanco a quien
 * abre la web de noche.
 *
 * Lo que sigue sin hacer: mirar `prefers-color-scheme`. Ya no por D-09, sino porque el
 * defecto es una decisión nuestra y la preferencia del sistema no tiene por qué
 * contradecirla; quien quiera papel lo elige y se le recuerda.
 */
export const guionTemaSinParpadeo = `try{if(localStorage.getItem('${TEMA_CLAVE}')==='claro'){document.documentElement.classList.remove('dark')}}catch(e){}`;
