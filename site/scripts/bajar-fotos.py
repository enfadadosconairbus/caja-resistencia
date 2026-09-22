#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baja FOTOS concretas del grupo, por id de mensaje, a una carpeta de revisión.

Hermano de `bajar-mensajes.py`, que solo trae documentos ofimáticos: las fotos van en
`msg.photo`, no en `msg.document`, y por eso aquél las ignora.

⚠️ Estas fotos NO se publican solas. Van a `scripts/fotos-revision/` —gitignored, como
`pendientes/`— para mirarlas una a una antes de decidir. El criterio acordado con Carlos
(10-ago-2026) es publicar **solo planos donde no se reconozca a nadie**: son trabajadores
identificables en un conflicto laboral abierto, y pasar de un grupo privado a una web
pública indexable es un salto de exposición que ellos no han autorizado.

El criterio tiene **una excepción, y una sola**: la foto frontal de la marcha de Sevilla, que
Carlos decidió publicar con las caras el 10-ago-2026 después de que se le planteara. Está
razonada en `CLIENTE.md` §7. No la tomes como precedente: para cualquier foto nueva vuelve a
regir la regla de arriba.

  python scripts/bajar-fotos.py 27621 34758 34563
"""
import json
import re
import sys
from pathlib import Path

try:
    from telethon.sync import TelegramClient
    from telethon.tl.functions.messages import CheckChatInviteRequest
except ImportError:
    raise SystemExit("Falta Telethon.  pip install telethon")

BASE = Path(__file__).resolve().parent
SESSION = BASE / "actas.session"
CFG = BASE / "tg.local.json"
DESTINO = BASE / "fotos-revision"


def cfg(clave, entorno):
    import os
    return os.environ.get(entorno) or json.loads(CFG.read_text(encoding="utf-8")).get(clave)


def resolver_canal(client, ref):
    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:
        return client(CheckChatInviteRequest(m.group(1))).chat
    return client.get_entity(ref)


def main(ids):
    api_id, api_hash = cfg("api_id", "TG_API_ID"), cfg("api_hash", "TG_API_HASH")
    canal_ref = cfg("canal", "TG_CANAL")
    DESTINO.mkdir(exist_ok=True)

    client = TelegramClient(str(SESSION.with_suffix("")), int(api_id), api_hash)
    client.connect()
    if not client.is_user_authorized():
        client.disconnect()
        raise SystemExit("Sesión de Telegram no iniciada (scripts/actas.session).")

    bajadas = 0
    try:
        canal = resolver_canal(client, canal_ref)
        for msg in client.get_messages(canal, ids=[int(i) for i in ids]):
            if msg is None or not (msg.photo or msg.document):
                print(f"aviso: el mensaje {getattr(msg, 'id', '?')} no trae foto", file=sys.stderr)
                continue
            fecha = msg.date.date().isoformat() if msg.date else "sin-fecha"
            ruta = DESTINO / f"{fecha}_{msg.id}.jpg"
            try:
                msg.download_media(file=str(ruta))
            except Exception as e:
                print(f"aviso: no se pudo bajar {msg.id} ({e})", file=sys.stderr)
                continue
            print(f"{ruta.name}  ·  {(msg.message or '').strip()[:80]}")
            bajadas += 1
    finally:
        client.disconnect()
    print(f"✓ {bajadas} foto(s) en {DESTINO} — PENDIENTES DE REVISAR", file=sys.stderr)


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if a.isdigit()]
    if not ids:
        raise SystemExit("Uso: python scripts/bajar-fotos.py <id> [<id>…]")
    main(ids)
