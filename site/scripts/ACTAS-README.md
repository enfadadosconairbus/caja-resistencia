# Actas de asamblea → sección Documentación

> **La sección se llama Documentación desde el 09-ago-2026** (antes «Actualizaciones»), y
> ya no lleva bloques de Comunicados ni de Otra documentación: eso lo cubre ahora el
> **índice de documentos** del grupo. Ver «Índice de documentos» al final.

## Resúmenes: la fuente es el topic «Resúmenes», entero (09-ago-2026)

**El topic manda; el patrón ya no.** Los resúmenes son **todo lo que se publica en el topic
«Resúmenes» (id 18150)** del canal `EnfadadosconAirbus` (`3710195540`). Es un hilo
moderado —solo publican administradores—, así que lo que hay dentro ya viene revisado y se
publica tal cual. El resto del canal sigue filtrándose por patrón, pero solo para **actas**.

Por qué se cambió: los resúmenes se cortaron el 22-jul sin que nadie lo notara. Dos causas,
y la segunda es la que obligó a cambiar de enfoque:

1. El 28-jul el grupo pasó de `📊 RESUMEN GRUPO ENFADADOS…` a `📊 RESUMEN **REAL** GRUPO…`
   y el patrón exigía las palabras seguidas.
2. En agosto los resúmenes dejaron de tener esa cabecera: son reposts del administrador.
   **Ningún patrón los habría cogido.** De ahí la regla nueva.

`INICIO_GRUPO` sigue existiendo, pero solo para decidir **quién manda dentro de una
ráfaga**: el mensaje con cabecera es el que da título y fecha (un resumen del día 27 se
publica el 28), y en los reposts manda la fecha del mensaje.

**Ráfagas.** Mensajes seguidos del mismo autor con menos de 5 minutos entre ellos son UNA
entrada, no varias: Telegram parte los resúmenes largos y los reposts encadenados llegan de
tres en tres. Por debajo de 150 caracteres se descarta (es un «gracias» o un pie de foto).
También se limpian los artefactos de copiar y pegar (`RT., [23 de jul de 2026 a las 21:13]`).

**Si cambia la forma de agrupar, reconstruye en vez de parchear** — si no, la versión vieja
y la nueva del mismo resumen conviven como duplicados:

```bash
python scripts/userbot-incremental.py --rehacer-resumenes
```

Rehace todos los resúmenes desde el topic y retira los antiguos **posteriores a su primer
mensaje** (los de antes se publicaron en General y se conservan). No toca el cursor.

Los topics se listan con `GetForumTopicsRequest` (`telethon.tl.functions.messages`). Los
útiles hoy: `Resúmenes` 18150 · `Actas asambleas` 27234 · `3: Grupo Documentación` 21638;
en el canal de Sevilla (`4336570469`), `Actas Asambleas San Pablo` 3822.

## ⭐ Flujo actual (rediseño 20-jul): HÍBRIDO nube + PC, cada 12 h

Reparto claro por tipo de contenido:

- **TEXTO** (actas y *Resúmenes del grupo de Telegram*) → **lo publica la NUBE solo**.
  `userbot-incremental.py` en GitHub Actions (`.github/workflows/actas.yml`), **cron cada
  12 h** (`0 */12 * * *`). Detecta el texto (patrón estricto + ≥300 car.), lo añade a
  `actas.json`, commitea y despliega. Ya NO toca PDFs. Seguro: el texto no es ruido.

  **Lee VARIOS canales** (21-jul): el general y el de Sevilla, que es donde se publican
  las actas de San Pablo. Configuración:
  - **Nube:** el secreto `TG_CANAL` admite varios enlaces **separados por comas**.
  - **Local:** `tg.local.json` → `"canales": ["https://t.me/+...", "https://t.me/+..."]`
    (el primero es el principal). Ese fichero está gitignored: los enlaces de invitación
    no viajan al repo.

  El **estado es por canal** (`actas-state.json` → `{"canales": {"<id>": last_id}}`) y el
  **dedup es global** contra `actas.json`, así que una misma acta publicada en los dos
  canales entra una sola vez. Un canal nuevo sin estado escanea su histórico completo.
