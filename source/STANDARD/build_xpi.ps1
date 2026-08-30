$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Out = Join-Path $Root "release"
$Xpi = Join-Path $Out "M365_Thunderbird_Calendar_V2.31_GITHUB_STANDARD.xpi"
$TempZip = Join-Path $Out "M365_Thunderbird_Calendar_V2.31_GITHUB_STANDARD.zip"
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
