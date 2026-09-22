/**
 * Miniatura de una noticia.
 *
 * Con imagen → la carga desde el medio original, en diferido y con `no-referrer` para
 * filtrar lo mínimo. ⚠️ Esto SÍ es un recurso de terceros en el navegador del visitante
 * (el resto de la web no lo es): la política de cookies se ajusta para decirlo. Sin
 * imagen → mosaico con la inicial del medio, en el estilo de la casa (cero terceros).
 *
 * Componente puro (sin hooks): sirve tanto en server como en client components.
 */
export function Miniatura({ src, medio }: { src: string | null; medio: string }) {
  const base =
    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-linea)] bg-[var(--color-superficie)]";
  if (src) {
    return (
      // next/image exige remotePatterns por dominio; las miniaturas vienen de medios
      // arbitrarios y desconocidos → <img> normal, en diferido y con no-referrer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={`${base} object-cover`}
      />
    );
  }
  const inicial = (medio.trim()[0] ?? "·").toUpperCase();
  return (
    <div className={`${base} grid place-items-center`} aria-hidden="true">
      <span className="font-[family-name:var(--ff-display)] text-xl font-bold text-[var(--color-tinta-suave)]">
        {inicial}
      </span>
    </div>
  );
}