- **DOCUMENTOS** (PDF/docx/xlsx: comunicados, tablas, dossiers, actas escaneadas…) → **los
  lleva el PC de la coordinación**, con revisión humana antes de publicar. Dos tareas de Windows
  (`instalar-tareas.ps1`):

| Hora | Tarea | Qué hace |
|---|---|---|
| **17:00** | `CajaResistencia-DescargarDocs` | Silenciosa. Baja los documentos nuevos a `pendientes/`. **No** genera Excel: el delta se acumula. |
| **20:00** | `CajaResistencia-RevisarPublicar` | **Interactiva.** Descarga lo nuevo, genera el Excel DELTA, te lo abre, espera a que revises y guardes, y **publica lo marcado** (copia a `public/docs/`, actualiza `actas.json`, commit + push + deploy en Vercel). |

### El ciclo de las 20:00, paso a paso

1. Sincroniza con git (`pull --rebase`) para **no pisar las actas que haya subido la nube**.
2. Genera `pendientes/revision/revision-<fecha>.xlsx` — solo lo **no revisado antes**
   (delta). Cada fila trae un **enlace al fichero en tu disco** para abrirlo.
3. Te abre el Excel y sale un diálogo que espera. Tú rellenas por fila:
   - **¿Subir?** → `Sí` / `No`
   - **Sección destino** → una de las siete `Índice - …` · Acta por centro ·
     Solidaridad Internacional · Manifiesto · No subir
   - **Sede** (solo si es «Acta por centro») y **Título web** (opcional; si lo dejas vacío
     se deriva del nombre del fichero).
4. Guardas (Ctrl+S), cierras y pulsas **Aceptar** → publica y despliega.
5. Diálogo final con el resumen: qué se publicó y qué avisos hubo.

**Las secciones se publican solas.** Según cuál elijas, la entrada va a un sitio u otro:

| Sección | Dónde acaba |
|---|---|
| `Índice - …` (las siete categorías del índice) | `scripts/documentos-overrides.json` → `anadir`, y de ahí al **Índice de documentos** |
| Acta por centro | `src/config/actas.json` (se agrupa por sede) |
| Manifiesto · Solidaridad Internacional | `src/config/internacional.json` (secciones El Conflicto y Solidaridad) |

> ⚠️ **Las secciones `Comunicados`, `Otra doc - Soporte` y `Otra doc - Otros` ya no
> existen (21-ago-2026).** Eran un agujero: escribían en `actas.json` un `tipo` que
> `actas-lista.tsx` dejó de pintar en el rediseño del 09-ago, cuando esos bloques se
> sustituyeron por el índice del grupo. Nadie tocó el Excel, así que siguió ofreciéndolas
> —y publicando, commiteando y desplegando— durante casi dos meses: **21 documentos
> aprobados por la coordinación acabaron en `public/docs/` sin salir en ninguna página**. Se
> rescataron con `rescatar-huerfanos-actas.py`. Las tres etiquetas viejas siguen valiendo
> en un Excel ya generado, mapeadas a la categoría más parecida.
>
> **Un documento aprobado aquí entra en el índice como ADELANTADO**, con su propio `pdf`
> resuelto: no depende del cruce por SHA-256 con `pendientes/`, que se rompe solo con
> volver a limpiar metadatos (PyMuPDF regenera el `/ID` del PDF al guardar; el 20-ago-2026
> una limpieza reescribió 125 originales y dejó sin unión a sus copias publicadas). En
> cuanto el Grupo Documentación catalogue el documento, su entrada del índice manda y el
> adelanto se ignora solo — ya no hay que retirarlo a mano.

> Dos detalles de las dos últimas:
> - **Manifiesto**: el «Título web» es **obligatorio** y es el nombre del idioma (p. ej. `Italiano`).
> - **Solidaridad Internacional**: lo que escribas en «Notas» se añade a la etiqueta
>   (p. ej. `FR` → «PDF · 1.2 MB · FR»).
>
> Si algo va mal no rompe: salta la fila y lo cuenta en los avisos. Log en
> `pendientes/revision/ultimo-run.log`.

