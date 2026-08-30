$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Manifest = Get-Content (Join-Path $Root "manifest.json") -Raw | ConvertFrom-Json
$VersionParts = $Manifest.version.Split('.')
$DisplayVersion = if ($VersionParts.Count -eq 3 -and $VersionParts[1] -eq '0') { "$($VersionParts[0]).$($VersionParts[2])" } else { $Manifest.version }
$Out = Join-Path $Root "release"
$Xpi = Join-Path $Out "M365_Thunderbird_Calendar_V${DisplayVersion}_GITHUB_STANDARD.xpi"
$TempZip = [System.IO.Path]::ChangeExtension($Xpi, ".zip")
New-Item -ItemType Directory -Force -Path $Out | Out-Null
if (Test-Path $Xpi) { Remove-Item $Xpi -Force }
if (Test-Path $TempZip) { Remove-Item $TempZip -Force }
$Items = @(
    (Join-Path $Root "manifest.json"),
    (Join-Path $Root "background.js"),
    (Join-Path $Root "calendar"),
    (Join-Path $Root "invite"),
    (Join-Path $Root "lib"),
    (Join-Path $Root "config"),
    (Join-Path $Root "_locales"),
    (Join-Path $Root "icons")
)
Compress-Archive -Path $Items -DestinationPath $TempZip -CompressionLevel Optimal
Move-Item -Path $TempZip -Destination $Xpi
Write-Host "Created: $Xpi" -ForegroundColor Green
