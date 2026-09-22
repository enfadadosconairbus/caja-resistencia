/**
 * Aviso de estado, anclado bajo la navegación.
 *
 * Sustituye al banner global de «PROPUESTA DE WEB», que salía en las cuatro páginas y
 * repetía en todas un aviso que solo es cierto en dos: no hay caja constituida (La caja) y
 * la tienda no puede vender (Tienda). El resto de la web —conflicto, termómetro,
 * documentación— no es ninguna propuesta: es información real del movimiento, y anteponerle
 * una etiqueta de borrador le restaba credibilidad sin motivo.
 */
export function Aviso({ texto }: { texto: string }) {
  return (
    <p
      role="status"
      className="border-b border-[color-mix(in_srgb,var(--color-acento)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-acento)_8%,transparent)] px-5 py-3 text-center font-[family-name:var(--ff-mono)] text-xs leading-relaxed text-[var(--color-acento-tinta-fuerte)]"
    >
      {texto}
    </p>
  );
}
