#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Borra los metadatos de autoría de los documentos ANTES de que sean públicos.

Por qué existe
--------------
Un PDF publicado lleva dentro un campo `Autor` que se lee con dos clics desde el
navegador. En `public/docs/` había 30 de 94 con ese campo relleno (auditoría del
13-ago-2026), y no es un detalle cosmético en un conflicto laboral abierto:

  · `tablas-salariales-2021/2022/2023.pdf`, `politica-trabajo-a-distancia-airbus.pdf`
    y `comunicado-conjunto-cgt-ugt-y-util...pdf` llevaban **matrículas de Airbus**
    (C90170, C01037, C22539, kosita2). Ese código identifica al empleado dentro de
    la empresa: publicar un documento interno con la matrícula de quien lo generó
    señala por dónde salió.
  · Otros llevaban nombres y apellidos de compañeros (ESTEVEZ CUADRADO Lorena,
    Saez Campos Gonzalo [ES], Vidal Marc [ES], Penalva del Rio Fernando [ES]...).
  · Los seis ficheros del manifiesto iban firmados `Vercingetorix`: seudónimo, pero
    reutilizable —enlaza entre sí todo lo salido del mismo ordenador— y con la hora
    exacta de creación, que dibuja un patrón horario.

Se limpian tres capas, porque borrar solo la primera deja el rastro intacto:

  1. Diccionario `/Info` del PDF — el campo Autor clásico.
  2. Paquete XMP — copia paralela en XML que sobrevive a lo anterior (29 PDFs la tenían).
  3. `docProps/` de los ficheros ofimáticos (.docx/.xlsx/.pptx), que además guardan
     `lastModifiedBy`: quién lo tocó el último, no quién lo escribió.

De propina normaliza las fechas del ZIP ofimático: un .docx delata la hora de
edición en la cabecera de cada entrada, no solo en `core.xml`.

Lo que este script NO hace
--------------------------
No toca el texto visible. Un comunicado firmado con nombre y apellidos sigue
firmado después de pasar por aquí, y un PDF "anonimizado" tapando párrafos con
rectángulos negros conserva el texto debajo —se copia y pega—. Eso es una decisión
editorial documento a documento, no algo que se pueda automatizar sin criterio.

Uso
---
    python scripts/limpiar_metadatos.py --check     # audita, no escribe (salida ≠0 si hay restos)
    python scripts/limpiar_metadatos.py             # limpia todo public/docs
    python scripts/limpiar_metadatos.py ruta/al.pdf # limpia un fichero suelto

El nombre va con guion bajo, y no con guion como sus hermanos de esta carpeta,
porque `revisar-y-publicar.py` lo importa como módulo en el paso de publicar.
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Falta PyMuPDF:  pip install pymupdf", file=sys.stderr)
    raise SystemExit(2)

DOCS = Path(__file__).resolve().parent.parent / "public" / "docs"

# Campos de docProps/core.xml y app.xml que apuntan a una persona o a una máquina.
# `dcterms:created`/`modified` entran también: la hora de edición es un dato de patrón.
OFIMATICA_FUERA = (
    "dc:creator", "cp:lastModifiedBy", "cp:lastPrinted", "dc:title", "dc:subject",
    "dc:description", "cp:keywords", "cp:category", "cp:contentStatus",
    "dcterms:created", "dcterms:modified", "cp:revision",
    "Company", "Manager", "Application", "AppVersion", "Template", "TotalTime",
)
ZIP_FECHA_FIJA = (1980, 1, 1, 0, 0, 0)  # el cero del formato ZIP: no dice nada de nadie

# Valores que no son un rastro: ausencia, o el marcador que ya deja algún generador.
VACIOS = {"", "anonymous", "(anonymous)", "(unspecified)", "untitled", "none"}


def _relevante(valor):
    return bool(valor) and valor.strip().lower() not in VACIOS


def inspeccionar(ruta: Path) -> dict:
    """Qué metadatos identificativos lleva el fichero. Solo lee."""
    ruta = Path(ruta)
    encontrado = {}
    if ruta.suffix.lower() == ".pdf":
        try:
            doc = fitz.open(ruta)
        except Exception as e:
            return {"_error": str(e)}
        try:
            for clave, valor in (doc.metadata or {}).items():
                if clave in ("format", "encryption") or not _relevante(valor):
                    continue
                encontrado[clave] = valor.strip()
            if doc.xref_xml_metadata():
                encontrado["xmp"] = "paquete XMP presente"
        finally:
            doc.close()
    elif ruta.suffix.lower() in (".docx", ".xlsx", ".pptx"):
        try:
            with zipfile.ZipFile(ruta) as z:
                for entrada in ("docProps/core.xml", "docProps/app.xml"):
                    if entrada not in z.namelist():
                        continue
                    xml = z.read(entrada).decode("utf-8", "replace")
                    for campo in OFIMATICA_FUERA:
                        m = re.search(rf"<{re.escape(campo)}[^>]*>(.*?)</{re.escape(campo)}>",
                                      xml, re.S)
                        if m and _relevante(m.group(1)):
                            encontrado[campo] = m.group(1).strip()[:80]
        except Exception as e:
            return {"_error": str(e)}
    return encontrado


