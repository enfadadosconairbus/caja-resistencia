#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Descargador LOCAL de documentos del canal → carpeta de revisión (para Carlos).

Corre en el PC de Carlos vía el Programador de tareas de Windows (cada 24 h, con
recuperación si el PC estaba apagado). Baja los DOCUMENTOS nuevos del canal (PDF, docx,
xlsx…) a `scripts/pendientes/` para que Carlos los revise y decida cuáles publicar.

⚠️ Esto NO publica nada. Los bytes se quedan EN LOCAL (la carpeta está en .gitignore):
   nunca llegan al repo ni a la web. Publicar es manual: revisas pendientes/ y subes lo
   bueno a public/docs/ + src/config/actas.json.

Credenciales (una cuenta de Telegram tuya, en LOCAL — no la de la nube):
  · Sesión: reutiliza scripts/actas.session (la del backfill; por eso NO se borra).
  · api_id/api_hash y enlace del canal: de variables de entorno o de scripts/tg.local.json
    (gitignored): {"api_id": 123456, "api_hash": "…", "canal": "https://t.me/+…"}.
"""
import os
import re
import sys
import json
import hashlib
import unicodedata
from pathlib import Path

try:
    from telethon.sync import TelegramClient
    from telethon.tl.functions.messages import CheckChatInviteRequest
except ImportError:
    raise SystemExit("Falta Telethon.  pip install telethon")

# Windows: la consola por defecto (cp1252) no sabe codificar el «✓»/«·» de los prints y
# lanzaría UnicodeEncodeError DESPUÉS de descargar bien —revisar-y-publicar.py lo tomaría
# por un fallo de descarga—. Forzar UTF-8 lo evita sin cambiar nada más.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE = Path(__file__).resolve().parent
SESSION = BASE / "actas.session"        # sesión local (tu cuenta) — reutiliza la del backfill
CFG = BASE / "tg.local.json"            # gitignored: api_id/api_hash/canal
PEND = BASE / "pendientes"              # carpeta de revisión — gitignored
INDICE = PEND / "INDICE.json"           # metadatos de lo descargado (para revisar)
REVISION = PEND / "revision"            # Excels de revisión (delta incremental) — gitignored
STATE = BASE / "descarga-state.json"    # {last_id} — local, gitignored

SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"]
ALIAS = {"Puerto Real": "Cádiz"}


def cfg(clave, entorno):
    v = os.environ.get(entorno)
    if v:
        return v
    try:
        return json.loads(CFG.read_text(encoding="utf-8")).get(clave)
    except Exception:
        return None


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").upper()


def slug(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]+", "-", s)).strip("-").lower()


def tipo_sugerido(nombre, caption):
    """Solo una PISTA para que Carlos ordene; no decide nada."""
    t = norm(f"{nombre} {caption or ''}")
    if "COMUNICADO" in t:
        return "comunicado"
    if re.search(r"\b(ACTA|MINUTA|MINUTAS|ASAMBLEA|RESUMEN)\b", t):
        return "acta"
    for s in SITES:
        if norm(s) in t:
            return "site"
    for a in ALIAS:
        if norm(a) in t:
            return "site"
    if re.search(r"\b(DOSSIER|INFORME|TABLA|TABLAS|SALARIAL|DATOS|SENTENCIA|BOE)\b", t):
        return "soporte"
    return "otros"


def leer_json(p, defecto):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return defecto


def canal_id_conocido():
    """Id interno del canal, si ya lo conocemos, para resolverlo SIN el enlace de invitación.

    El enlace `t.me/+…` caduca (pasó el 14-sep-2026: rompió la tarea con «The chat the user
    tried to join has expired … CheckChatInviteRequest»). El id interno, en cambio, no caduca
    y viaja estable en dos sitios: `descarga-state.json` (lo cacheamos al resolver) y
    `documentos.json`, dentro de los enlaces `t.me/c/<id>/<msgId>` del índice del grupo.
    """
    cid = leer_json(STATE, {}).get("canal_id")
    if cid:
        return int(cid)
    try:
        docs = json.loads((BASE / ".." / "src" / "config" / "documentos.json").read_text(encoding="utf-8"))
        for c in docs.get("categorias", []):
            for doc in c.get("documentos", []):
                m = re.search(r"t\.me/c/(\d+)/", doc.get("grupoUrl") or "")
                if m:
                    return int(m.group(1))
    except Exception:
        pass
    return None


def resolver_canal(client, ref):
    """Resuelve el canal de forma resistente a que el enlace de invitación caduque.

    La cuenta YA es miembro (lleva meses bajando), así que para LEER no necesita el enlace.
    Orden: 1) id interno conocido, resuelto desde la caché de la sesión —no caduca—;
    2) el enlace de invitación, que solo hace falta la primera vez para entrar; 3) si el
    enlace caducó pero seguimos dentro, buscamos el canal por id entre los diálogos.
    """
    from telethon.tl.types import PeerChannel
    from telethon.tl.functions.messages import ImportChatInviteRequest
    from telethon.errors import (InviteHashExpiredError, InviteHashInvalidError,
                                 UserAlreadyParticipantError)

    cid = canal_id_conocido()
    if cid:
        try:
            return client.get_entity(PeerChannel(cid))  # access_hash cacheado en la sesión
        except Exception:
            pass  # aún no cacheado: seguimos con el enlace / diálogos

    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:
        h = m.group(1)
        try:
            return client(ImportChatInviteRequest(h)).chats[0]
        except UserAlreadyParticipantError:
            return client(CheckChatInviteRequest(h)).chat
        except (InviteHashExpiredError, InviteHashInvalidError):
            # El enlace caducó pero la membresía sigue: localiza el canal por id (si lo
            # sabemos) o, en su defecto, el único canal privado de los diálogos.
            for d in client.iter_dialogs():
                if getattr(d, "is_channel", False) and (cid is None or d.entity.id == cid):
                    return d.entity
            raise
    return client.get_entity(ref)


def es_documento(msg):
    doc = msg.document
    if not doc:
        return None
    nombre = next((a.file_name for a in doc.attributes if getattr(a, "file_name", None)), None)
    mime = (getattr(doc, "mime_type", "") or "").lower()
    # Documentos ofimáticos / PDF; descartamos fotos, vídeos, audios, stickers.
    ofimatico = nombre and re.search(r"\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|csv|txt|rtf)$", nombre, re.I)
    if ofimatico or mime == "application/pdf" or "officedocument" in mime or "msword" in mime:
        return nombre or f"documento-{msg.id}"
    return None


def generar_xlsx_revision(indice):
    """Excel de revisión INCREMENTAL: un delta con los documentos aún NO exportados a un
    Excel anterior. Cada fila enlaza al fichero en tu disco (para abrirlo y revisarlo) y trae
    desplegables para marcar si lo subes y a qué sección. Marca los incluidos como
    exportado=true (así el próximo Excel solo trae lo nuevo). Devuelve la ruta, o None.

    Cubre Comunicados y Otra Documentación; también incluye actas escaneadas (PDF), que la
    nube no puede auto-publicar (solo publica texto). El texto de actas/resúmenes lo sube
    solo el bot de la nube, no aparece aquí.
    """
    try:
        from datetime import datetime
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.worksheet.datavalidation import DataValidation
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("  aviso: falta openpyxl (pip install openpyxl); no se generó el Excel de revisión.")
        return None

    # Lo que ya publicó el índice del grupo (tarea de las 10:30) no se vuelve a revisar:
    # el Excel es para lo que el índice NO cataloga (manifiestos por idioma, solidaridad
    # internacional, actas escaneadas por centro). Si no, pedirías revisar lo ya publicado.
    ya_publicados = set()
    try:
        docs = json.loads((BASE / ".." / "src" / "config" / "documentos.json").read_text(encoding="utf-8"))
        ya_publicados = {int(k) for k in (docs.get("archivos") or {}) if str(k).isdigit()}
    except Exception:
        pass

    nuevos = [d for d in indice["documentos"]
              if not d.get("exportado") and d.get("id") not in ya_publicados]
    for d in indice["documentos"]:
        if d.get("id") in ya_publicados and not d.get("exportado"):
            d["exportado"] = True  # publicado por el índice: fuera del delta para siempre
    if not nuevos:
        return None

    # Agrupa por tipo (Comunicados y Otra doc primero) y, dentro, lo más reciente arriba.
    orden = {"comunicado": 0, "soporte": 1, "otros": 2, "acta": 3, "site": 4}
    nuevos.sort(key=lambda d: str(d.get("fecha") or ""), reverse=True)
    nuevos.sort(key=lambda d: orden.get(d.get("tipo_sugerido"), 9))

    REVISION.mkdir(exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Revisión"
    cab = ["Fecha", "Tipo sugerido", "Nombre original", "Descripción", "Tamaño",
           "Archivo (abrir)", "¿Subir?", "Sección destino", "Sede (si es acta)",
           "Título web (opcional)", "Notas"]
    ws.append(cab)
    hdr_fill = PatternFill("solid", fgColor="1F2A44")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = hdr_fill
        c.alignment = Alignment(vertical="center")
    ws.freeze_panes = "A2"

    link_font = Font(color="0563C1", underline="single")
    for d in nuevos:
        archivo = d.get("archivo") or ""
        kb = d.get("tamano_kb")
        tam = (f"{kb / 1024:.1f} MB" if kb and kb >= 1024 else (f"{kb} KB" if kb else ""))
        ws.append([d.get("fecha") or "", d.get("tipo_sugerido") or "", d.get("nombre_original") or "",
                   d.get("caption") or "", tam, archivo, "", "", "", "", ""])
        celda = ws.cell(row=ws.max_row, column=6)
        ruta = PEND / archivo
        if archivo and ruta.exists():
            celda.hyperlink = ruta.resolve().as_uri()
            celda.font = link_font
        d["exportado"] = True

    # Las secciones «Comunicados», «Otra doc - Soporte» y «Otra doc - Otros» desaparecieron
    # el 21-ago-2026: escribían en actas.json un tipo que la web dejó de pintar en el
    # rediseño del 09-ago, así que lo marcado ahí no se veía. Ahora cada opción nombra la
    # categoría del índice de documentos donde acaba, que es la lista viva.
    # Deben coincidir con CATEGORIAS/SECCIONES de revisar-y-publicar.py.
    SECCIONES = [
        "Índice - Comunicados y convocatorias",
        "Índice - Datos económicos y salariales",
        "Índice - Documentos oficiales y legales",
        "Índice - Reivindicaciones y manifiestos",
        "Índice - Cartas abiertas",
        "Índice - Difusión y movilización",
        "Índice - Otros",
        "Acta por centro",
        "Solidaridad Internacional",
        "Manifiesto",
        "No subir",
    ]
    SEDES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"]

    # Las listas van en una hoja aparte y no embebidas en la fórmula: una lista literal
    # (`"a,b,c"`) no puede pasar de 255 caracteres y estas ya no caben. La hoja se oculta
    # para que el Excel siga teniendo una sola pestaña a la vista.
    listas = wb.create_sheet("Listas")
    for i, v in enumerate(SECCIONES, start=1):
        listas.cell(row=i, column=1, value=v)
    for i, v in enumerate(SEDES, start=1):
        listas.cell(row=i, column=2, value=v)
    listas.sheet_state = "hidden"

    dv_si = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
    dv_sec = DataValidation(
        type="list", allow_blank=True,
        formula1=f"Listas!$A$1:$A${len(SECCIONES)}")
    dv_sede = DataValidation(
        type="list", allow_blank=True,
        formula1=f"Listas!$B$1:$B${len(SEDES)}")
    for dv in (dv_si, dv_sec, dv_sede):
        ws.add_data_validation(dv)
    fin = ws.max_row
    if fin >= 2:
        dv_si.add(f"G2:G{fin}")
        dv_sec.add(f"H2:H{fin}")
        dv_sede.add(f"I2:I{fin}")

    for i, w in enumerate([12, 14, 38, 44, 10, 40, 9, 24, 16, 34, 26], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ruta_xlsx = REVISION / f"revision-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xlsx"
    wb.save(ruta_xlsx)
    return ruta_xlsx


def main(generar_excel=True):
    """Descarga los documentos nuevos. `generar_excel=False` (flag --sin-excel) solo baja
    ficheros: se usa en la pasada de la mañana, para que el DELTA se acumule y salga un
    único Excel en la revisión de la tarde."""
    api_id, api_hash = cfg("api_id", "TG_API_ID"), cfg("api_hash", "TG_API_HASH")
    canal_ref = cfg("canal", "TG_CANAL")
    if not all([api_id, api_hash, canal_ref]):
        raise SystemExit("Faltan api_id / api_hash / canal (en scripts/tg.local.json o variables de entorno).")

    PEND.mkdir(exist_ok=True)
    indice = leer_json(INDICE, {"nota": "Documentos del canal PENDIENTES de revisar. Nada se publica solo. "
                                        "Sube a la web solo lo que valga (public/docs + actas.json).",
                                "documentos": []})
    vistos = {d.get("id") for d in indice["documentos"]}
    # Dedup por CONTENIDO: los reenvíos/re-subidas del mismo fichero no se vuelven a bajar.
    seen_docids = {d.get("doc_id") for d in indice["documentos"] if d.get("doc_id")}
    seen_hashes = {d.get("sha256") for d in indice["documentos"] if d.get("sha256")}
    last_id = leer_json(STATE, {}).get("last_id", 0)
    max_id, nuevos = last_id, 0

    client = TelegramClient(str(SESSION.with_suffix("")), int(api_id), api_hash)
    client.connect()
    if not client.is_user_authorized():
        # Primera vez: solo se puede iniciar sesión en una CONSOLA (pide teléfono + código).
        # En la tarea programada (sin consola) se avisa y se sale, para no colgarse.
        if sys.stdin and sys.stdin.isatty():
            print("Sesión no iniciada. Introduce el teléfono y el código de Telegram:")
            client.start()
        else:
            client.disconnect()
            raise SystemExit("Sesión de Telegram no iniciada. Ejecuta el script UNA VEZ en una "
                             "consola (python scripts/descargar-docs.py) para el login antes de programar la tarea.")
    try:
        canal = resolver_canal(client, canal_ref)
        canal_id = getattr(canal, "id", None)
        for msg in client.iter_messages(canal, min_id=last_id, reverse=True):
            max_id = max(max_id, msg.id)
            if msg.id in vistos:
                continue
            nombre = es_documento(msg)
            if not nombre:
                continue
            # Dedup barato por id de documento (los reenvíos comparten document.id): sin descargar.
            docid = getattr(msg.document, "id", None)
            if docid is not None and docid in seen_docids:
                continue
            try:
                buf = msg.download_media(file=bytes)
            except Exception as e:
                print(f"  aviso: no se pudo bajar {nombre} ({e})")
                continue
            if not buf:
                continue
            h = hashlib.sha256(buf).hexdigest()
            if h in seen_hashes:  # mismo contenido re-subido con otro id: no duplicar
                if docid is not None:
                    seen_docids.add(docid)
                continue
            fecha = msg.date.date().isoformat() if msg.date else "sin-fecha"
            ext = (re.search(r"(\.[a-z0-9]+)$", nombre, re.I) or [".bin"])[0]
            base_slug = slug(re.sub(r"\.[a-z0-9]+$", "", nombre, flags=re.I)) or "documento"
            archivo = f"{fecha}_{msg.id}_{base_slug}{ext}"
            destino = PEND / archivo
            destino.write_bytes(buf)
            seen_hashes.add(h)
            if docid is not None:
                seen_docids.add(docid)
            indice["documentos"].append({
                "id": msg.id,
                "doc_id": docid,
                "sha256": h,
                "fecha": fecha,
                "archivo": archivo,
                "nombre_original": nombre,
                "caption": (msg.message or "").strip().split("\n")[0][:200],
                "tipo_sugerido": tipo_sugerido(nombre, msg.message),
                "tamano_kb": round(len(buf) / 1024),
                "revisado": False,
            })
            vistos.add(msg.id)
            nuevos += 1
    finally:
        client.disconnect()

    # Excel de revisión: delta con lo aún no exportado (marca exportado=true en el índice).
    ruta_xlsx = generar_xlsx_revision(indice) if generar_excel else None

    if nuevos > 0 or ruta_xlsx:
        indice["documentos"].sort(key=lambda d: d.get("id") or 0, reverse=True)
        INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    estado = {"last_id": max_id}
    if canal_id:
        estado["canal_id"] = canal_id  # resuelto sin depender del enlace; se auto-cura
    STATE.write_text(json.dumps(estado) + "\n", encoding="utf-8")
    print(f"✓ {nuevos} documento(s) nuevo(s) en {PEND}. Total en cola: {len(indice['documentos'])}. last_id: {max_id}.")
    if ruta_xlsx:
        print(f"✓ Excel de revisión (delta): {ruta_xlsx}")
    elif generar_excel:
        print("· Sin documentos nuevos que revisar: no se generó Excel.")
    else:
        print("· Solo descarga (--sin-excel): el delta se acumula para la revisión de la tarde.")
    return ruta_xlsx


if __name__ == "__main__":
    main(generar_excel="--sin-excel" not in sys.argv)
