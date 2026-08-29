[CmdletBinding()]
param(
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $scriptDirectory "..\..\release"
}
$OutputDirectory = (New-Item -ItemType Directory -Path $OutputDirectory -Force).FullName
$versionPath = Join-Path $repoRoot "VERSION"
if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
    throw "VERSION file not found: $versionPath"
}
$version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+-(alpha|beta)\.\d+$') {
    throw "VERSION is not a supported pre-release version: $version"
}
$outputName = "capture-for-tolaria-helper-$version-windows-x64.exe"
$blobPath = Join-Path $repoRoot "installer\windows\capture-for-tolaria-helper-$version-windows-x64.blob"
$outputPath = Join-Path $OutputDirectory $outputName
$sentinel = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

$seaTemplatePath = Join-Path $repoRoot "installer\windows\helper-sea-config.json"
$seaConfigPath = Join-Path $env:TEMP "capture-for-tolaria-sea-$PID.json"
$seaTemplate = Get-Content -LiteralPath $seaTemplatePath -Raw | ConvertFrom-Json
$seaTemplate.main = Join-Path $repoRoot "apps\helper\dist\sea-entry.cjs"
$seaTemplate.output = $blobPath
$utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($seaConfigPath, ($seaTemplate | ConvertTo-Json -Depth 8), $utf8NoBom)

Push-Location $repoRoot
try {
    & pnpm.cmd --filter @capture-for-tolaria/helper build
    if ($LASTEXITCODE -ne 0) {
        throw "Helper TypeScript build failed"
    }

    & node --experimental-sea-config $seaConfigPath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $blobPath)) {
        throw "Node SEA blob generation failed"
    }

    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Copy-Item -LiteralPath $nodePath -Destination $outputPath -Force
    & pnpm.cmd exec postject $outputPath NODE_SEA_BLOB $blobPath --sentinel-fuse $sentinel
    if ($LASTEXITCODE -ne 0) {
        throw "Node SEA blob injection failed"
    }

    Remove-Item -LiteralPath $blobPath -Force
    if (-not (Test-Path -LiteralPath $outputPath)) {
        throw "Helper executable was not produced"
    }
    Write-Output $outputPath
}
finally {
    Pop-Location
    Remove-Item -LiteralPath $seaConfigPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $blobPath -Force -ErrorAction SilentlyContinue
}
