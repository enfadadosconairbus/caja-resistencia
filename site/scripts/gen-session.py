#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera la SESIÓN en formato cadena (StringSession) para el userbot automático (B2).

Se corre UNA VEZ, EN LOCAL. Imprime una cadena larga que es la sesión de la cuenta:
la copias y la pegas como secreto TG_SESSION en GitHub. A partir de ahí, la GitHub
Action se conecta con ella sin pedir teléfono ni código.

⚠️ Usa una CUENTA DEDICADA (no tu cuenta personal): esa cadena, si se filtra, da acceso
   a la cuenta con la que la generes. Cuanto menos tenga esa cuenta, mejor.

USO:
    pip install telethon
    python scripts/gen-session.py
    # pide api_id, api_hash, teléfono y código de ESA cuenta; imprime la StringSession.
"""
import os
import getpass

try:
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    raise SystemExit("Falta Telethon.  pip install telethon")

api_id = os.environ.get("TG_API_ID") or input("api_id (de my.telegram.org): ").strip()
api_hash = os.environ.get("TG_API_HASH") or getpass.getpass("api_hash (no se verá): ").strip()

with TelegramClient(StringSession(), int(api_id), api_hash) as client:
    print("\n──────────────────────────────────────────────────────────────")
    print("TG_SESSION (guárdala como secreto en GitHub, NO en el repo):\n")
    print(client.session.save())
    print("\n──────────────────────────────────────────────────────────────")
    print("Y también necesitarás TG_API_ID y TG_API_HASH como secretos.")
