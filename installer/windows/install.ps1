[CmdletBinding()]
param(
    [string]$HelperPath,
    [string]$ExtensionId = "ncjeeembmcgkfjipkfhganbdnadbhdcl",
    [string]$InstallRoot
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($HelperPath)) {
    $packageRoot = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
    $versionPath = Join-Path $packageRoot "VERSION"
    if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
        throw "VERSION file not found beside the Installer package: $versionPath"
    }
    $version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
    if ($version -notmatch '^\d+\.\d+\.\d+-alpha\.\d+$') {
        throw "VERSION is not a supported Alpha version: $version"
    }
    $helperName = "capture-for-tolaria-helper-$version-windows-x64.exe"
    $candidates = @(
        (Join-Path $packageRoot $helperName),
        (Join-Path $scriptDirectory $helperName),
        (Join-Path (Join-Path $packageRoot "release") $helperName)
    )
    $HelperPath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($HelperPath)) {
        throw "Helper executable not found. Put $helperName beside the Installer package or pass -HelperPath. Checked: $($candidates -join '; ')"
    }
}
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "LOCALAPPDATA is required when InstallRoot is not specified"
    }
    $InstallRoot = Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria"
}
$hostName = "com.capture_for_tolaria.helper"
if (-not (Test-Path -LiteralPath $HelperPath -PathType Leaf)) {
    throw "Helper executable not found: $HelperPath"
}

$appDirectory = (New-Item -ItemType Directory -Path $InstallRoot -Force).FullName
$helperTarget = Join-Path $appDirectory "capture-for-tolaria-helper.exe"
$hostDirectory = (New-Item -ItemType Directory -Path (Join-Path $env:LOCALAPPDATA "CaptureForTolaria\native-host") -Force).FullName
$manifestTarget = Join-Path $hostDirectory "$hostName.json"
$templatePath = Join-Path $scriptDirectory "native-host-manifest.json.in"

Copy-Item -LiteralPath $HelperPath -Destination $helperTarget -Force
$template = Get-Content -LiteralPath $templatePath -Raw | ConvertFrom-Json
$template.path = $helperTarget
$template.allowed_origins = @("chrome-extension://$ExtensionId/")
$manifestJson = $template | ConvertTo-Json -Depth 8
$utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($manifestTarget, $manifestJson, $utf8NoBom)

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestTarget

[pscustomobject]@{
    helperPath = $helperTarget
    hostManifestPath = $manifestTarget
    registryPath = $registryPath
    extensionId = $ExtensionId
}
