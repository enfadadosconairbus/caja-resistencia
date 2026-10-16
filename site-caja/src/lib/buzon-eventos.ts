/**
 * Cómo se hablan el buzón de sugerencias, el huelguista y el pie de página sin importarse entre
 * sí: con dos eventos de `window`.
 *
 * - `ABRIR_BUZON`: cualquiera lo lanza (el sobre del huelguista, su invitación, el enlace del pie).
 * - `BUZON_ENVIADO`: lo lanza el buzón tras enviar. Es CANCELABLE: si el huelguista está en
 *   pantalla, lo cancela para decir que se ha encargado él (saca la libreta y contesta), y el
 *   buzón se cierra sin más. Si nadie lo cancela, el propio buzón muestra el agradecimiento.
 */
export const ABRIR_BUZON = "caja-buzon-abrir";
export const BUZON_ENVIADO = "caja-buzon-enviado";

export const abrirBuzon = () => window.dispatchEvent(new Event(ABRIR_BUZON));
