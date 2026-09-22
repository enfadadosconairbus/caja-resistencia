/**
 * Snapshot del ÍNDICE DE DOCUMENTOS del grupo (telegra.ph) → src/config/documentos.json
 *
 * Congela el índice (categorías + documentos, ya sin autor ni reacciones — ver la nota de
 * privacidad en src/lib/indice-parse.ts) y reconstruye el mapa `archivos`, que es lo que
 * convierte cada entrada en una descarga real. La web lee el índice en vivo y cae a este
 * snapshot si telegra.ph falla, igual que el termómetro.
 *
 * ⚠️ Esto NO publica documentos: solo mira qué hay ya en public/docs. De bajarlos y
 * publicarlos se encarga `publicar-indice.mjs`.
 *
 *   npm run snapshot:documentos
 */
import { cargarIndice } from "../src/lib/indice-parse.ts";
import { fetcher, construirSnapshot, guardarSnapshot, DESTINO } from "./lib-documentos.mjs";

try {
  const indice = await cargarIndice(fetcher);
  const { snapshot, stats } = construirSnapshot(indice);
  const escrito = guardarSnapshot(snapshot);
  console.log(
    (escrito ? `✓ snapshot escrito (${DESTINO})\n` : `· snapshot sin cambios (${DESTINO})\n`) +
      `  índice actualizado: ${indice.actualizado}\n` +
      `  ${stats.categorias} categorías · ${stats.docs} documentos catalogados\n` +
      `  ${stats.conFichero} descargables desde la web · ${stats.docs - stats.conFichero} solo enlazan al grupo` +
      (stats.ocultos ? `\n  ${stats.ocultos} ocultos por documentos-overrides.json` : ""),
  );
} catch (e) {
  console.error(`✗ no se pudo actualizar el índice: ${e.message}`);
  console.error("  se conserva el snapshot anterior (si existía). No se toca nada.");
  process.exit(1);
}
