# Registra (o reemplaza) las TRES tareas de Windows del flujo de documentos.
#
#   1) CajaResistencia-IndiceDiario    · 10:30 · silenciosa   (09-ago-2026)
#      El Grupo Documentación publica su índice a las 10:00. Media hora después esta
#      tarea lo lee, baja de Telegram lo que falte, lo publica en public/docs, rehace
#      src/config/documentos.json y despliega. Lo que el índice cataloga, se publica;
#      la red de seguridad es scripts/documentos-overrides.json → "excluir".
#
#   2) CajaResistencia-DescargarDocs   · 17:00 · silenciosa
#      Baja los documentos nuevos del canal a scripts/pendientes/. NO genera Excel:
#      el delta se acumula para que por la tarde salga UNA sola hoja de revisión.
#
#   3) CajaResistencia-RevisarPublicar · 20:00 · INTERACTIVA (necesita sesión iniciada)
#      Descarga lo nuevo, genera el Excel DELTA, te lo abre, espera a que lo revises y
#      guardes, y publica en la web lo que hayas marcado (copia a public/docs, actualiza
#      actas.json, refresca el índice, commit + push + deploy en Vercel).
#
# Sigue siendo la vía para lo que NO está en el índice del grupo (manifiestos por idioma,
# solidaridad internacional, actas escaneadas por centro).
#
# Las actas y los resúmenes del grupo NO pasan por aquí: los publica solo el bot de la
# nube (GitHub Actions, cada 12 h).
#
# Uso (una vez):   powershell -ExecutionPolicy Bypass -File .\scripts\instalar-tareas.ps1
# Requisitos:      Python + `pip install telethon openpyxl`, Node (para la tarea 1),
#                  scripts/actas.session (login hecho), scripts/tg.local.json con
#                  {api_id, api_hash, canal}, y `vercel` con sesión iniciada (vercel login).

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$siteDir = Split-Path $scriptDir -Parent

$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
$py = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
if (-not $py -and -not $pyw) { throw "No encuentro python/pythonw en el PATH." }
if (-not $pyw) { $pyw = $py }

$descarga = Join-Path $scriptDir "descargar-docs.py"
$revision = Join-Path $scriptDir "revisar-y-publicar.py"
foreach ($f in @($descarga, $revision)) { if (-not (Test-Path $f)) { throw "No existe $f" } }

Write-Host "Python:  $pyw"
Write-Host "Carpeta: $siteDir"

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
  -MultipleInstances IgnoreNew

# --- 0) Índice del grupo: publicar lo nuevo cada mañana ----------------------------
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$publicarIndice = Join-Path $scriptDir "publicar-indice.mjs"
if (-not $node) {
  Write-Warning "No encuentro node.exe en el PATH: me salto 'CajaResistencia-IndiceDiario'."
} elseif (-not (Test-Path $publicarIndice)) {
  Write-Warning "No existe $publicarIndice: me salto la tarea del indice."
} else {
  $n0 = "CajaResistencia-IndiceDiario"
  Unregister-ScheduledTask -TaskName $n0 -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask `
    -TaskName $n0 `
    -Action (New-ScheduledTaskAction -Execute $node -Argument "`"$publicarIndice`" --commit" -WorkingDirectory $siteDir) `
    -Trigger (New-ScheduledTaskTrigger -Daily -At 10:30am) `
    -Settings $settings `
    -Description "Caja de Resistencia: a las 10:30 lee el indice de documentos del grupo, publica los documentos nuevos en public/docs, rehace documentos.json y despliega." | Out-Null
  Write-Host "OK: '$n0' registrada (diaria 10:30, silenciosa)."
}

# --- 1) Descarga silenciosa de la tarde -------------------------------------------
$n1 = "CajaResistencia-DescargarDocs"
Unregister-ScheduledTask -TaskName $n1 -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
  -TaskName $n1 `
  -Action (New-ScheduledTaskAction -Execute $pyw -Argument "`"$descarga`" --sin-excel" -WorkingDirectory $siteDir) `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 5:00pm) `
  -Settings $settings `
  -Description "Caja de Resistencia: descarga a las 17:00 los documentos nuevos del canal a scripts/pendientes/. Sin Excel (el delta se acumula para la revision de las 20:00)." | Out-Null
Write-Host "OK: '$n1' registrada (diaria 17:00, silenciosa)."

# --- 2) Revisión + publicación de la tarde (interactiva) ---------------------------
# LogonType Interactive: hace falta para que se vean el Excel y los dialogos.
$n2 = "CajaResistencia-RevisarPublicar"
Unregister-ScheduledTask -TaskName $n2 -Confirm:$false -ErrorAction SilentlyContinue
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask `
  -TaskName $n2 `
  -Action (New-ScheduledTaskAction -Execute $pyw -Argument "`"$revision`"" -WorkingDirectory $siteDir) `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 8:00pm) `
  -Settings $settings `
  -Principal $principal `
  -Description "Caja de Resistencia: a las 20:00 descarga lo nuevo, abre el Excel de revision incremental, espera a que lo revises y guardes, y publica en la web lo marcado (commit + push + deploy)." | Out-Null
Write-Host "OK: '$n2' registrada (diaria 20:00, interactiva)."

Write-Host ""
Write-Host "Probar ahora:   Start-ScheduledTask -TaskName '$n2'"
Write-Host "Ver estado:     Get-ScheduledTaskInfo -TaskName '$n2'"
Write-Host "Quitar:         Unregister-ScheduledTask -TaskName 'CajaResistencia-IndiceDiario','$n1','$n2' -Confirm:`$false"
