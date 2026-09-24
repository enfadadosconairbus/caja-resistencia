/**
 * Enlace al REDACTOR de Gmail con destinatario y asunto ya puestos.
 *
 * Por qué no un `mailto:` (14-ago-2026): en un escritorio sin cliente de correo asociado
 * —Windows recién instalado, o alguien que solo usa webmail— pulsar un `mailto:` no hace
 * absolutamente nada. Ni error, ni aviso: el botón parece roto. Le pasó a la coordinación con Gmail
 * abierto en otra pestaña, que es justo el caso más común entre quienes van a escribirnos.
 *
 * A quien use otro programa de correo se le sigue ofreciendo el `mailto:` al lado; esto no
 * sustituye esa vía, la antepone.
 *
 * El asunto viaja traducido, así que va escapado: sin `encodeURIComponent`, un acento o un
 * espacio parten la URL.
 */
/**
 * `mailto:` clásico con asunto. Se ofrece JUNTO al redactor de Gmail, no en su lugar: quien
 * tiene un cliente de correo configurado (Outlook, Apple Mail, Thunderbird…) lo abre en su
 * programa, y quien no, ve igualmente la dirección para copiarla. El redactor de Gmail sigue
 * como enlace secundario para el caso de webmail sin cliente asociado (ver arriba).
 */
export function mailtoRedactor(destinatario: string, asunto: string): string {
  const to = destinatario.split(",").map((e) => e.trim()).filter(Boolean).join(",");
  return `mailto:${to}?subject=${encodeURIComponent(asunto)}`;
}

export function redactorGmail(destinatario: string, asunto: string): string {
  // `destinatario` puede llevar VARIOS correos separados por coma: se escapa cada uno por
  // separado y se unen con coma literal (Gmail la usa de separador; una coma escapada como
  // %2C no siempre la parte). Con un solo correo, el comportamiento es el de siempre.
  const to = destinatario
    .split(",")
    .map((e) => encodeURIComponent(e.trim()))
    .filter(Boolean)
    .join(",");
  const su = encodeURIComponent(asunto);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}`;
}
