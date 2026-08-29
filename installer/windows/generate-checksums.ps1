[CmdletBinding()]
param(
    [string]$ReleaseDirectory
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ReleaseDirectory)) {
    $repoRoot = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
    $ReleaseDirectory = Join-Path $repoRoot "release"
}
$releaseRoot = (Resolve-Path $ReleaseDirectory).Path
$repoRoot = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
$versionPath = Join-Path $repoRoot "VERSION"
if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
    throw "VERSION file not found: $versionPath"
}
$version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+-(alpha|beta)\.\d+$') {
    throw "VERSION is not a supported pre-release version: $version"
}
$expectedFiles = @(
    "capture-for-tolaria-extension-v$version.zip",
    "capture-for-tolaria-installer-v$version.zip",
    "capture-for-tolaria-helper-$version-windows-x64.exe",
    "SBOM.spdx.json"
)
foreach ($expectedFile in $expectedFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot $expectedFile) -PathType Leaf)) {
        throw "Release asset is missing: $expectedFile"
    }
}
$checksumPath = Join-Path $releaseRoot "SHA256SUMS.txt"
$lines = @(
    foreach ($expectedFile in $expectedFiles) {
        $expectedPath = Join-Path $releaseRoot $expectedFile
        $hash = (Get-FileHash -LiteralPath $expectedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $expectedFile"
    }
)
$utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllLines($checksumPath, [string[]]$lines, $utf8NoBom)
Write-Output $checksumPath
