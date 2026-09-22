#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backfill AMPLIO → Excel para revisión manual.

A diferencia de backfill-actas.py (que filtra y publica directo), esto lanza una RED
ANCHA: captura TODO lo que pueda ser un acta y lo vuelca a un Excel con desplegables,
para que TÚ marques cuáles son actas de verdad y les asignes el centro a mano.

Sale:  scripts/actas-para-revisar.xlsx
Columnas:
    incluir          → desplegable Sí/No  (mi sugerencia; tú decides)
    site             → desplegable Getafe/Illescas/San Pablo/Tablada/Cádiz/Albacete
    fecha            → AAAA-MM-DD (detectada; si no, la del mensaje)
    titulo           → primera línea
    caracteres       → longitud (para juzgar de un vistazo)
    motivo_captura   → por qué lo capturé (palabra clave / mensaje largo / adjunto)
    cuerpo           → texto completo
    fecha_post       → fecha real del mensaje (referencia)

Cuando lo tengas revisado, me lo pasas y lo integro en la web.

────────────────────────────────────────────────────────────────────────────────
⚠️  Misma seguridad que el otro script: es tu cuenta (userbot). El actas.session que
    crea = tu cuenta entera. No lo subas; bórralo al terminar.
────────────────────────────────────────────────────────────────────────────────

REQUISITOS:
    pip install telethon openpyxl

USO (desde clientes/caja-resistencia/site/):
    python scripts/backfill-actas-excel.py "https://t.me/+MnuqJDCAAgYyMGQ0"
    (te pedirá api_id, api_hash, teléfono y código — igual que el otro)