def _limpiar_pdf(ruta: Path) -> bool:
    doc = fitz.open(ruta)
    try:
        if doc.needs_pass:
            print(f"  aviso: {ruta.name} está cifrado, lo dejo intacto")
            return False
        doc.set_metadata({})       # /Info fuera
        doc.del_xml_metadata()     # XMP fuera
        tmp = ruta.with_suffix(ruta.suffix + ".tmp")
        # `clean` reescribe los objetos y `garbage=4` tira lo que queda huérfano: sin esto
        # el diccionario viejo sigue en el fichero, solo que sin nadie que lo apunte.
        doc.save(tmp, garbage=4, deflate=True, clean=True)
    finally:
        doc.close()
    shutil.move(tmp, ruta)
    return True


def _limpiar_ofimatica(ruta: Path) -> bool:
    tmp = ruta.with_suffix(ruta.suffix + ".tmp")
    with zipfile.ZipFile(ruta) as z_in, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z_out:
        for info in z_in.infolist():
            datos = z_in.read(info.filename)
            if info.filename in ("docProps/core.xml", "docProps/app.xml"):
                xml = datos.decode("utf-8", "replace")
                for campo in OFIMATICA_FUERA:
                    # Vaciar en vez de suprimir el elemento: Word acepta el hueco sin rechistar
                    # y no hay que tocar el esquema.
                    xml = re.sub(rf"(<{re.escape(campo)}[^>]*>).*?(</{re.escape(campo)}>)",
                                 r"\1\2", xml, flags=re.S)
                    xml = re.sub(rf"<{re.escape(campo)}[^>/]*/>", "", xml)
                datos = xml.encode("utf-8")
            nuevo = zipfile.ZipInfo(info.filename, date_time=ZIP_FECHA_FIJA)
            nuevo.compress_type = info.compress_type
            nuevo.external_attr = info.external_attr
            z_out.writestr(nuevo, datos)
    shutil.move(tmp, ruta)
    return True


def limpiar(ruta) -> dict:
    """Deja el fichero sin metadatos de autoría, in situ.

    Devuelve lo que había antes (dict vacío si ya estaba limpio o si el formato no
    se toca). Es idempotente: pasarlo dos veces no rompe nada.
    """
    ruta = Path(ruta)
    if ruta.suffix.lower() not in (".pdf", ".docx", ".xlsx", ".pptx"):
        return {}
    antes = inspeccionar(ruta)
    if "_error" in antes:
        print(f"  aviso: no puedo leer {ruta.name} ({antes['_error']})")
        return {}
    if not antes:
        return {}
    # Una sola pasada no basta siempre: en PDFs con el xref comprimido, la primera
    # reescritura normaliza el fichero pero el diccionario /Info sobrevive, y solo cae
    # en la siguiente. Medido el 13-ago-2026: 14 de 90 seguían sucios tras una pasada,
    # 0 tras dos. Se comprueba en vez de suponerlo — si algo queda, lo dice.
    for _ in range(3):
        try:
            if ruta.suffix.lower() == ".pdf":
                _limpiar_pdf(ruta)
            else:
                _limpiar_ofimatica(ruta)
        except Exception as e:
            print(f"  aviso: fallo limpiando {ruta.name} ({e}); queda como estaba")
            return {}
        if not inspeccionar(ruta):
            return antes
    print(f"  AVISO: {ruta.name} conserva metadatos tras 3 pasadas — míralo a mano "
          f"antes de publicarlo: {inspeccionar(ruta)}")
    return antes


def main(argv):
    # La consola de Windows escribe en cp1252 y aquí salen títulos con acentos, comillas
    # tipográficas y nombres franceses: sin esto el listado muere a media auditoría con
    # UnicodeEncodeError, y lo que no se llegó a imprimir parece limpio.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    solo_check = "--check" in argv
    sueltos = [Path(a) for a in argv if not a.startswith("--")]
    objetivos = sueltos or sorted(
        p for p in DOCS.iterdir()
        if p.suffix.lower() in (".pdf", ".docx", ".xlsx", ".pptx")
    )

    sucios = 0
    for ruta in objetivos:
        hallado = inspeccionar(ruta) if solo_check else limpiar(ruta)
        hallado.pop("_error", None)
        if not hallado:
            continue
        sucios += 1
        autor = hallado.get("author") or hallado.get("dc:creator") or ""
        extra = " ".join(f"{k}={v!r}" for k, v in hallado.items()
                         if k not in ("author", "dc:creator"))
        print(f"  {'·' if solo_check else '✓'} {ruta.name}")
        if autor:
            print(f"      autor: {autor}")
        if extra:
            print(f"      resto: {extra[:150]}")

    print()
    if solo_check:
        print(f"{sucios} de {len(objetivos)} documentos conservan metadatos identificativos.")
        print("Para limpiarlos:  python scripts/limpiar_metadatos.py")
        return 1 if sucios else 0
    print(f"Limpiados {sucios} de {len(objetivos)} documentos.")
    print("Recuerda: esto NO borra nombres del texto visible ni destapa "
          "«anonimizados» hechos con rectángulos negros.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
