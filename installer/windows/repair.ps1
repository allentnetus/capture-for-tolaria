[CmdletBinding()]
param(
    [string]$HelperPath,
    [string]$ExtensionId = "ncjeeembmcgkfjipkfhganbdnadbhdcl",
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "LOCALAPPDATA is required when InstallRoot is not specified"
    }
    $InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria"
}
$installParameters = @{
    ExtensionId = $ExtensionId
    InstallRoot = $InstallRoot
}
if (-not [string]::IsNullOrWhiteSpace($HelperPath)) {
    $installParameters.HelperPath = $HelperPath
}
& (Join-Path $scriptDirectory "install.ps1") @installParameters