## Índice de documentos (09-ago-2026)

Los **comunicados** y la **otra documentación** ya no se listan a mano en la sección: se
replica el **índice que el Grupo Documentación publica a diario en telegra.ph**, y **todo lo
que cataloga se publica**.

### Publicación diaria (automática)

`CajaResistencia-IndiceDiario` corre a las **10:30**, media hora después de que el grupo
publique el índice del día:

```bash
node scripts/publicar-indice.mjs --commit
```

Lee el índice y, para cada documento que no esté ya publicado: lo busca en `pendientes/`
por el id de mensaje que lleva en el nombre; si no está, lo baja de Telegram
(`bajar-mensajes.py`); lo copia a `public/docs/`; rehace el snapshot; commitea, hace push y
despliega. Antes de nada sincroniza con git, para no chocar con el bot de la nube.

> ⚠️ **Esto cambia la política de PILOT-001.** Hasta el 09-ago ningún PDF se publicaba sin
> revisión humana en el Excel (regla nacida del volcado de 43 documentos internos del
> 18-jul). Ahora **el filtro es el índice del grupo**: lo que ellos catalogan, se publica.
> La red de seguridad es `documentos-overrides.json` → `excluir`, que el script respeta y
> ni siquiera descarga. Decisión de la coordinación, registrada en `CLIENTE.md`.

Modos útiles: `--dry-run` (dice qué haría), `--sin-bajar` (solo publica lo que ya está en
local), `--reintentar` (vuelve a pedir los que dio por perdidos). Los mensajes borrados en
Telegram se anotan en `indice-irrecuperables.json` para no pedirlos cada día.

### Candidatos a hito de la cronología

La misma pasada de las 10:30 propone qué podría merecer un hito nuevo en la línea temporal
de la portada. **No publica ninguno**: los hitos se escriben a mano en
`src/config/hitos.json`, con su texto y su lectura del movimiento. Esto solo evita que se
pase algo por alto.

```bash
node scripts/hitos-candidatos.mjs        # a mano, si quieres mirar sin esperar
```

Dos señales, las dos con respaldo:

- **Documentos** del índice que encajan con lo que aquí ha sido un hito (convocatoria,
  preacuerdo, comunicado conjunto, referéndum, papeleta, manifiesto, carta abierta,
  mediación) y que **ningún hito enlaza todavía**.
- **Coincidencia de prensa**: días en los que **tres o más medios distintos** publican sobre
  lo mismo. Un medio suelto es ruido; tres el mismo día suele ser un hecho. Así se detectan
  las marchas, que no dejan documento.

Se ignora lo anterior al inicio del eje (1 de julio): no hay dónde colocarlo.

El resultado va a `scripts/hitos-candidatos.json` y al log de la tarea. **Para que un
candidato deje de proponerse cada mañana sin subirlo**, añade su `pdf` (documentos) o su
`clave` —`fecha|tema`, para los de prensa— a `scripts/hitos-descartados.json` con el motivo.

### El snapshot

```bash
npm run snapshot:documentos     # node scripts/snapshot-documentos.mjs
```

Lo lanzan solos `publicar-indice.mjs` y `revisar-y-publicar.py`; a mano solo hace falta si
copias algo a `public/docs/` por tu cuenta. Qué hace, y por qué no es opcional:

- Congela el índice en `src/config/documentos.json` (la web lo lee **en vivo**, revalidado
  1 h, y cae a este snapshot si telegra.ph falla).
- **Construye el mapa `archivos`**, que es lo que convierte una entrada del índice en una
  descarga real. El índice enlaza a `t.me/c/<grupo>/<msgId>`, que solo abre si eres
  miembro. La unión se hace por **SHA-256** entre `scripts/pendientes/<fecha>_<msgId>_…`
  (que lleva el id en el nombre) y lo ya publicado en `public/docs/`. Como `pendientes/`
  es local, **el mapa solo puede calcularse aquí**: sin snapshot, no hay descargas.
