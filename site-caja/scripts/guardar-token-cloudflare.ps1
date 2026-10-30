# Guarda el token de Cloudflare de la caja en la variable de entorno de USUARIO
# CAJA_CLOUDFLARE_API_TOKEN, sin que se vea al escribirlo ni quede en el historial.
#
#   npm run cloudflare:token
#
# Despues comprueba que el token entra en la cuenta de la caja. Ver DEPLOY-CLOUDFLARE.md.

$ErrorActionPreference = 'Stop'
$seguro = Read-Host -Prompt 'Pega el token de Cloudflare de la caja (no se vera) y pulsa Intro' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Host 'No se ha pegado nada: no se guarda.' -ForegroundColor Yellow
  exit 1
}

[Environment]::SetEnvironmentVariable('CAJA_CLOUDFLARE_API_TOKEN', $token, 'User')
$env:CAJA_CLOUDFLARE_API_TOKEN = $token
Write-Host 'Guardado en CAJA_CLOUDFLARE_API_TOKEN (variable de tu usuario de Windows).' -ForegroundColor Green

Write-Host 'Comprobando que entra en la cuenta de la caja...'
$env:CLOUDFLARE_API_TOKEN = $token
$env:CLOUDFLARE_ACCOUNT_ID = 'bda7ebe8ceabda92326ff551d5560d93'
$salida = (npx wrangler whoami 2>&1 | Out-String)
if ($salida -match 'bda7ebe8ceabda92326ff551d5560d93') {
  Write-Host 'OK: el token entra en la cuenta de la caja. Ya se puede publicar con npm run deploy:vinext.' -ForegroundColor Green
} else {
  Write-Host 'El token se ha guardado, pero NO entra en la cuenta de la caja. Revisa que lo creaste' -ForegroundColor Red
  Write-Host 'desde la cuenta enfadadosconairbus.contacto@gmail.com y con los permisos de DEPLOY-CLOUDFLARE.md.' -ForegroundColor Red
  exit 1
}
