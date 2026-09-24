#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Userbot INCREMENTAL (B2, NUBE) — publica lo NUEVO del canal que es TEXTO.

Corre en una GitHub Action (cron cada 12 h) con la sesión como secreto. Como es la
cuenta (miembro del canal), NO necesita ser admin — a diferencia del bot.

⚠️ REPARTO DE RESPONSABILIDADES (rediseño 20-jul, revisado el 09-ago):
  · RESÚMENES → todo lo que se publique en el topic «Resúmenes» del foro, tal cual. Es un
    hilo moderado (solo publican administradores), así que ya viene revisado; agrupa en una
    sola entrada los mensajes seguidos del mismo autor. Va a src/config/actas.json.
  · ACTAS de asamblea → del resto del canal, con patrón estricto de inicio + ≥300 car.
  · DOCUMENTOS (PDF, docx, xlsx…) → NO se tocan aquí. De eso se encargan
    `descargar-docs.py` (cola de revisión en Excel) y `publicar-indice.mjs` (lo que
    cataloga el índice del grupo). Este bot los IGNORA por completo.

Deduplica el texto contra actas.json. Guarda el id del último mensaje procesado en
actas-state.json.

  python scripts/userbot-incremental.py                       # pasada incremental
  python scripts/userbot-incremental.py --desde <id>          # recuperar un hueco
  python scripts/userbot-incremental.py --rehacer-resumenes   # reconstruir los resúmenes

⚠️ SEGURIDAD: TG_SESSION es la cuenta entera. Usa una cuenta DEDICADA. Los tres secretos
   (TG_API_ID, TG_API_HASH, TG_SESSION) van en GitHub → Settings → Secrets, NUNCA en el repo.