- Aplica `scripts/documentos-overrides.json`: **`excluir`** (documentación interna que no
  se lista) y **`titulos`** (nombres de fichero ilegibles). Ambos viajan al snapshot,
  porque si no reaparecerían en cuanto respondiese el índice en vivo.

**Privacidad:** el índice original trae, por documento, el nick de quien lo subió, sus
reacciones y una puntuación de utilidad. Nada de eso se replica (decisión de la coordinación,
09-ago-2026): son personas identificables dentro de un conflicto laboral abierto. La
lógica vive en `src/lib/indice-parse.ts`, compartida por la web y los scripts.

**Unión por nombre, además de por id.** El índice a veces apunta a un *repost* que luego se
borra, mientras el mismo documento sí está bajado con otro id (pasó con el BOE del VII
Convenio). Si el id no casa, se compara el **nombre** del fichero. Por eso conviene que
`pendientes/` siga llenándose: es la caché que hace posible este rescate.

### Las tres vías de publicación, y para qué es cada una

| Vía | Qué publica | Cuándo |
|---|---|---|
| `publicar-indice.mjs` | Todo lo que cataloga el índice del grupo | Diaria, 10:30, sola |
| `revisar-y-publicar.py` | Lo que NO está en el índice: manifiestos por idioma, solidaridad internacional, actas escaneadas **por centro**, y documentos que el grupo aún no ha catalogado (entran al índice como adelantados) | Diaria, 20:00, con tu revisión en Excel |
| `userbot-incremental.py` | Solo TEXTO: resúmenes del topic y actas de asamblea | Cada 12 h, en la nube |

**Las tres siguen haciendo falta.** El índice del grupo no cataloga todo (de 136 ficheros
bajados, 30 tienen contenido que no aparece en él de ninguna forma), y sobre todo **no sabe
dónde va cada cosa**: `publicar-indice.mjs` solo puede dejar documentos en la lista de
«Índice de documentos». Las otras tres ubicaciones de la web —botones de manifiesto por
idioma, comunicados de solidaridad internacional y actas atribuidas a su centro— solo se
alimentan desde el Excel. Ejemplo: el índice cataloga «Minutas Asamblea Getafe 20260729»
dentro de *Comunicados y convocatorias*, sin sede; saldría en la lista general, pero no en
Getafe.

Para que no se solapen, **el Excel excluye lo que el índice ya publicó**: si un documento
está en `documentos.json` → `archivos`, no entra en el delta de revisión.

---

El resto de este documento es el histórico de cómo se llegó aquí (backfill, incidente del
volcado, etc.). El flujo vivo es el de arriba.

---

Dos piezas, decididas con la coordinación (**fuera de la envolvente del sistema, D-19; decisión suya registrada**):

1. **Histórico** → `backfill-actas.py` (userbot, se corre **una vez, en local**).
2. **Lo nuevo** → `bot-actas.mjs` (bot, de aquí en adelante).

Ambas escriben `src/config/actas.json`, que la web ya lee y agrupa por centro.

---

## ⚠️ Seguridad (léelo antes de nada)

- **La sesión del userbot (`scripts/actas.session`) equivale a tu cuenta de Telegram entera.**
  Está en `.gitignore`. **Nunca** la subas ni la copies a un servidor. Al terminar el
  backfill, bórrala o cierra sesión (Telegram → Ajustes → Dispositivos).
- **`api_hash` y el token del bot son secretos.** No los pongas en el repo ni se los pases
  a nadie (tampoco a mí). Se leen de variables de entorno.
- El **token del bot** ≠ tu cuenta: solo accede a donde lo metas como admin. Riesgo acotado.

---

## 1) Backfill del histórico (una vez, en local)

```bash
pip install telethon
# api_id + api_hash: https://my.telegram.org → API development tools
```

Desde `clientes/caja-resistencia/site/`:

```powershell
# PowerShell
$env:TG_API_ID="123456"; $env:TG_API_HASH="tu_api_hash"
python scripts/backfill-actas.py "https://t.me/+MnuqJDCAAgYyMGQ0"
```

La primera vez pide tu teléfono + el código de Telegram (+ 2FA si tienes). Lee **todo el
historial** (todos los hilos, "Actas asambleas" y "General"), detecta las actas por su
texto, las agrupa por centro y reescribe `actas.json`. Luego: **revísalo, commit, redeploy,
y borra `actas.session`**.

