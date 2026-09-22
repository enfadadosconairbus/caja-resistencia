#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja de Telegram los documentos de unos mensajes CONCRETOS, por id.

Complemento de `publicar-indice.mjs`: el índice del grupo cataloga documentos que a veces
no están en `scripts/pendientes/` (se subieron antes de que existiera el descargador, o el
dedup por contenido los saltó). Este script los trae por id, con el mismo nombre y el mismo
alta en INDICE.json que usa `descargar-docs.py`, para que el resto del flujo no note la
diferencia.

  python scripts/bajar-mensajes.py 27320 33337

Sale por stdout una línea JSON por documento bajado. Los ids que no traen documento (o que
ya no existen) se avisan por stderr y no rompen la pasada.

Credenciales: las mismas que `descargar-docs.py` (scripts/actas.session + tg.local.json).
"""
import json
import re
import sys
import hashlib
import unicodedata
from pathlib import Path

try:
    from telethon.sync import TelegramClient
    from telethon.tl.functions.messages import CheckChatInviteRequest
except ImportError:
    raise SystemExit("Falta Telethon.  pip install telethon")

BASE = Path(__file__).resolve().parent
SESSION = BASE / "actas.session"
CFG = BASE / "tg.local.json"
PEND = BASE / "pendientes"
INDICE = PEND / "INDICE.json"


def cfg(clave, entorno):
    import os
    return os.environ.get(entorno) or json.loads(CFG.read_text(encoding="utf-8")).get(clave)


def slug(s):
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]+", "-", s)).strip("-").lower()


def resolver_canal(client, ref):
    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:
        return client(CheckChatInviteRequest(m.group(1))).chat
    return client.get_entity(ref)


def nombre_documento(msg):
    doc = msg.document
    if not doc:
        return None
    return next((a.file_name for a in doc.attributes if getattr(a, "file_name", None)),
                f"documento-{msg.id}")


def main(ids):
    api_id, api_hash = cfg("api_id", "TG_API_ID"), cfg("api_hash", "TG_API_HASH")
    canal_ref = cfg("canal", "TG_CANAL")
    if not all([api_id, api_hash, canal_ref]):
        raise SystemExit("Faltan api_id / api_hash / canal.")

    PEND.mkdir(exist_ok=True)
    try:
        indice = json.loads(INDICE.read_text(encoding="utf-8"))
    except Exception:
        indice = {"nota": "Documentos del canal PENDIENTES de revisar.", "documentos": []}
    ya = {d.get("id") for d in indice["documentos"]}

    client = TelegramClient(str(SESSION.with_suffix("")), int(api_id), api_hash)
    client.connect()
    if not client.is_user_authorized():
        client.disconnect()
        raise SystemExit("Sesión de Telegram no iniciada (scripts/actas.session).")

    bajados = 0
    try:
        canal = resolver_canal(client, canal_ref)
        for msg in client.get_messages(canal, ids=[int(i) for i in ids]):
            if msg is None:
                print("aviso: un mensaje ya no existe", file=sys.stderr)
                continue
            nombre = nombre_documento(msg)
            if not nombre:
                print(f"aviso: el mensaje {msg.id} no trae documento", file=sys.stderr)
                continue
            try:
                buf = msg.download_media(file=bytes)
            except Exception as e:
                print(f"aviso: no se pudo bajar {nombre} ({e})", file=sys.stderr)
                continue
            if not buf:
                continue
            fecha = msg.date.date().isoformat() if msg.date else "sin-fecha"
            ext = (re.search(r"(\.[a-z0-9]+)$", nombre, re.I) or [".bin"])[0]
            base = slug(re.sub(r"\.[a-z0-9]+$", "", nombre, flags=re.I)) or "documento"
            archivo = f"{fecha}_{msg.id}_{base}{ext}"
            (PEND / archivo).write_bytes(buf)
            if msg.id not in ya:
                indice["documentos"].append({
                    "id": msg.id,
                    "doc_id": getattr(msg.document, "id", None),
                    "sha256": hashlib.sha256(buf).hexdigest(),
                    "fecha": fecha,
                    "archivo": archivo,
                    "nombre_original": nombre,
                    "caption": (msg.message or "").strip().split("\n")[0][:200],
                    "tipo_sugerido": "indice",
                    "tamano_kb": round(len(buf) / 1024),
                    "revisado": True,
                    "exportado": True,  # viene del índice del grupo: no va al Excel de revisión
                })
                ya.add(msg.id)
            print(json.dumps({"id": msg.id, "archivo": archivo}, ensure_ascii=False))
            bajados += 1
    finally:
        client.disconnect()

    indice["documentos"].sort(key=lambda d: d.get("id") or 0, reverse=True)
    INDICE.write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {bajados} documento(s) bajado(s) a {PEND}.", file=sys.stderr)


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if a.isdigit()]
    if not ids:
        raise SystemExit("Uso: python scripts/bajar-mensajes.py <id> [<id>…]")
    main(ids)
