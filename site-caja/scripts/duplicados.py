#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
¿Este documento ya está publicado, aunque el fichero se llame de otra forma?

Por qué hace falta
------------------
El índice del grupo casa los documentos por **id de mensaje**, y el mismo PDF circula por
Telegram reenviado varias veces: cada repost trae un id distinto. El Excel de revisión
excluye lo que el índice ya publicó comparando esos ids, así que un repost se cuela como
documento nuevo y se acaba publicando **dos veces, con dos títulos distintos**.

No es hipotético. El rescate del 22-ago-2026 dio de alta 21 documentos «invisibles» en el
índice y **17 de ellos ya estaban catalogados** por el grupo bajo otro nombre de fichero
(«Comunicado CGT estatal - 23/07/2026» era «Comunicado CGT estatal - 20260723», el «Pliego
de garantías» tenía tres copias…). El fallo se vio solo al comparar el CONTENIDO.

Cómo compara
------------
Por el texto normalizado del PDF, que ignora nombre, metadatos y el `/ID` que PyMuPDF
regenera al guardar. Para los escaneados —sin capa de texto, y son muchos aquí— cae a las
**páginas renderizadas a 60 dpi**: basta para distinguir documentos y es barato. Así se
detectaron los dos últimos duplicados del rescate, que no tenían texto.

Uso:
    from duplicados import huella, buscar_gemelo
"""
import hashlib
import re
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - mismo criterio que limpiar_metadatos.py
    fitz = None

# Por debajo de esto el texto no distingue nada (una portada suelta, un sello): se compara
# por imagen, que es lo que hace un PDF escaneado.
MIN_TEXTO = 80


def huella(ruta):
    """Huella del CONTENIDO de un documento, o None si no se puede leer.

    Devuelve `("txt", hash)` o `("img", hash)` para no comparar entre sí dos huellas
    calculadas de formas distintas.
    """
    if fitz is None:
        return None
    try:
        doc = fitz.open(ruta)
    except Exception:
        return None
    try:
        texto = re.sub(r"\s+", " ", "".join(p.get_text() for p in doc)).strip().lower()
        if len(texto) >= MIN_TEXTO:
            return ("txt", hashlib.sha256(texto.encode()).hexdigest())
        h = hashlib.sha256()
        h.update(str(doc.page_count).encode())
        for pagina in doc:
            h.update(pagina.get_pixmap(dpi=60).samples)
        return ("img", h.hexdigest())
    except Exception:
        return None
    finally:
        doc.close()


def buscar_gemelo(ruta, directorio, saltar=()):
    """Nombre del fichero de `directorio` con el mismo contenido que `ruta`, o None.

    `saltar` es para no compararse consigo mismo cuando el fichero ya está copiado.
    """
    objetivo = huella(ruta)
    if objetivo is None:
        return None
    saltar = {str(s) for s in saltar}
    for f in sorted(Path(directorio).iterdir()):
        if not f.is_file() or f.name in saltar or f.suffix.lower() != ".pdf":
            continue
        if huella(f) == objetivo:
            return f.name
    return None