### Opción B (recomendada): revisar en Excel antes de publicar

El detector automático se equivoca (cuela mensajes de chat, o no reconoce un centro). Para
tener control total, usa `backfill-actas-excel.py`: captura **con red ancha** todo lo que
suene a acta y lo saca a un Excel con desplegables para que marques **incluir (Sí/No)** y
el **centro** a mano.

```bash
pip install telethon openpyxl
python scripts/backfill-actas-excel.py "https://t.me/+MnuqJDCAAgYyMGQ0"
```

Genera `scripts/actas-para-revisar.xlsx`. Lo revisas, lo guardas y se lo pasas a Claude
para integrarlo en `actas.json`. *(Si `actas.session` aún existe de una vez anterior, no
te volverá a pedir teléfono/código.)*

> **PDF: política revisada (18-jul) tras un incidente.** La primera ejecución del userbot B2
> con auto-publicación de PDF **volcó 43 PDF del canal a la web pública** — docs internos del
> sindicato (bajas de afiliación, censo, tablas salariales), ruido de chat y ficheros de 10 MB —
> y pisó el manifiesto curado. Se revirtió y **cambió la política**:
> - **TEXTO** de actas/resúmenes (patrón estricto de inicio + ≥300 car.) → **se publica solo**.
> - **PDF** → **NO se publican**. Solo se anota su metadato (id, nombre, fecha, tamaño) en
>   `scripts/actas-pendientes.json`. **No se descargan los bytes.** La coordinación revisa esa cola y
>   añade a mano los buenos a `public/docs/` + `actas.json`.
>
> Implementado en `userbot-incremental.py` (la vía B2, que es la viva). El `bot-actas.mjs`
> (vía Bot-API, sin usar porque no somos admin) conserva la lógica antigua; si algún día se
> usa, replicar esta política antes.

## 2) Bot para lo nuevo

1. Crea el bot con **@BotFather** → te da un token.
2. **Añade el bot como administrador** del canal (única forma de que lea los posts).
3. En @BotFather: **/setprivacy → Disable** (para que reciba el texto de los mensajes).
4. Ejecuta el sondeo:

```powershell
$env:TG_BOT_TOKEN="123456:ABC..."
node scripts/bot-actas.mjs
```

Detecta las actas nuevas y las **añade** a `actas.json` sin tocar el histórico. Guarda su
posición en `scripts/actas-offset.json` (gitignored) para no repetir. Repite periódicamente.

## 3) B2 — Automático en la nube (userbot en GitHub Actions)

Elegido cuando **no se puede meter el bot como admin** (la coordinación no es admin del canal). Usa
la **cuenta** (miembro del canal), no un bot. Corre en un cron de GitHub Actions.

> ⚠️ **`TG_SESSION` es la cuenta de Telegram ENTERA.** Vive como secreto en GitHub para
> siempre. **Usa una cuenta DEDICADA** (un número aparte, solo en este canal): si el
> secreto se filtra, el daño es "leen este canal", no "son tú en Telegram".

**Archivos:** `gen-session.py` (genera la sesión, en local, una vez), `userbot-incremental.py`
(lo que corre en CI) y `.github/workflows/actas.yml` (el cron).

**Pasos (una vez):**

1. **Cuenta dedicada:** créala con un número aparte y **únela al canal** con el enlace de
   invitación. (Si no puedes añadirla, esta vía se cae; habría que volver a la Opción A.)
2. **Genera la sesión** en local, con esa cuenta:
   ```bash
   pip install telethon
   python scripts/gen-session.py     # pide api_id/api_hash (my.telegram.org), teléfono y código
   ```
   Copia la cadena `TG_SESSION` que imprime.
