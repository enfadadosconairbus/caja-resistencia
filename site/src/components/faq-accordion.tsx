/**
 * FAQ con <details>/<summary> nativos: accesible por teclado sin JS, robusto y
 * reduced-motion-safe por defecto. Sin dependencias.
 */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-[var(--color-linea)] border-y border-[var(--color-linea)]">
      {items.map((item, i) => (
        <details key={i} className="group py-1">
          <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left font-[family-name:var(--ff-display)] text-lg font-semibold text-[var(--color-tinta)] marker:content-none [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="shrink-0 text-[var(--color-acento-tinta)] transition-transform duration-200 group-open:rotate-45"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="max-w-2xl pb-5 text-[var(--color-tinta-suave)]">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
