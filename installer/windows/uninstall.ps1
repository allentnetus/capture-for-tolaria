[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria"),
    [switch]$ClearConfig,
    [string]$ConfigPath = (Join-Path $env:LOCALAPPDATA "CaptureForTolaria\config.json")
)

$ErrorActionPreference = "Stop"
$hostName = "com.capture_for_tolaria.helper"
$hostDirectory = Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host"
$manifestPath = Join-Path $hostDirectory "$hostName.json"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$configPath = $ConfigPath

if (Test-Path -LiteralPath $InstallRoot) {
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
}
if (Test-Path -LiteralPath $manifestPath) {
    Remove-Item -LiteralPath $manifestPath -Force
}
if (Test-Path -LiteralPath $registryPath) {
    Remove-Item -LiteralPath $registryPath -Recurse -Force
}
if ($ClearConfig -and (Test-Path -LiteralPath $configPath)) {
    Remove-Item -LiteralPath $configPath -Force
}

[pscustomobject]@{
    applicationRemoved = -not (Test-Path -LiteralPath $InstallRoot)
    hostManifestRemoved = -not (Test-Path -LiteralPath $manifestPath)
    registrationRemoved = -not (Test-Path -LiteralPath $registryPath)
    configRemoved = $ClearConfig -and -not (Test-Path -LiteralPath $configPath)
    vaultDataUntouched = $true
}
