import { NextResponse } from "next/server";
import { contarVisita, contadorConfigurado } from "@/lib/visitas";

/**
 * Suma una visita y devuelve el total.
 *
 * Va por API y no en el render de la página porque las páginas son ESTÁTICAS: si contara
 * al renderizar, el número se congelaría en el build y solo subiría una vez por hora, con
 * la revalidación. Aquí sube una vez por carga real.
 *
 * No se guarda nada de quien visita: ni IP, ni user-agent, ni cookie, ni identificador.
 * Solo un número que se incrementa. Por eso no necesita consentimiento previo.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  if (!contadorConfigurado) {
    return NextResponse.json({ visitas: null }, { status: 200 });
  }
  const visitas = await contarVisita();
  return NextResponse.json({ visitas }, { headers: { "Cache-Control": "no-store" } });
}
