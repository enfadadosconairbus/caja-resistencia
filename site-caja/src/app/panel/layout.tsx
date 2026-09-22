import type { Metadata } from "next";
// Mismas fuentes auto-alojadas que el sitio, para que las variables --ff-* de globals.css
// resuelvan también aquí (el panel vive fuera de [lang], con su propia raíz html/body).
import "@fontsource-variable/archivo";
import "@fontsource-variable/source-sans-3";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "../globals.css";

// Panel interno de Tesorería: nunca indexable, pase lo que pase con SITE_INDEXABLE.
export const metadata: Metadata = {
  title: "Panel de Tesorería",
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full antialiased bg-[var(--color-fondo)] text-[var(--color-tinta)]">
        {children}
      </body>
    </html>
  );
}
