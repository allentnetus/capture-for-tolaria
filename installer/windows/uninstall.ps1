[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Programs\CaptureForTolaria"),
    [switch]$ClearConfig,
    [string]$ConfigPath = (Join-Path $env:LOCALAPPDATA "CaptureForTolaria\config.json")
)

$ErrorActionPreference = "Stop"

function Get-NormalizedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Path must not be empty"
    }

    try {
        return [IO.Path]::GetFullPath($Path)
    }
    catch {
        throw "Invalid path: $Path"
    }
}

function Test-PathWithinOrEqual {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Parent,
        [Parameter(Mandatory = $true)]
        [string]$Candidate
    )

    if ([string]::Equals($Parent, $Candidate, [StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $prefix = if ($Parent.EndsWith([IO.Path]::DirectorySeparatorChar)) {
        $Parent
    }
    else {
        $Parent + [IO.Path]::DirectorySeparatorChar
    }
    return $Candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NotReparsePoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to use a reparse point: $Path"
    }
}

function Get-CanonicalExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Assert-NotReparsePoint $Path
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    $canonical = Get-NormalizedPath $resolved
    Assert-NotReparsePoint $canonical
    return $canonical
}

function Assert-NoReparsePoints {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $items = @(
        Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        Get-ChildItem -LiteralPath $Path -Force -Recurse -ErrorAction Stop
    )
    $reparsePoint = $items | Where-Object {
        ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
    } | Select-Object -First 1
    if ($null -ne $reparsePoint) {
        throw "Refusing to remove a directory containing a reparse point: $Path"
    }
}

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw "LOCALAPPDATA is required to validate the installation directory"
}

$normalizedLocalAppData = Get-NormalizedPath $env:LOCALAPPDATA
$canonicalLocalAppData = Get-CanonicalExistingPath $normalizedLocalAppData
if (-not [string]::Equals($canonicalLocalAppData, $normalizedLocalAppData, [StringComparison]::OrdinalIgnoreCase)) {
    throw "LOCALAPPDATA must not resolve through a reparse point"
}

$normalizedInstallRoot = Get-NormalizedPath $InstallRoot
$expectedInstallParent = Get-NormalizedPath (Join-Path $normalizedLocalAppData "Programs")
$actualInstallParent = Get-NormalizedPath (Split-Path -Parent $normalizedInstallRoot)
$installLeaf = Split-Path -Leaf $normalizedInstallRoot
if (
    -not [string]::Equals($actualInstallParent, $expectedInstallParent, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals($installLeaf, "CaptureForTolaria", [StringComparison]::OrdinalIgnoreCase)
) {
    throw "InstallRoot must be %LOCALAPPDATA%\\Programs\\CaptureForTolaria"
}
Assert-NotReparsePoint $expectedInstallParent

$hostName = "com.capture_for_tolaria.helper"
$hostDirectory = Join-Path $normalizedLocalAppData "CaptureForTolaria\native-host"
$manifestPath = Join-Path $hostDirectory "$hostName.json"
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
$configPath = Get-NormalizedPath $ConfigPath
$expectedConfigPath = Get-NormalizedPath (Join-Path $normalizedLocalAppData "CaptureForTolaria\config.json")
if (-not [string]::Equals($configPath, $expectedConfigPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "ConfigPath must be %LOCALAPPDATA%\\CaptureForTolaria\\config.json"
}
$configDirectory = Split-Path -Parent $configPath
Assert-NotReparsePoint $configDirectory
Assert-NotReparsePoint $hostDirectory
Assert-NotReparsePoint $manifestPath

$canonicalConfigDirectory = if (Test-Path -LiteralPath $configDirectory -PathType Container) {
    Get-CanonicalExistingPath $configDirectory
}
else {
    $configDirectory
}
$canonicalHostDirectory = if (Test-Path -LiteralPath $hostDirectory -PathType Container) {
    Get-CanonicalExistingPath $hostDirectory
}
else {
    $hostDirectory
}
if (-not (Test-PathWithinOrEqual -Parent $canonicalLocalAppData -Candidate $canonicalConfigDirectory)) {
    throw "ConfigPath is outside LOCALAPPDATA"
}
if (-not (Test-PathWithinOrEqual -Parent $canonicalLocalAppData -Candidate $canonicalHostDirectory)) {
    throw "Native Host directory is outside LOCALAPPDATA"
}

$vaultRoot = $null
$vaultExistedBefore = $false
if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    Assert-NotReparsePoint $configPath
    try {
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($config.vaultRoot -is [string] -and -not [string]::IsNullOrWhiteSpace($config.vaultRoot)) {
            $configuredVault = Get-NormalizedPath $config.vaultRoot
            if (Test-Path -LiteralPath $configuredVault -PathType Container) {
                $vaultRoot = Get-CanonicalExistingPath $configuredVault
                $vaultExistedBefore = $true
            }
            else {
                $vaultRoot = $configuredVault
            }
        }
    }
    catch {
        throw "Unable to validate the configured Vault before uninstall"
    }
}

if (Test-Path -LiteralPath $normalizedInstallRoot -PathType Container) {
    $canonicalInstallRoot = Get-CanonicalExistingPath $normalizedInstallRoot
}
else {
    $canonicalInstallRoot = $normalizedInstallRoot
}

if ($null -ne $vaultRoot -and (
        (Test-PathWithinOrEqual -Parent $vaultRoot -Candidate $canonicalInstallRoot) -or
        (Test-PathWithinOrEqual -Parent $canonicalInstallRoot -Candidate $vaultRoot)
    )) {
    throw "InstallRoot overlaps the configured Vault and cannot be removed"
}

if (Test-Path -LiteralPath $normalizedInstallRoot -PathType Container) {
    $installItem = Get-Item -LiteralPath $normalizedInstallRoot -Force -ErrorAction Stop
    if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to remove an installation directory that is a reparse point"
    }

    $helperTarget = Join-Path $normalizedInstallRoot "capture-for-tolaria-helper.exe"
    if (-not (Test-Path -LiteralPath $helperTarget -PathType Leaf)) {
        throw "InstallRoot is missing the installed Helper marker: $helperTarget"
    }

    Assert-NoReparsePoints $normalizedInstallRoot
    Remove-Item -LiteralPath $normalizedInstallRoot -Recurse -Force
}
if (Test-Path -LiteralPath $manifestPath) {
    Assert-NotReparsePoint $manifestPath
    Remove-Item -LiteralPath $manifestPath -Force
}
if (Test-Path -LiteralPath $registryPath) {
    Remove-Item -LiteralPath $registryPath -Recurse -Force
}
if ($ClearConfig -and (Test-Path -LiteralPath $configPath)) {
    Assert-NotReparsePoint $configPath
    Remove-Item -LiteralPath $configPath -Force
}

[pscustomobject]@{
    applicationRemoved = -not (Test-Path -LiteralPath $normalizedInstallRoot)
    hostManifestRemoved = -not (Test-Path -LiteralPath $manifestPath)
    registrationRemoved = -not (Test-Path -LiteralPath $registryPath)
    configRemoved = $ClearConfig -and -not (Test-Path -LiteralPath $configPath)
    vaultDataUntouched = -not $vaultExistedBefore -or (Test-Path -LiteralPath $vaultRoot -PathType Container)
}
