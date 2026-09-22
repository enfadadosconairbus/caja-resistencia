/**
 * Enlace al REDACTOR de Gmail con destinatario y asunto ya puestos.
 *
 * Por qué no un `mailto:` (14-ago-2026): en un escritorio sin cliente de correo asociado
 * —Windows recién instalado, o alguien que solo usa webmail— pulsar un `mailto:` no hace
 * absolutamente nada. Ni error, ni aviso: el botón parece roto. Le pasó a Carlos con Gmail
 * abierto en otra pestaña, que es justo el caso más común entre quienes van a escribirnos.
 *
 * A quien use otro programa de correo se le sigue ofreciendo el `mailto:` al lado; esto no
 * sustituye esa vía, la antepone.
 *
 * El asunto viaja traducido, así que va escapado: sin `encodeURIComponent`, un acento o un
 * espacio parten la URL.
 */
export function redactorGmail(destinatario: string, asunto: string): string {
  const to = encodeURIComponent(destinatario);
  const su = encodeURIComponent(asunto);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}`;
}