3. **Secretos** en GitHub → *Settings → Secrets and variables → Actions → New repository secret*:
   | secreto | valor |
   |---|---|
   | `TG_API_ID` / `TG_API_HASH` | los de la cuenta dedicada (my.telegram.org) |
   | `TG_SESSION` | la cadena del paso 2 |
   | `TG_CANAL` | `https://t.me/+MnuqJDCAAgYyMGQ0` |
   | `VERCEL_TOKEN` | uno nuevo en vercel.com/account/tokens |
   | `VERCEL_ORG_ID` | `team_172Wv90sfFIrKD7inQ2O5cN0` |
   | `VERCEL_PROJECT_ID` | `prj_gXnPOcYOm6fCkmu3YTQnbn9BsF9W` |
4. **La rama:** las Actions programadas se lanzan desde la **rama por defecto** (main). El
   workflow `.github/workflows/actas.yml` ya vive en `main` y hace checkout de la rama de
   trabajo. **El cron está EN PAUSA** (comentado) tras el incidente del volcado; se reactiva
   descomentando el bloque `schedule` cuando valides el flujo nuevo.
5. **Ejecución (manual, mientras el cron está en pausa):** en **Actions → actas-bot →
   Run workflow**. El userbot publica el **texto** de actas nuevas y manda los **PDF a la
   cola** `scripts/actas-pendientes.json` (no los publica). Deja el `last_id` en
   `scripts/actas-state.json` para no reprocesar. Solo redespliega si cambió algo que la web
   muestre (texto de actas / PDF ya publicados a mano).
6. **Revisar la cola de PDF:** abre `scripts/actas-pendientes.json`. Para cada PDF que
   quieras publicar: descárgalo de Telegram, ponlo en `public/docs/`, añade su item a
   `src/config/actas.json` y marca `revisado: true` (o borra la línea). El resto se queda
   en la cola sin tocar la web.

Cuando esté funcionando, **borra `actas.session`** (la del backfill personal): ya no hace falta.

### Automatizarlo con el bot admin (alternativa, si algún día sois admin)

Si el repo está en GitHub: `Settings → Secrets and variables → Actions → New secret`
llamado `TG_BOT_TOKEN`. Luego crea `.github/workflows/actas.yml`:

```yaml
name: actas
on:
  schedule: [{ cron: "*/30 * * * *" }]   # cada 30 min
  workflow_dispatch:
jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci                       # instala pdf-parse (extracción de actas-PDF)
        working-directory: clientes/caja-resistencia/site
      - run: node scripts/bot-actas.mjs
        working-directory: clientes/caja-resistencia/site
        env: { TG_BOT_TOKEN: "${{ secrets.TG_BOT_TOKEN }}" }
      - run: |
          cd clientes/caja-resistencia/site
          git config user.name "actas-bot"; git config user.email "bot@local"
          git add src/config/actas.json scripts/actas-offset.json
          git commit -m "actas: nuevas del canal" || echo "sin cambios"
          git push
```

> El `actas-offset.json` sí se versiona en el workflow (estado entre ejecuciones de CI);
> en local queda gitignored. Si automatizas, quítalo del `.gitignore` o commitéalo desde CI.

---

## Cómo detecta una acta (las tres piezas lo comparten)

Un mensaje es acta si su **primera línea empieza** por **`ACTA ASAMBLEA`** / `ACTA DE LA
ASAMBLEA` / **`RESUMEN DE LA ASAMBLEA`** (sin importar mayúsculas/acentos ni emojis
iniciales) **y el mensaje es largo (≥ 300 caracteres)**. Esas dos condiciones descartan
los mensajes de chat que solo *piden* el acta («¿podéis poner el resumen?», «mandad el
resumen…»), que un filtro por «contiene» colaba como si fueran actas.

De cada acta saca: **centro** desde el **título** (Getafe, Illescas, San Pablo, Tablada,
Cádiz, Albacete; «Puerto Real» → Cádiz) — no del cuerpo, que menciona muchos centros —,
**fecha** (`DD/MM/AAAA` o `DD [de] mes [de] AAAA`; si no hay, la del mensaje) y **título**
(primera línea). El backfill además deduplica reenvíos por cuerpo idéntico.

Lógica en: `src/lib/actas-source.ts` (web), `backfill-actas.py` y `bot-actas.mjs`.
Si cambias los patrones, cámbialos en las tres.