"""
import os
import re
import sys
import getpass
import asyncio
import unicodedata
from pathlib import Path

try:
    from telethon import TelegramClient
    from telethon.tl.functions.messages import ImportChatInviteRequest, CheckChatInviteRequest
    from telethon.errors import UserAlreadyParticipantError
except ImportError:
    sys.exit("Falta Telethon.  Instala con:  pip install telethon openpyxl")
try:
    import openpyxl
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.styles import Font, Alignment, PatternFill
except ImportError:
    sys.exit("Falta openpyxl.  Instala con:  pip install openpyxl")

SALIDA = Path(__file__).resolve().parent / "actas-para-revisar.xlsx"
SESION = Path(__file__).resolve().parent / "actas.session"

SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"]
ALIAS = {"Puerto Real": "Cádiz"}
MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
         "noviembre": 11, "diciembre": 12}

# RED ANCHA: cualquier mensaje que mencione "asamblea" o "acta" es candidato.
CANDIDATO = re.compile(r"ASAMBLEA|\bACTA\b")
# Sugerencia "es acta": cabecera de acta al principio + mensaje largo.
INICIO_ACTA = re.compile(r"^[\W_]*(ACTA\s+(?:DE\s+LA\s+)?ASAMBLEA|RESUMEN\s+DE\s+LA\s+ASAMBLEA)")


def norm(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()


def sugiere_acta(texto: str) -> bool:
    primera = texto.split("\n")[0] if texto else ""
    return bool(INICIO_ACTA.match(norm(primera))) and len(texto.strip()) >= 300


def sugiere_sede(texto: str):
    t = norm(texto.split("\n")[0] if texto else "")
    for s in SITES:
        if norm(s) in t:
            return s
    for ali, site in ALIAS.items():
        if norm(ali) in t:
            return site
    return ""


def detectar_fecha(texto: str):
    m = re.search(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b", texto)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.search(r"\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b", texto, re.I)
    if m and MESES.get(m.group(2).lower()):
        return f"{m.group(3)}-{MESES[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return None


def motivos(texto: str, doc_nombre):
    m = []
    if CANDIDATO.search(norm(texto)):
        m.append("palabra clave")
    if len(texto.strip()) >= 500:
        m.append("mensaje largo")
    if doc_nombre:
        m.append(f"adjunto: {doc_nombre}")
    return m


async def resolver_canal(client, ref: str):
    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:
        h = m.group(1)
        try:
            return (await client(ImportChatInviteRequest(h))).chats[0]
        except UserAlreadyParticipantError:
            return (await client(CheckChatInviteRequest(h))).chat
    return await client.get_entity(ref)


async def main():
    if len(sys.argv) < 2:
        sys.exit('Pásame el canal:  python scripts/backfill-actas-excel.py "https://t.me/+HASH"')
    ref = sys.argv[1]
    api_id = os.environ.get("TG_API_ID") or input("api_id (número de my.telegram.org): ").strip()
    api_hash = os.environ.get("TG_API_HASH") or getpass.getpass("api_hash (no se verá al teclear): ").strip()
    if not api_id.isdigit() or not api_hash:
        sys.exit("api_id/api_hash no válidos. Se sacan en https://my.telegram.org")

    filas = []
    async with TelegramClient(str(SESION), int(api_id), api_hash) as client:
        canal = await resolver_canal(client, ref)
        print(f"Canal: {getattr(canal, 'title', canal.id)}. Leyendo TODO el historial…")
        total = 0
        async for msg in client.iter_messages(canal, reverse=True):
            total += 1
            texto = msg.message or ""
            doc_nombre = None
            if msg.document:
                for attr in msg.document.attributes:
                    if getattr(attr, "file_name", None):
                        doc_nombre = attr.file_name
            mots = motivos(texto, doc_nombre)
            if not mots:
                continue
            primera = (texto.split("\n")[0] if texto else (doc_nombre or "")).strip()
            fecha = detectar_fecha(texto) or (msg.date.date().isoformat() if msg.date else "")
            filas.append({
                "incluir": "Sí" if sugiere_acta(texto) else "No",
                "site": sugiere_sede(texto),
                "fecha": fecha,
                "titulo": primera[:200],
                "caracteres": len(texto.strip()),
                "motivo": " · ".join(mots),
                "cuerpo": texto.strip(),
                "fecha_post": msg.date.isoformat() if msg.date else "",
            })
        print(f"Mensajes leídos: {total}. Candidatos capturados: {len(filas)}.")

    filas.sort(key=lambda f: f["fecha_post"], reverse=True)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Actas"
    cols = ["incluir", "site", "fecha", "titulo", "caracteres", "motivo", "cuerpo", "fecha_post"]
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="DDDDDD")
    for f in filas:
        ws.append([f[c] for c in cols])

    n = len(filas) + 1
    dv_inc = DataValidation(type="list", formula1='"Sí,No"', allow_blank=False)
    dv_site = DataValidation(type="list", formula1='"Getafe,Illescas,San Pablo,Tablada,Cádiz,Albacete"', allow_blank=True)
    ws.add_data_validation(dv_inc); dv_inc.add(f"A2:A{n}")
    ws.add_data_validation(dv_site); dv_site.add(f"B2:B{n}")

    anchos = {"A": 9, "B": 12, "C": 12, "D": 55, "E": 11, "F": 22, "G": 90, "H": 22}
    for col, w in anchos.items():
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        row[6].alignment = Alignment(wrap_text=True, vertical="top")  # cuerpo
        row[3].alignment = Alignment(wrap_text=True, vertical="top")  # titulo
    ws.freeze_panes = "A2"

    wb.save(SALIDA)
    sug_si = sum(1 for f in filas if f["incluir"] == "Sí")
    print(f"\n✓ Excel escrito: {SALIDA}")
    print(f"  {len(filas)} filas · sugeridas como acta: {sug_si} (el resto en 'No', revísalas).")
    print("  Abre el Excel, ajusta 'incluir' y 'site', guárdalo y pásamelo.")
    print("  Y borra actas.session cuando termines.")


if __name__ == "__main__":
    asyncio.run(main())
