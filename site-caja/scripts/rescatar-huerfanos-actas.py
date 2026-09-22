#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rescate único: los documentos que Carlos aprobó y que nunca llegaron a verse.

Qué pasó
--------
Hasta el 21-ago-2026 el Excel de revisión de las 20:00 ofrecía tres secciones —Comunicados,
Otra doc - Soporte y Otra doc - Otros— que escribían en `actas.json` un `tipo`
(`comunicado` / `soporte` / `otros`). El rediseño del 09-ago-2026 quitó de la sección
Documentación los bloques que pintaban esos tipos, porque pasaba a cubrirlos el índice de
documentos del grupo. Nadie tocó el script: siguió aceptando esas tres secciones, copiando
el PDF a `public/docs/`, commiteando y desplegando. Todo correcto salvo lo único que
importaba —`actas-lista.tsx` solo pinta `acta` y `grupo`—, así que lo marcado ahí se
publicaba a ninguna parte.

Resultado: 35 entradas huérfanas. 14 se salvaban de rebote (el mismo fichero estaba
catalogado en el índice del grupo, que sí lo lista), y **21 no se veían en ningún sitio**.

Qué hace esto
-------------
1. Da de alta las invisibles como ADELANTADOS del índice (`anadir` de
   `documentos-overrides.json`), que es la vía prevista para un documento que el grupo aún
   no ha catalogado. Cada entrada lleva su `pdf` ya resuelto: no depende del cruce por
   SHA-256 con `pendientes/`, que para estos ficheros está roto desde que la limpieza de
   metadatos del 20-ago reescribió 125 originales y les cambió el `/ID` del PDF.
2. Retira de `actas.json` las 35 entradas huérfanas: ninguna se renderiza.
   Los ficheros de `public/docs/` **no se tocan**.

CORRECCIÓN (22-ago-2026, mismo día)
-----------------------------------
La primera pasada dio de alta **21** documentos y **17 estaban ya catalogados** por el
grupo bajo otro nombre de fichero, así que salieron duplicados en el índice. El error fue
del criterio de comprobación: se miraba si el *nombre* del fichero publicado aparecía en el
índice, y el grupo cataloga sus propias copias con sus propios nombres («Comunicado CGT
estatal - 23/07/2026» era «Comunicado CGT estatal - 20260723»; del «Pliego de garantías»
había tres copias). Solo comparando el CONTENIDO se ve —y dos de ellos, escaneados, solo
comparando las páginas renderizadas—.

Ahora se compara por contenido con `duplicados.py`, que es el mismo guardián que lleva
`revisar-y-publicar.py` para que no vuelva a pasar por la vía diaria.

**Inéditos de verdad: 4.** El resto ya se veía en la web, con el título que le puso el
grupo. La categoría de esos 4 se fijó leyendo el documento, no el título.

Uso:
    python scripts/rescatar-huerfanos-actas.py --dry-run
    python scripts/rescatar-huerfanos-actas.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from duplicados import huella  # noqa: E402

BASE = Path(__file__).resolve().parent
SITE = BASE.parent
ACTAS = SITE / "src" / "config" / "actas.json"
DOCUMENTOS = SITE / "src" / "config" / "documentos.json"
OVERRIDES = BASE / "documentos-overrides.json"
DOCS = SITE / "public" / "docs"

HUERFANOS = ("comunicado", "soporte", "otros")

# fichero en /docs → categoría del índice.
#
# Solo los cuatro que el grupo NO cataloga. La categoría sale de LEER el documento y de
# imitar dónde coloca el grupo lo parecido, no del título:
#
#  · «Guía para secundar la huelga 24A» — instrucciones prácticas para ejercer el derecho
#    de huelga. Va a difusión por el precedente de «Cómo desafiliarse», que el grupo
#    archiva ahí siendo también un cómo-hacer. Cabría en documentos oficiales por lo
#    jurídico (art. 28.2 CE, RDL 17/1977), pero se sigue el precedente.
#  · «Consolidar y avanzar…» — posición de CCOO ante el referéndum del preacuerdo,
#    dirigida a la plantilla. Es un comunicado sindical.
#  · «El engaño del presupuesto de promociones» — bandas salariales, rotaciones y RSI.
#  · Las dos actas del SIMA (designación de mediador, exp. M/394/2026/K; y reunión sobre
#    la convocatoria de huelga, exp. M/396/2026/H) — el grupo archiva en «otros» las suyas
#    («Acta SIMA») y el preacuerdo CNC. Encajarían en documentos oficiales, pero manda la
#    coherencia con la lista que el lector ve.
CATEGORIA = {
    "guia-huelga-indefinida-desde-24-agosto-2026-en-airbus.pdf": "difusion-y-materiales-de-movilizacion",
    "consolidar-y-avanzar-o-la-huelga-como-fin.pdf": "comunicados-y-convocatorias-de-huelga",
    "el-engano-del-presupuesto-de-promociones.pdf": "datos-economicos-y-salariales",
    "acta-sima-designacion-mediacion-20260804.pdf": "otros",
    "acta-sima-comite-de-huelga-20260821.pdf": "otros",
}


