#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backfill de actas de asamblea — USERBOT (una sola vez, EN LOCAL).

Lee TODO el historial del canal privado (todos los hilos: "Actas asambleas" y "General"),
detecta las actas por su contenido, las agrupa por centro y escribe
    src/config/actas.json
en el formato que ya lee la web.

────────────────────────────────────────────────────────────────────────────────
⚠️  SEGURIDAD — LÉELO
    · Esto inicia sesión como TU cuenta de Telegram. El archivo de sesión
      (actas.session) que se crea EQUIVALE a tu cuenta entera logueada.
    · NO subas actas.session al repo (ya está en .gitignore). No lo copies a ningún
      servidor. Cuando termines el backfill puedes borrarlo, o cerrar sesión desde
      Telegram (Ajustes → Dispositivos).
    · api_id / api_hash son secretos. NO los pongas en el repo ni se los pases a nadie.
      Se leen de variables de entorno (abajo).
────────────────────────────────────────────────────────────────────────────────

REQUISITOS (una vez):
    pip install telethon
    # api_id y api_hash: los sacas en https://my.telegram.org → API development tools

USO (desde clientes/caja-resistencia/site/):
    set TG_API_ID=123456                 &  set TG_API_HASH=xxxxxxxx     (Windows CMD)
    $env:TG_API_ID="123456"; $env:TG_API_HASH="xxxxxxxx"                 (PowerShell)
    export TG_API_ID=123456 TG_API_HASH=xxxxxxxx                         (bash)
    python scripts/backfill-actas.py "https://t.me/+MnuqJDCAAgYyMGQ0"

La primera vez pedirá tu teléfono + el código que te llega por Telegram (+ 2FA si tienes).
"""
import os
import re
import sys
import json
import getpass
import asyncio
import unicodedata
from pathlib import Path

try:
    from telethon import TelegramClient
    from telethon.tl.functions.messages import ImportChatInviteRequest, CheckChatInviteRequest
    from telethon.errors import UserAlreadyParticipantError
except ImportError:
    sys.exit("Falta Telethon.  Instala con:  pip install telethon")

DESTINO = Path(__file__).resolve().parent.parent / "src" / "config" / "actas.json"
SESION = Path(__file__).resolve().parent / "actas.session"

SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"]
ALIAS = {"Puerto Real": "Cádiz"}
MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
         "noviembre": 11, "diciembre": 12}


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


# El marcador debe ir AL PRINCIPIO de la primera línea, y el mensaje ha de ser largo:
# así se descartan los mensajes de chat que solo PIDEN el acta ("mandad el resumen"),
# que reventaban el detector antiguo.
INICIO_ACTA = re.compile(r"^[\W_]*(ACTA|RESUMEN|MINUTAS)\s+(?:DE\s+(?:LA\s+)?)?ASAMBLEA")


def es_acta(texto: str) -> bool:
    primera = texto.split("\n")[0]
    return bool(INICIO_ACTA.match(norm(primera))) and len(texto.strip()) >= 300


def detectar_sede(texto: str):
    t = norm(texto.split("\n")[0])  # el centro va en el título, no en el cuerpo
    for s in SITES:
        if norm(s) in t:
            return s
    for ali, site in ALIAS.items():
        if norm(ali) in t:
            return site
    return None


def detectar_fecha(texto: str):
    m = re.search(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b", texto)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b", texto, re.I)
    if m:
        mes = MESES.get(m.group(2).lower())
        if mes:
            return f"{m.group(3)}-{mes:02d}-{int(m.group(1)):02d}"
    return None


def parse_acta(texto: str, fecha_post):
    limpio = texto.strip()
    titulo = (limpio.splitlines()[0] if limpio.splitlines() else limpio).strip()[:140]
    cuerpo = limpio[len(titulo):].strip() or titulo
    fecha = detectar_fecha(limpio) or (fecha_post.date().isoformat() if fecha_post else None)
    return {"site": detectar_sede(limpio), "fecha": fecha, "titulo": titulo, "cuerpo": cuerpo}


async def resolver_canal(client, ref: str):
    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:  # enlace de invitación a canal privado
        h = m.group(1)
        try:
            upd = await client(ImportChatInviteRequest(h))
            return upd.chats[0]
        except UserAlreadyParticipantError:
            inv = await client(CheckChatInviteRequest(h))
            return inv.chat  # ChatInviteAlready.chat (ya eres miembro)
    return await client.get_entity(ref)  # @usuario o id


async def main():
    if len(sys.argv) < 2:
        sys.exit('Pásame el canal:  python scripts/backfill-actas.py "https://t.me/+HASH"')
    ref = sys.argv[1]

    # Credenciales: de variables de entorno si existen; si no, se piden aquí (así funciona
    # en cualquier terminal y el api_hash no queda en el historial del shell).
    api_id = os.environ.get("TG_API_ID") or input("api_id (el número de my.telegram.org): ").strip()
    api_hash = os.environ.get("TG_API_HASH") or getpass.getpass("api_hash (no se verá al teclear): ").strip()
    if not api_id.isdigit():
        sys.exit("El api_id debe ser un número. Lo sacas en https://my.telegram.org → API development tools")
    if not api_hash:
        sys.exit("Falta el api_hash. Lo sacas en https://my.telegram.org → API development tools")

    actas, vistas = [], set()
    async with TelegramClient(str(SESION), int(api_id), api_hash) as client:
        canal = await resolver_canal(client, ref)
        print(f"Canal: {getattr(canal, 'title', canal.id)}. Leyendo historial…")
        total = 0
        async for msg in client.iter_messages(canal, reverse=True):
            total += 1
            texto = msg.message or ""
            if not texto or not es_acta(texto):
                continue
            a = parse_acta(texto, msg.date)
            clave = f"{a['site']}|{a['fecha']}|{a['titulo']}"
            if clave in vistas:
                continue
            vistas.add(clave)
            actas.append(a)
        print(f"Mensajes leídos: {total}. Actas detectadas: {len(actas)}.")

    actas.sort(key=lambda a: (a["fecha"] or ""), reverse=True)
    por_centro = {s: sum(1 for a in actas if a["site"] == s) for s in SITES}
    sin_sede = sum(1 for a in actas if not a["site"])

    if not actas:
        print("No se detectó ninguna acta. NO se sobrescribe actas.json.")
        return

    DESTINO.write_text(
        json.dumps({"ejemplo": False, "canal": getattr(canal, "title", None), "actas": actas},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"✓ Escrito {DESTINO}")
    for s in SITES:
        print(f"    {s:<10} {por_centro[s]}")
    if sin_sede:
        print(f"    (sin centro reconocido: {sin_sede} — revísalas a mano)")
    print("\nAhora: revisa actas.json, haz commit y redespliega.  Y borra actas.session.")


if __name__ == "__main__":
    asyncio.run(main())