Variables de entorno: TG_API_ID, TG_API_HASH, TG_SESSION, TG_CANAL (enlace del canal).
"""
import os
import re
import sys
import json
import unicodedata
from pathlib import Path

try:
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession
    from telethon.tl.functions.messages import CheckChatInviteRequest
except ImportError:
    raise SystemExit("Falta Telethon.  pip install telethon")

BASE = Path(__file__).resolve().parent
ACTAS = BASE / ".." / "src" / "config" / "actas.json"
STATE = BASE / "actas-state.json"       # {last_id} — SÍ se versiona (estado entre runs de CI)
CFG = BASE / "tg.local.json"            # LOCAL (gitignored): {api_id, api_hash, canal}
SESION_LOCAL = BASE / "actas.session"   # LOCAL (gitignored): sesión de fichero

SITES = ["Getafe", "Illescas", "San Pablo", "Tablada", "Cádiz", "Albacete"]
ALIAS = {"Puerto Real": "Cádiz"}
MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
         "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
         "noviembre": 11, "diciembre": 12}

INICIO_ACTA = re.compile(r"^[\W_]*(ACTA|RESUMEN|MINUTAS)\s+(?:DE\s+(?:LA\s+)?)?ASAMBLEA")
# El 28-jul el grupo pasó de «RESUMEN GRUPO…» a «RESUMEN REAL GRUPO…» y el patrón rígido
# dejó de encontrarlos (se perdieron 4 resúmenes). Se admite un calificativo intermedio.
INICIO_GRUPO = re.compile(r"^[\W_]*RESUMEN(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s+GRUPO\s+ENFADADOS\s+CON\s+AIRBUS")

# ── El topic «Resúmenes» es la FUENTE de los resúmenes (decisión de la coordinación, 09-ago-2026).
#
# Es un hilo moderado —solo publican los administradores—, así que lo que hay dentro ya
# viene revisado: se publica TAL CUAL, sin exigir que case con ningún patrón. Antes solo
# entraba lo que empezaba por «RESUMEN GRUPO ENFADADOS CON AIRBUS», y por eso se perdieron
# los resúmenes de agosto (que son reposts del administrador, sin esa cabecera).
TOPIC_RESUMENES = {"3710195540": 18150}  # EnfadadosconAirbus → Resúmenes

# Ráfaga: mensajes seguidos del mismo autor en pocos minutos son UN resumen partido, no
# varios. Telegram parte los largos, y los reposts encadenados llegan de tres en tres.
CONTINUACION_MAX_S = 300
# Por debajo de esto es un «gracias» o un pie de foto, no un resumen.
MIN_RESUMEN = 150
# Artefactos de copiar y pegar desde Telegram: líneas sueltas de marca de tiempo
# («RT., [23 de jul de 2026 a las 21:13]»). Estorban al título y no aportan nada.
ARTEFACTO = re.compile(r"^\s*(?:[\w.]+,\s*)?\[\d{1,2}\s+de\s+\w+\.?\s+de\s+\d{4}[^\]]*\]\s*$", re.I)

norm = lambda s: "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").upper()
primera = lambda t: (t.split("\n")[0] if t else "")


def clasificar(texto):
    if INICIO_GRUPO.match(norm(primera(texto))) and len(texto.strip()) >= 300:
        return "grupo"
    if INICIO_ACTA.match(norm(primera(texto))) and len(texto.strip()) >= 300:
        return "acta"
    return None


def topic_de(msg):
    """Topic (hilo del foro) en el que está el mensaje. 1 = General."""
    r = getattr(msg, "reply_to", None)
    if not r:
        return 1
    return getattr(r, "reply_to_top_id", None) or getattr(r, "reply_to_msg_id", None) or 1


def limpiar_artefactos(texto):
    """Quita las líneas de marca de tiempo que deja copiar y pegar desde Telegram."""
    return "\n".join(l for l in texto.split("\n") if not ARTEFACTO.match(l)).strip()


def encadena(msg, anterior):
    """¿`msg` continúa la ráfaga de `anterior`? Mismo autor y pocos minutos después."""
    return (getattr(msg, "sender_id", None) == getattr(anterior, "sender_id", object())
            and abs((msg.date - anterior.date).total_seconds()) <= CONTINUACION_MAX_S)


def item_de_rafaga(msgs):
    """Convierte una ráfaga del topic «Resúmenes» en UNA entrada, o None si es ruido.

    El mensaje con cabecera de resumen va primero (es el que da título y fecha); el resto,
    en orden de publicación. La fecha sale del texto solo cuando hay cabecera —un resumen
    del día 27 se publica el 28—; en los reposts manda la fecha del mensaje.
    """
    textos = [(m, limpiar_artefactos(m.message or "")) for m in msgs]
    textos = [(m, t) for m, t in textos if t]
    if not textos:
        return None

    cabecera = next((i for i, (_, t) in enumerate(textos)
                     if INICIO_GRUPO.match(norm(primera(t)))), None)
    if cabecera is not None:
        textos = [textos[cabecera]] + textos[:cabecera] + textos[cabecera + 1:]

    completo = "\n\n".join(t for _, t in textos).strip()
    if len(completo) < MIN_RESUMEN:
        return None

    msg = textos[0][0]
    titulo = primera(completo).strip().strip("*").strip()[:160]
    cuerpo = completo[completo.find("\n") + 1:].strip() if "\n" in completo else completo
    return {"tipo": "grupo", "site": None,
            "fecha": fecha(completo, msg.date) if cabecera is not None
                     else (msg.date.date().isoformat() if msg.date else None),
            "titulo": titulo, "cuerpo": cuerpo or titulo}


def sede(texto):
    t = norm(primera(texto))
    for s in SITES:
        if norm(s) in t:
            return s
    for a, s in ALIAS.items():
        if norm(a) in t:
            return s
    return None


def fecha(texto, dt=None):
    m = re.search(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b", texto)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    m = re.search(r"\b(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})\b", texto, re.I)
    if m and MESES.get(m.group(2).lower()):
        return f"{m.group(3)}-{MESES[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
    return dt.date().isoformat() if dt else None


def parse_item(texto, tipo, dt):
    limpio = texto.strip()
    titulo = primera(limpio).strip().strip("*").strip()[:160]
    cuerpo = limpio[limpio.find("\n") + 1:].strip() if "\n" in limpio else limpio
    return {"tipo": tipo, "site": sede(limpio) if tipo == "acta" else None,
            "fecha": fecha(limpio, dt), "titulo": titulo, "cuerpo": cuerpo or titulo}


async def resolver_canal(client, ref):
    m = re.search(r"t\.me/\+([\w-]+)", ref) or re.search(r"joinchat/([\w-]+)", ref)
    if m:
        return (await client(CheckChatInviteRequest(m.group(1)))).chat
    return await client.get_entity(ref)


def leer_state():
    """Devuelve (estado_por_canal, last_id_antiguo).

    Formato nuevo: {"canales": {"<id_chat>": last_id}}. El antiguo era un escalar
    {"last_id": N} referido al primer canal; se migra solo la primera vez.
    """
    try:
        j = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception:
        return {}, 0
    if isinstance(j.get("canales"), dict):
        return dict(j["canales"]), 0
    return {}, int(j.get("last_id", 0) or 0)


def cfg(clave, entorno):
    """Config de la NUBE (variables de entorno) o, si no hay, del fichero LOCAL."""
    v = os.environ.get(entorno)
    if v:
        return v
    try:
        return json.loads(CFG.read_text(encoding="utf-8")).get(clave)
    except Exception:
        return None


def canales_configurados():
    """Lista de canales a leer. En la NUBE: TG_CANAL admite VARIOS separados por comas
    o saltos de línea. En LOCAL: tg.local.json con "canales": [...] o "canal": "...".
    El primero de la lista es el principal (hereda el estado del formato antiguo)."""
    v = os.environ.get("TG_CANAL")
    if v:
        return [x.strip() for x in re.split(r"[,\n;]+", v) if x.strip()]
    try:
        j = json.loads(CFG.read_text(encoding="utf-8"))
    except Exception:
        return []
    if isinstance(j.get("canales"), list):
        return [str(x).strip() for x in j["canales"] if str(x).strip()]
    return [str(j["canal"]).strip()] if j.get("canal") else []


def es_documento(msg):
    """¿El mensaje trae un fichero adjunto (PDF/ofimático)? Esos NO los procesa este bot."""
    doc = msg.document
    if not doc:
        return False
    mime = (getattr(doc, "mime_type", "") or "").lower()
    if mime == "application/pdf" or "officedocument" in mime or "msword" in mime:
        return True
    return any(getattr(a, "file_name", "").lower().endswith(
        (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".csv", ".rtf"))
        for a in getattr(doc, "attributes", []))


async def main():
    api_id, api_hash = cfg("api_id", "TG_API_ID"), cfg("api_hash", "TG_API_HASH")
    canales = canales_configurados()
    ses = os.environ.get("TG_SESSION")
    if not all([api_id, api_hash]) or not canales:
        raise SystemExit("Faltan api_id / api_hash / canal(es) (variables de entorno o scripts/tg.local.json).")
    # En la NUBE: sesión de cadena desde el secreto. En LOCAL: la sesión de fichero, la
    # misma que usa descargar-docs.py — así puedes ponerlo al día a mano cuando quieras.
    if ses:
        sesion = StringSession(ses)
    elif SESION_LOCAL.exists():
        sesion = str(SESION_LOCAL.with_suffix(""))
    else:
        raise SystemExit("Sin TG_SESSION (nube) ni scripts/actas.session (local).")

    doc = json.loads(ACTAS.read_text(encoding="utf-8"))
    doc["ejemplo"] = False
    clave = lambda a: (a.get("cuerpo") or a.get("pdf") or a.get("titulo") or "").strip()
    vistas = {clave(a) for a in doc["actas"]}

    # --desde N: re-escanea desde ese mensaje para recuperar huecos (si una pasada anterior
    # se saltó algo). Es idempotente: el dedup por cuerpo evita duplicados, y el last_id
    # final sigue siendo el más alto visto, así que no se pierde el avance.
    desde = None
    if "--desde" in sys.argv:
        try:
            desde = int(sys.argv[sys.argv.index("--desde") + 1])
        except (IndexError, ValueError):
            raise SystemExit("Uso: --desde <id_de_mensaje>")

    estado, legacy = leer_state()
    nuevos_texto = 0

    client = TelegramClient(sesion, int(api_id), api_hash)
    await client.connect()

    # --rehacer-resumenes: reconstruye TODOS los resúmenes desde el topic, de cero. Se usa
    # cuando cambia la forma de agrupar (si no, las versiones vieja y nueva del mismo
    # resumen convivirían como duplicados). No toca el cursor: la pasada normal sigue igual.
    if "--rehacer-resumenes" in sys.argv:
        for ref in canales:
            try:
                canal = await resolver_canal(client, ref)
            except Exception as e:
                print(f"  aviso: no pude abrir un canal ({type(e).__name__}: {e}).")
                continue
            topic = TOPIC_RESUMENES.get(str(canal.id))
            if not topic:
                continue

            nuevos, rafaga = [], []
            async for msg in client.iter_messages(canal, reply_to=topic, reverse=True):
                if rafaga and not encadena(msg, rafaga[-1]):
                    nuevos.append(item_de_rafaga(rafaga)); rafaga = []
                rafaga.append(msg)
            nuevos.append(item_de_rafaga(rafaga))
            nuevos = [n for n in nuevos if n]

            # Solo se retiran los resúmenes que el topic puede reponer: los anteriores a su
            # primer mensaje se publicaron en General y se conservan tal cual.
            corte = min((n["fecha"] for n in nuevos if n["fecha"]), default=None)
            antes = len(doc["actas"])
            doc["actas"] = [a for a in doc["actas"]
                            if not (a.get("tipo") == "grupo" and corte and (a.get("fecha") or "") >= corte)]
            retirados = antes - len(doc["actas"])
            vistas = {clave(a) for a in doc["actas"]}
            for n in nuevos:
                if clave(n) in vistas:
                    continue
                vistas.add(clave(n)); doc["actas"].append(n); nuevos_texto += 1
            print(f"  · {getattr(canal, 'title', canal.id)}: {retirados} retirado(s), "
                  f"{len(nuevos)} reconstruido(s) desde el topic (corte {corte}).")

        await client.disconnect()
        doc["actas"].sort(key=lambda a: (a.get("fecha") or ""), reverse=True)
        ACTAS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"✓ resúmenes reconstruidos. Total entradas: {len(doc['actas'])}.")
        return

    for i, ref in enumerate(canales):
        try:
            canal = await resolver_canal(client, ref)
        except Exception as e:
            print(f"  aviso: no pude abrir un canal ({type(e).__name__}: {e}). Sigo con el resto.")
            continue
        cid = str(canal.id)
        # El estado antiguo (escalar) era del canal principal: se migra al primero.
        previo = int(estado.get(cid, legacy if i == 0 else 0) or 0)
        arranque = desde if desde is not None else previo
        max_id, n_canal = previo, 0

        topic_resumenes = TOPIC_RESUMENES.get(cid)
        rafaga = []  # mensajes seguidos del topic «Resúmenes» que forman una sola entrada

        def guardar(reg):
            """Vuelca a actas.json una entrada ya cerrada. Dedup GLOBAL: la misma acta
            suele publicarse en varios canales."""
            nonlocal n_canal, nuevos_texto
            if not reg or clave(reg) in vistas:
                return
            vistas.add(clave(reg)); doc["actas"].append(reg)
            n_canal += 1; nuevos_texto += 1

        async for msg in client.iter_messages(canal, min_id=arranque, reverse=True):
            max_id = max(max_id, msg.id)

            # ── Topic «Resúmenes»: se publica todo lo que hay, agrupado por ráfagas.
            if topic_resumenes and topic_de(msg) == topic_resumenes:
                if rafaga and not encadena(msg, rafaga[-1]):
                    guardar(item_de_rafaga(rafaga)); rafaga = []
                rafaga.append(msg)
                continue

            # ── Resto del canal: solo actas de asamblea, por patrón estricto.
            # Los adjuntos los lleva el PC de la coordinación (descarga + Excel). Aquí se ignoran.
            if es_documento(msg) or clasificar(msg.message or "") != "acta":
                continue
            guardar(parse_item(msg.message or "", "acta", msg.date))

        guardar(item_de_rafaga(rafaga))
        estado[cid] = max_id
        print(f"  · {getattr(canal, 'title', cid)}: {n_canal} nueva(s). last_id={max_id}")

    await client.disconnect()

    if nuevos_texto > 0:
        doc["actas"].sort(key=lambda a: (a.get("fecha") or ""), reverse=True)
        ACTAS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    STATE.write_text(json.dumps({"canales": estado}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {nuevos_texto} acta(s)/resumen(es) de texto publicadas en {len(canales)} canal(es). "
          f"Total actas: {len(doc['actas'])}.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
