#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revisión + publicación de documentos (flujo de las 20:00, en el PC de Carlos).

Es el paso HUMANO del flujo híbrido. Lo que NO hace: actas y resúmenes del grupo — esos
los publica solo el bot de la nube (userbot-incremental.py). Aquí van los documentos que
Carlos quiere mirar antes de publicar: comunicados, soporte, otros y actas escaneadas.

Secuencia (una sola tarea programada, sin más intervención que revisar el Excel):
  1. Descarga lo nuevo del canal y genera el Excel DELTA (solo lo no revisado antes).
  2. Si no hay nada nuevo → avisa y termina.
  3. Abre el Excel y muestra un diálogo que bloquea hasta que Carlos termina.
  4. Carlos marca ¿Subir? + Sección (+ Sede/Título si aplica), GUARDA y pulsa Aceptar.
  5. Se sincroniza con git (para no pisar las actas que haya subido la nube), copia los
     ficheros marcados a public/docs/, los añade a actas.json, commitea, hace push y
     despliega en Vercel.
  6. Resumen final en un diálogo.

Uso manual:  python scripts/revisar-y-publicar.py
"""
import os
import re
import sys
import json
import ctypes
import shutil
import importlib.util
import subprocess
import unicodedata
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent))
from limpiar_metadatos import limpiar  # noqa: E402  (necesita el sys.path de arriba)
from duplicados import buscar_gemelo  # noqa: E402

BASE = Path(__file__).resolve().parent
SITE = BASE.parent
REPO = SITE.parent.parent.parent
PEND = BASE / "pendientes"
INDICE = PEND / "INDICE.json"
REVISION = PEND / "revision"
DOCS = SITE / "public" / "docs"
ACTAS = SITE / "src" / "config" / "actas.json"
INTERNACIONAL = SITE / "src" / "config" / "internacional.json"
OVERRIDES = BASE / "documentos-overrides.json"
DOCUMENTOS = SITE / "src" / "config" / "documentos.json"
LOG = REVISION / "ultimo-run.log"

# Sección del Excel → tipo en actas.json (sección Documentación).
#
# Solo queda «Acta por centro». Hasta el 21-ago-2026 había tres más —Comunicados, Otra doc
# - Soporte y Otra doc - Otros—, y eran un agujero negro: escribían en actas.json un `tipo`
# que `actas-lista.tsx` dejó de pintar en el rediseño del 09-ago, cuando esos dos bloques
# se sustituyeron por el índice de documentos del grupo. El Excel los siguió ofreciendo
# nueve meses y 21 documentos aprobados por Carlos no llegaron nunca a verse.
SECCIONES = {
    "Acta por centro": "acta",
}

# Sección del Excel → categoría del índice de documentos.
#
# Es el destino de todo lo que no es acta por centro ni internacional. Como el índice lo
# cataloga el Grupo Documentación y este documento no está en él, se da de alta como
# ADELANTADO (`anadir` de documentos-overrides.json), que es la vía que ya existía para
# eso. En cuanto el grupo lo catalogue, su entrada del índice manda y el adelanto se
# ignora solo — de eso se encarga `construirSnapshot()`.
#
# Las etiquetas nombran la categoría de destino en vez de un genérico: antes había que
# adivinar dónde caía «Otra doc - Soporte», y caía en ninguna parte.
CATEGORIAS = {
    "Índice - Comunicados y convocatorias": "comunicados-y-convocatorias-de-huelga",
    "Índice - Datos económicos y salariales": "datos-economicos-y-salariales",
    "Índice - Documentos oficiales y legales": "documentos-oficiales-y-legales",
    "Índice - Reivindicaciones y manifiestos": "reivindicaciones-y-manifiestos",
    "Índice - Cartas abiertas": "cartas-abiertas",
    "Índice - Difusión y movilización": "difusion-y-materiales-de-movilizacion",
    "Índice - Otros": "otros",
    # Etiquetas viejas: siguen valiendo para los Excel ya generados que aún no se hayan
    # revisado. Se quedan sin fecha de caducidad porque no estorban.
    "Comunicados": "comunicados-y-convocatorias-de-huelga",
    "Otra doc - Soporte": "datos-economicos-y-salariales",
    "Otra doc - Otros": "otros",
}

# Estas dos no van a actas.json sino a internacional.json, que page.tsx recorre:
#   · Manifiesto            → lista de idiomas (el «Título web» es el nombre del idioma)
#   · Solidaridad Internac. → lista de comunicados (el «Notas» se añade a la etiqueta, p. ej. "FR")
INTERNACIONALES = {"Solidaridad Internacional", "Manifiesto"}

MB_OKCANCEL, MB_ICONINFO, MB_ICONWARN, MB_TOPMOST = 0x1, 0x40, 0x30, 0x40000
IDOK = 1


def log(msg):
    print(msg)
    try:
        REVISION.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {msg}\n")
    except Exception:
        pass


def aviso(texto, titulo="Caja de Resistencia", flags=MB_ICONINFO):
    return ctypes.windll.user32.MessageBoxW(0, texto, titulo, flags | MB_TOPMOST)


def slug(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]+", "-", s)).strip("-").lower()


def bonito(nombre):
    """Título legible a partir del nombre de fichero, si Carlos no puso uno."""
    base = re.sub(r"\.[a-z0-9]+$", "", nombre, flags=re.I)
    base = re.sub(r"[-_]+", " ", base).strip()
    return (base[:1].upper() + base[1:]) if base else nombre


def git(*args, check=True):
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} → {r.stderr.strip() or r.stdout.strip()}")
    return (r.stdout or "").strip()


def descargar_y_generar_excel():
    """Ejecuta descargar-docs.py (mismo proceso) y devuelve la ruta del Excel delta."""
    spec = importlib.util.spec_from_file_location("descargar_docs", BASE / "descargar-docs.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.main(generar_excel=True)


def leer_excel(ruta):
    from openpyxl import load_workbook
    ws = load_workbook(ruta, data_only=True).active
    cab = [str(c.value or "").strip() for c in ws[1]]
    idx = {n: i for i, n in enumerate(cab)}

    def celda(fila, nombre):
        i = idx.get(nombre)
        return "" if i is None or i >= len(fila) else str(fila[i] or "").strip()

    filas = []
    for fila in ws.iter_rows(min_row=2, values_only=True):
        if not any(fila):
            continue
        filas.append({
            "archivo": celda(fila, "Archivo (abrir)"),
            "subir": celda(fila, "¿Subir?").lower(),
            "seccion": celda(fila, "Sección destino"),
            "sede": celda(fila, "Sede (si es acta)"),
            "titulo": celda(fila, "Título web (opcional)"),
            "nombre": celda(fila, "Nombre original"),
            "fecha": celda(fila, "Fecha"),
            "notas": celda(fila, "Notas"),
        })
    return filas


def nombre_destino(titulo, archivo_origen):
    ext = (re.search(r"(\.[a-z0-9]+)$", archivo_origen, re.I) or [".pdf"])[0].lower()
    base = slug(titulo) or slug(re.sub(r"\.[a-z0-9]+$", "", archivo_origen, flags=re.I)) or "documento"
    destino = DOCS / f"{base}{ext}"
    n = 2
    while destino.exists():
        destino = DOCS / f"{base}-{n}{ext}"
        n += 1
    return destino


def categorias_del_indice():
    """Slugs de categoría que el índice tiene ahora mismo, según el último snapshot.

    Un adelantado solo se ve si su categoría existe en el índice: `construirSnapshot()`
    recorre las categorías del índice y cuelga de ellas los adelantos. Si el slug no casa,
    la entrada se escribe y no se ve —exactamente el fallo que este cambio viene a cerrar—,
    así que se comprueba antes y se avisa.
    """
    try:
        d = json.loads(DOCUMENTOS.read_text(encoding="utf-8"))
        return {c["slug"] for c in d.get("categorias", [])}
    except Exception:
        return set()


def canal_del_indice():
    """Id interno del grupo, para componer el enlace `t.me/c/<grupo>/<msgId>`.

    Se saca de un enlace que ya esté en el índice en vez de escribirlo aquí: el id no es un
    secreto (viaja en el snapshot), pero tenerlo en un sitio solo evita que dos ficheros
    digan cosas distintas si algún día cambia el canal.
    """
    try:
        d = json.loads(DOCUMENTOS.read_text(encoding="utf-8"))
        for c in d.get("categorias", []):
            for doc in c.get("documentos", []):
                m = re.search(r"t\.me/c/(\d+)/", doc.get("grupoUrl") or "")
                if m:
                    return m.group(1)
    except Exception:
        pass
    return None


def anadir_al_indice(entrada, msg_id, nombre_original):
    """Da de alta un documento en `anadir` de documentos-overrides.json.

    La clave es el id del mensaje de Telegram, que es lo que casa con el índice del grupo
    cuando este acabe catalogándolo (y entonces el adelanto se ignora solo). Para lo que se
    publicó sin ese id se usa una clave `sin-msg-<slug>`, que `leerOverrides()` acepta
    dejando `msgId` a null.

    La descarga viaja DENTRO de la entrada (`pdf` + `meta`) en vez de dejarla al mapa
    `archivos`: ese mapa une por SHA-256 el fichero de `pendientes/` con su copia publicada,
    y ese hash se rompe con solo volver a limpiar los metadatos del original —PyMuPDF
    regenera el `/ID` del PDF al guardar—. Pasó el 20-ago-2026: la limpieza de metadatos
    reescribió 125 ficheros de `pendientes/` y dejó sin unión a los ya publicados. Aquí
    somos nosotros quienes copiamos el fichero, así que el nombre se sabe y se anota.
    """
    ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    ov.setdefault("anadir", {})
    clave = str(msg_id) if msg_id else f"sin-msg-{slug(nombre_original or entrada['titulo'])}"
    ov["anadir"][clave] = entrada
    OVERRIDES.write_text(json.dumps(ov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return clave


def copiar_limpio(origen, destino):
    """Copia a public/docs y le quita los metadatos de autoría por el camino.

    El paso no es opcional ni va aparte: lo que entra en `public/docs` es público, y un PDF
    publica su campo Autor a un clic. Ya se coló una tanda con matrículas de Airbus dentro
    (ver `limpiar_metadatos.py`). Poniéndolo aquí, en el único punto por el que pasan todos
    los documentos, no depende de que nadie se acuerde.

    Se limpia el ORIGEN y después se copia, y no al revés: `mapaArchivos()` de
    `lib-documentos.mjs` sabe qué está publicado comparando el SHA-256 del fichero de
    `pendientes/` con el de `public/docs/`, y limpiar solo la copia deja los dos ficheros
    distintos —el documento vuelve a contar como no publicado y la tarea de las 10:30 lo
    republica, sucio y con otro nombre (pasó el 14-ago-2026 con 81 documentos)—.
    """
    habia = limpiar(origen)
    shutil.copy2(origen, destino)
    if habia:
        autor = habia.get("author") or habia.get("dc:creator")
        log(f"  metadatos borrados de {destino.name}" + (f" (autor: {autor})" if autor else ""))
    return destino


def publicar(filas):
    """Copia los ficheros marcados y los da de alta donde toque. Tres destinos:

      · actas.json          → «Acta por centro» (la sección Documentación las agrupa por sede)
      · internacional.json  → Manifiesto / Solidaridad Internacional
      · documentos-overrides.json → todo lo demás, como adelanto del índice de documentos

    Devuelve (hechos, avisos).
    """
    doc = json.loads(ACTAS.read_text(encoding="utf-8"))
    doc["ejemplo"] = False
    ya = {a.get("pdf") for a in doc["actas"] if a.get("pdf")}
    inter = json.loads(INTERNACIONAL.read_text(encoding="utf-8"))
    inter_cambiado = False
    indice = json.loads(INDICE.read_text(encoding="utf-8"))
    por_archivo = {d.get("archivo"): d for d in indice["documentos"]}
    cats_indice = categorias_del_indice()
    canal = canal_del_indice()

    hechos, avisos = [], []
    for f in filas:
        if f["subir"] not in ("sí", "si", "s", "x", "yes"):
            continue
        origen = PEND / f["archivo"]
        if not f["archivo"] or not origen.exists():
            avisos.append(f"No encuentro el fichero: {f['archivo'] or '(vacío)'}")
            continue
        seccion = f["seccion"]

        if seccion in INTERNACIONALES:
            if seccion == "Manifiesto" and not f["titulo"]:
                avisos.append("«Manifiesto» necesita el idioma en «Título web» "
                              f"(p. ej. Italiano): {f['nombre'] or f['archivo']}")
                continue
            titulo = f["titulo"] or bonito(f["nombre"] or f["archivo"])
            # El manifiesto mantiene su convención de nombre por idioma.
            base = f"manifiesto-airbus-{titulo}" if seccion == "Manifiesto" else titulo
            destino = nombre_destino(base, f["archivo"])
            copiar_limpio(origen, destino)
            url = f"/docs/{destino.name}"
            lista = inter["manifiestoIdiomas"] if seccion == "Manifiesto" else inter["comunicados"]
            if any(x.get("pdf") == url for x in lista):
                avisos.append(f"Ya estaba en «{seccion}», me lo salto: {destino.name}")
                continue
            if seccion == "Manifiesto":
                lista.append({"label": titulo, "pdf": url})
            else:
                kb = round(destino.stat().st_size / 1024)
                tam = f"{kb / 1024:.1f} MB" if kb >= 1024 else f"{kb} KB"
                etiqueta = f"PDF · {tam}" + (f" · {f['notas']}" if f["notas"] else "")
                lista.append({"titulo": titulo, "pdf": url, "meta": etiqueta})
            inter_cambiado = True
            hechos.append(f"{titulo}  →  {seccion}")
            por_archivo.get(f["archivo"], {})["publicado"] = True
            continue

        if seccion in CATEGORIAS:
            categoria = CATEGORIAS[seccion]
            if cats_indice and categoria not in cats_indice:
                avisos.append(f"La categoría «{categoria}» no está en el índice, me lo salto: "
                              f"{f['nombre'] or f['archivo']}")
                continue
            # El índice casa por id de mensaje, y el mismo PDF circula reenviado con ids
            # distintos: sin mirar el contenido, un repost entra como documento nuevo y se
            # publica dos veces con dos títulos. Pasó con 17 documentos el 22-ago-2026.
            gemelo = buscar_gemelo(origen, DOCS)
            if gemelo:
                avisos.append(f"Ya está publicado como «{gemelo}» (mismo contenido, otro "
                              f"nombre), me lo salto: {f['nombre'] or f['archivo']}")
                por_archivo.get(f["archivo"], {})["publicado"] = True
                continue
            msg_id = (por_archivo.get(f["archivo"]) or {}).get("id")
            titulo = f["titulo"] or bonito(f["nombre"] or f["archivo"])
            destino = nombre_destino(titulo, f["archivo"])
            copiar_limpio(origen, destino)
            kb = round(destino.stat().st_size / 1024)
            tam = f"{kb / 1024:.1f} MB" if kb >= 1024 else f"{kb} KB"
            entrada = {
                "categoria": categoria,
                "titulo": titulo,
                "fichero": f["nombre"] or destino.name,
                "formato": (destino.suffix.lstrip(".").upper() or "PDF"),
                "fecha": f["fecha"] or None,
                # El «Notas» del Excel hace de resumen; el índice del grupo trae uno y aquí
                # no hay de dónde sacarlo. Sin él la tarjeta sale con el título solo.
                "resumen": f["notas"] or "",
                "grupoUrl": f"https://t.me/c/{canal}/{msg_id}" if (canal and msg_id) else None,
                "versiones": 0,
                "pdf": f"/docs/{destino.name}",
                "meta": f"{(destino.suffix.lstrip('.').upper() or 'PDF')} · {tam}",
                "porque": f"Aprobado en la revisión del {datetime.now():%d-%m-%Y} y no catalogado "
                          "en el índice del grupo.",
                "quitarCuando": "el Grupo Documentación lo catalogue (entonces se ignora solo)",
            }
            anadir_al_indice(entrada, msg_id, f["nombre"] or f["archivo"])
            hechos.append(f"{titulo}  →  {seccion}")
            por_archivo.get(f["archivo"], {})["publicado"] = True
            continue

        tipo = SECCIONES.get(seccion)
        if not tipo:
            avisos.append(f"Sin sección válida, me lo salto: {f['nombre'] or f['archivo']}")
            continue
        if tipo == "acta" and not f["sede"]:
            avisos.append(f"«Acta por centro» sin Sede, me lo salto: {f['nombre'] or f['archivo']}")
            continue

        titulo = f["titulo"] or bonito(f["nombre"] or f["archivo"])
        destino = nombre_destino(titulo, f["archivo"])
        copiar_limpio(origen, destino)
        url = f"/docs/{destino.name}"
        if url in ya:
            avisos.append(f"Ya estaba publicado, me lo salto: {destino.name}")
            continue
        kb = round(destino.stat().st_size / 1024)
        etiqueta = (destino.suffix.lstrip(".").upper() or "PDF")
        tam = f"{kb / 1024:.1f} MB" if kb >= 1024 else f"{kb} KB"
        doc["actas"].append({
            "tipo": tipo,
            "site": f["sede"] or None,
            "fecha": f["fecha"] or None,
            "titulo": titulo,
            "cuerpo": "",
            "pdf": url,
            "meta": f"{etiqueta} · {tam}",
        })
        ya.add(url)
        hechos.append(f"{titulo}  →  {seccion}")
        por_archivo.get(f["archivo"], {})["publicado"] = True

    if any(h for h in hechos):
        doc["actas"].sort(key=lambda a: (a.get("fecha") or ""), reverse=True)
        ACTAS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if inter_cambiado:
        INTERNACIONAL.write_text(json.dumps(inter, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return hechos, avisos


def refrescar_indice():
    """Rehace src/config/documentos.json tras publicar.

    El índice de documentos del grupo enlaza a mensajes privados de Telegram; lo que los
    convierte en descarga es el mapa `archivos`, que se calcula uniendo por hash lo que hay
    en public/docs con lo bajado en pendientes/. Si no se rehace aquí, un documento recién
    publicado se queda catalogado pero sin botón de descarga hasta la siguiente pasada.
    """
    r = subprocess.run(["node", "scripts/snapshot-documentos.mjs"], cwd=SITE,
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        log(f"AVISO snapshot documentos: {(r.stderr or r.stdout or '').strip()[-300:]}")
        return "no se pudo refrescar el índice de documentos"
    return "índice de documentos refrescado"


def desplegar(n):
    rama = git("rev-parse", "--abbrev-ref", "HEAD")
    log(refrescar_indice())
    git("add", "clientes/caja-resistencia/site/public/docs",
        "clientes/caja-resistencia/site/src/config/actas.json",
        "clientes/caja-resistencia/site/src/config/documentos.json",
        "clientes/caja-resistencia/site/src/config/internacional.json")
    if not git("diff", "--staged", "--name-only"):
        return "No había cambios que commitear."
    git("commit", "-m", f"docs: publicar {n} documento(s) revisado(s)\n\n"
                        "Revisados a mano por Carlos en el Excel de revisión y publicados\n"
                        "por scripts/revisar-y-publicar.py.\n\n"
                        "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>")
    git("push", "origin", f"HEAD:{rama}")
    # Si el CLI global no está en el PATH (p. ej. tras reinstalar Node), se cae a npx.
    ultimo = ""
    for cmd in ("vercel --prod --yes", "npx --yes vercel --prod --yes"):
        r = subprocess.run(cmd, cwd=SITE, shell=True,
                           capture_output=True, text=True, encoding="utf-8")
        if r.returncode == 0:
            return "Desplegado en https://caja-resistencia-demo.vercel.app"
        ultimo = (r.stderr or r.stdout or "")[-500:]
    raise RuntimeError(f"Vercel falló: {ultimo}")


def main():
    log("=== Inicio revisión 20:00 ===")
    try:
        xlsx = descargar_y_generar_excel()
    except Exception as e:
        log(f"ERROR descargando: {e}")
        aviso(f"No pude descargar del canal:\n\n{e}", "Error", MB_ICONWARN)
        return 1

    if not xlsx:
        log("Sin documentos nuevos.")
        aviso("No hay documentos nuevos que revisar hoy.\n\nNada que publicar.", "Sin novedades")
        return 0

    # Sincroniza ANTES de tocar nada, para no pisar las actas que haya publicado la nube.
    try:
        rama = git("rev-parse", "--abbrev-ref", "HEAD")
        git("fetch", "origin", rama)
        git("-c", "rebase.autoStash=true", "pull", "--rebase", "origin", rama)
    except Exception as e:
        log(f"AVISO git sync: {e}")
        aviso(f"No pude sincronizar con git (sigo igualmente):\n\n{e}", "Aviso", MB_ICONWARN)

    os.startfile(str(xlsx))
    r = aviso(
        f"Se ha abierto el Excel de revisión:\n{xlsx.name}\n\n"
        "1) Marca «¿Subir?» = Sí en lo que quieras publicar.\n"
        "2) Elige «Sección destino» (y «Sede» si es un acta).\n"
        "3) Opcional: pon el «Título web».\n"
        "4) GUARDA el Excel (Ctrl+S) y ciérralo.\n\n"
        "⚠️ GUARDA ANTES de pulsar ACEPTAR: si aceptas con el Excel sin guardar,\n"
        "no se publicará nada y estos documentos ya no volverán a salir mañana.\n\n"
        "Cuando hayas GUARDADO, pulsa ACEPTAR para publicar en la web.\n"
        "(CANCELAR = no publicar nada ahora; se recupera luego, ver abajo.)",
        "Revisa los documentos", MB_OKCANCEL)
    if r != IDOK:
        log("Cancelado por el usuario.")
        aviso("No se ha publicado nada.\n\nEl Excel sigue disponible en:\n"
              f"{xlsx}\n\nRellénalo cuando quieras y publícalo con:\n"
              "  python scripts/publicar-excel.py\n\n"
              "(NO relanzes esta tarea: estos documentos ya no saldrían en el Excel de mañana.)",
              "Cancelado")
        return 0

    try:
        filas = leer_excel(xlsx)
        hechos, avisos_ = publicar(filas)
    except Exception as e:
        log(f"ERROR publicando: {e}")
        aviso(f"Error al procesar el Excel:\n\n{e}", "Error", MB_ICONWARN)
        return 1

    estado = ""
    if hechos:
        try:
            estado = desplegar(len(hechos))
        except Exception as e:
            log(f"ERROR desplegando: {e}")
            aviso(f"Se copiaron los ficheros pero falló el despliegue:\n\n{e}\n\n"
                  "Los cambios están en local; puedes desplegar a mano con: vercel --prod",
                  "Error al desplegar", MB_ICONWARN)
            return 1

    partes = []
    partes.append(f"Publicados: {len(hechos)}" if hechos else "No se publicó ningún documento.")
    if hechos:
        partes.append("\n".join(f"  • {h}" for h in hechos))
    else:
        # Caso típico: se aceptó con el Excel sin guardar. Como el delta ya los marcó como
        # exportados, no volverán a salir mañana: hay que recuperarlos con este Excel.
        partes.append(f"\n¿Habías marcado cosas? Entonces el Excel no estaba guardado.\n"
                      f"Guárdalo:\n{xlsx}\n\ny publícalo con:\n"
                      "  python scripts/publicar-excel.py\n\n"
                      "NO relanzes la tarea: estos documentos ya no saldrán mañana.")
    if avisos_:
        partes.append("\nAvisos:\n" + "\n".join(f"  • {a}" for a in avisos_))
    if estado:
        partes.append(f"\n{estado}")
    resumen = "\n".join(partes)
    log(resumen.replace("\n", " | "))
    aviso(resumen, "Revisión terminada")
    return 0


if __name__ == "__main__":
    sys.exit(main())
