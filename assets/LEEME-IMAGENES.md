# Imágenes de la tienda

Faltan dos imágenes (las tienes tú, las subiste a ChatGPT). Colócalas aquí con
**exactamente** estos nombres, porque `index.html` las referencia así:

| Fichero                   | Qué es                                         | Recomendado |
|---------------------------|------------------------------------------------|-------------|
| `camiseta-solidaria.jpg`  | Foto de la camiseta (delante/detrás)           | ≤ 250 KB, ~1200 px de ancho |
| `guia-tallas.jpg`         | Esquema visual de medidas (ancho × alto)       | ≤ 250 KB |

`favicon.svg` ya está incluido.

## Antes de subirlas al repo público — limpia metadatos

El repo será público. Quita EXIF/GPS/serie de cámara antes de subir (misma
política de anonimato que el resto del proyecto). Por ejemplo:

```bash
# con ImageMagick
magick camiseta-solidaria.jpg -strip -resize 1200x camiseta-solidaria.jpg
magick guia-tallas.jpg -strip guia-tallas.jpg
```

Comprueba que ninguna foto identifique a personas concretas si no procede.
