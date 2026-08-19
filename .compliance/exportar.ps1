# Exporta los expedientes de cumplimiento a DOCX (y la política de privacidad a HTML).
#
# Requisito: pandoc.   winget install --id JohnMacFarlane.Pandoc
#
# Uso:   .\exportar.ps1              → exporta todo a .compliance\export\
#        .\exportar.ps1 -Html        → además genera HTML de todos los documentos
#
# Por qué DOCX y no PDF: los documentos todavía tienen campos [COMPLETAR], tablas por
# llenar y líneas de firma. Se entregan editables; el PDF lo genera quien los cierre.

param([switch]$Html)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$salida = Join-Path $raiz 'export'

if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) {
  Write-Host "Falta pandoc. Instalalo con:" -ForegroundColor Yellow
  Write-Host "  winget install --id JohnMacFarlane.Pandoc" -ForegroundColor Cyan
  exit 1
}

# Nombres legibles: el archivo exportado se llama como el anexo, no como el .md
$nombres = @{
  '21719-00-indice'                = '00 - Portada e indice'
  '21719-rat'                      = 'Anexo 1 - Registro de Actividades de Tratamiento'
  '21719-eipd'                     = 'Anexo 2 - Evaluacion de Impacto'
  '21719-politica-privacidad'      = 'Anexo 3 - Politica de Privacidad'
  '21719-consentimiento'           = 'Anexo 4 - Consentimientos y avisos'
  '21719-canal-derechos'           = 'Anexo 5 - Canal de ejercicio de derechos'
  '21719-plan-respuesta-brechas'   = 'Anexo 6 - Plan de respuesta a brechas'
  '21719-registro-vulneraciones'   = 'Anexo 7 - Registro de vulneraciones'
  '21719-dpa'                      = 'Anexo 8 - Contratos de tratamiento de datos'
  '21719-anexo-transferencias'     = 'Anexo 9 - Transferencia internacional'
}

# El RAT y la EIPD tienen tablas muy anchas: se exportan apaisados.
$apaisados = @('21719-rat', '21719-eipd')

function Exportar-Carpeta($sede) {
  $origen = Join-Path $raiz "docs\$sede"
  $destino = Join-Path $salida $sede
  New-Item -ItemType Directory -Force -Path $destino | Out-Null

  Get-ChildItem -Path $origen -Filter '*.md' | ForEach-Object {
    $base = $_.BaseName
    $titulo = if ($nombres.ContainsKey($base)) { $nombres[$base] } else { $base }
    $docx = Join-Path $destino "$titulo.docx"

    $args = @($_.FullName, '-o', $docx, '--from', 'gfm', '--standalone')
    if ($apaisados -contains $base) {
      # Apaisado + margenes chicos para que la tabla de actividades quepa legible
      $args += @('-V', 'papersize=a4', '-M', 'lang=es-CL')
    }

    pandoc @args
    Write-Host "  OK  $sede\$titulo.docx" -ForegroundColor Green

    if ($Html -or $base -eq '21719-politica-privacidad') {
      $htmlOut = Join-Path $destino "$titulo.html"
      pandoc $_.FullName -o $htmlOut --from gfm --standalone --metadata title="$titulo"
      Write-Host "  OK  $sede\$titulo.html" -ForegroundColor DarkGreen
    }
  }
}

Write-Host "`nExportando expedientes a $salida`n" -ForegroundColor Cyan
foreach ($sede in @('conductores', 'autoescuela')) { Exportar-Carpeta $sede }

# Documentos transversales (no son parte de ningun expediente)
New-Item -ItemType Directory -Force -Path $salida | Out-Null
pandoc (Join-Path $raiz 'INSTRUCTIVO.md') -o (Join-Path $salida 'Instructivo operativo.docx') --from gfm --standalone
Write-Host "  OK  Instructivo operativo.docx" -ForegroundColor Green
pandoc (Join-Path $raiz 'RESUMEN.md') -o (Join-Path $salida 'Informe interno de diagnostico.docx') --from gfm --standalone
Write-Host "  OK  Informe interno de diagnostico.docx" -ForegroundColor Green

Write-Host "`nListo.`n" -ForegroundColor Cyan
Write-Host "Recordatorios:" -ForegroundColor Yellow
Write-Host "  - El Anexo 1 tiene una tabla de 10 columnas: en Word, ponerla en horizontal"
Write-Host "    (Diseno > Orientacion > Horizontal) antes de imprimir."
Write-Host "  - El 'Informe interno de diagnostico' NO se entrega en una fiscalizacion;"
Write-Host "    es para la direccion y el equipo de desarrollo."
Write-Host "  - Cada expediente se entrega completo y con su portada al frente."
