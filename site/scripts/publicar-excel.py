#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publica un Excel de revisión YA rellenado, sin descargar nada nuevo.

Es la red de seguridad de revisar-y-publicar.py: si en la revisión de las 20:00 se pulsa
Aceptar antes de guardar el Excel (o se cancela y luego se rellena), esos documentos ya
quedaron marcados como `exportado` en el índice y NO vuelven a salir en el delta del día
siguiente. Este script recoge ese Excel concreto y lo publica igual que lo habría hecho
la tarea: copia a public/docs/, da de alta en actas.json / internacional.json, commitea,
push y despliega en Vercel.

Uso:
  python scripts/publicar-excel.py                       # el Excel más reciente de pendientes/revision
  python scripts/publicar-excel.py revision-....xlsx     # uno concreto
  python scripts/publicar-excel.py --dry-run             # solo enseña qué haría
"""
import sys
import importlib.util
from pathlib import Path

BASE = Path(__file__).resolve().parent
REVISION = BASE / "pendientes" / "revision"

# La consola de Windows es cp1252: sin esto, un «→» o una tilde revientan el print.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def cargar_tarea():
    """Importa revisar-y-publicar.py (nombre con guiones: no vale un import normal)."""
    spec = importlib.util.spec_from_file_location("revisar_y_publicar", BASE / "revisar-y-publicar.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def elegir_excel(arg):
    if arg:
        ruta = Path(arg)
        if not ruta.is_absolute():
            ruta = REVISION / ruta if not ruta.exists() else ruta
        return ruta
    xlsx = sorted(REVISION.glob("revision-*.xlsx"), key=lambda p: p.stat().st_mtime)
    return xlsx[-1] if xlsx else None


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv
    t = cargar_tarea()

    xlsx = elegir_excel(args[0] if args else None)
    if not xlsx or not xlsx.exists():
        print(f"No encuentro el Excel: {xlsx or '(ninguno en ' + str(REVISION) + ')'}")
        return 1
    print(f"Excel: {xlsx}")

    filas = t.leer_excel(xlsx)
    marcadas = [f for f in filas if f["subir"] in ("sí", "si", "s", "x", "yes")]
    print(f"{len(filas)} fila(s), {len(marcadas)} marcada(s) para subir:")
    for f in marcadas:
        print(f"  • {f['nombre'] or f['archivo']}  →  {f['seccion']}"
              + (f"  [{f['sede']}]" if f["sede"] else ""))
    if dry:
        print("\n(--dry-run: no se ha tocado nada)")
        return 0
    if not marcadas:
        print("Nada marcado: no hay nada que publicar.")
        return 0

    # Igual que la tarea: sincroniza antes, para no pisar lo que haya subido la nube.
    try:
        rama = t.git("rev-parse", "--abbrev-ref", "HEAD")
        t.git("fetch", "origin", rama)
        t.git("-c", "rebase.autoStash=true", "pull", "--rebase", "origin", rama)
    except Exception as e:
        print(f"AVISO git sync: {e}")

    hechos, avisos = t.publicar(filas)
    for h in hechos:
        print(f"  publicado: {h}")
    for a in avisos:
        print(f"  aviso: {a}")
    if not hechos:
        print("No se publicó nada.")
        return 0

    estado = t.desplegar(len(hechos))
    print(estado)
    t.log(f"[recovery] {len(hechos)} publicado(s) desde {xlsx.name} | {estado}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