def slug(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]+", "-", s)).strip("-").lower()


def main():
    seco = "--dry-run" in sys.argv

    actas = json.loads(ACTAS.read_text(encoding="utf-8"))
    idx = json.loads(DOCUMENTOS.read_text(encoding="utf-8"))
    ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    ov.setdefault("anadir", {})
    cats = {c["slug"] for c in idx.get("categorias", [])}

    # Qué ficheros de /docs referencia el índice del grupo. Se comparará el CONTENIDO
    # contra ellos, no el nombre: el grupo cataloga su propia copia con su propio nombre,
    # así que comparar nombres da «no está» sobre documentos que sí se ven (17 falsos
    # positivos en la primera pasada; ver la nota de corrección arriba).
    del_grupo = []
    for c in idx.get("categorias", []):
        for x in c.get("documentos", []):
            e = (idx.get("archivos") or {}).get(str(x.get("msgId")))
            if e:
                del_grupo.append(e["pdf"].split("/")[-1])

    # msgId por nombre de fichero de `pendientes/`, para los que lo conserven. Solo sirve
    # para el enlace al grupo; la descarga va en la propia entrada.
    por_nombre = {}
    pend = BASE / "pendientes"
    if pend.exists():
        for p in pend.iterdir():
            m = re.match(r"^\d{4}-\d{2}-\d{2}_(\d+)_(.+)\.[a-z0-9]+$", p.name, re.I) if p.is_file() else None
            if m:
                por_nombre.setdefault(slug(m.group(2)), m.group(1))

    canal = None
    for c in idx.get("categorias", []):
        for d in c.get("documentos", []):
            m = re.search(r"t\.me/c/(\d+)/", d.get("grupoUrl") or "")
            if m:
                canal = m.group(1)
                break
        if canal:
            break

    quitar, anadidos, avisos = [], [], []
    for a in actas["actas"]:
        if a.get("tipo") not in HUERFANOS:
            continue
        quitar.append(a)
        nombre = (a.get("pdf") or "").split("/")[-1]
        base = slug(re.sub(r"\.[a-z0-9]+$", "", nombre))
        mio = huella(DOCS / nombre)
        if mio and any(huella(DOCS / g) == mio for g in del_grupo if (DOCS / g).exists()):
            continue  # ya se ve por el índice del grupo: basta con sacarlo de actas.json
        cat = CATEGORIA.get(nombre)
        if not cat:
            avisos.append(f"sin categoría asignada, lo dejo fuera del índice: {nombre}")
            continue
        if cat not in cats:
            avisos.append(f"la categoría «{cat}» no está en el índice: {nombre}")
            continue
        fichero = DOCS / nombre
        if not fichero.exists():
            avisos.append(f"no encuentro el fichero publicado: {nombre}")
            continue
        kb = round(fichero.stat().st_size / 1024)
        tam = f"{kb / 1024:.1f} MB" if kb >= 1024 else f"{kb} KB"
        fmt = fichero.suffix.lstrip(".").upper() or "PDF"
        msg_id = por_nombre.get(base)
        clave = str(msg_id) if msg_id else f"sin-msg-{base}"
        ov["anadir"][clave] = {
            "categoria": cat,
            "titulo": a.get("titulo") or nombre,
            "fichero": nombre,
            "formato": fmt,
            "fecha": a.get("fecha"),
            "resumen": a.get("cuerpo") or "",
            "grupoUrl": f"https://t.me/c/{canal}/{msg_id}" if (canal and msg_id) else None,
            "versiones": 0,
            "pdf": f"/docs/{nombre}",
            "meta": f"{fmt} · {tam}",
            "porque": "Aprobado en la revisión del Excel entre jul y ago de 2026 y publicado a "
                      "una sección que el rediseño del 09-ago había retirado: el fichero estaba "
                      "en /docs pero no se listaba en ninguna parte.",
            "quitarCuando": "el Grupo Documentación lo catalogue (entonces se ignora solo)",
        }
        anadidos.append((clave, cat, a.get("titulo")))

    actas["actas"] = [a for a in actas["actas"] if a.get("tipo") not in HUERFANOS]

    for clave, cat, titulo in anadidos:
        print(f"  + {clave:>22}  {cat:38} {titulo}")
    for w in avisos:
        print(f"  ! {w}")
    print(f"\n  adelantados al índice: {len(anadidos)}")
    print(f"  retirados de actas.json: {len(quitar)} (de ellos {len(quitar) - len(anadidos) - len(avisos)} "
          f"ya visibles por el índice)")

    if seco:
        print("\n  --dry-run: no he escrito nada.")
        return
    OVERRIDES.write_text(json.dumps(ov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ACTAS.write_text(json.dumps(actas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\n  escrito. Ahora:  npm run snapshot:documentos")


if __name__ == "__main__":
    main()
