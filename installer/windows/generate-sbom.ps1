[CmdletBinding()]
param(
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $scriptDirectory "..\..\release\SBOM.spdx.json"
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$versionPath = Join-Path $repoRoot "VERSION"
if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
    throw "VERSION file not found: $versionPath"
}
$version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+-alpha\.\d+$') {
    throw "VERSION is not a supported Alpha version: $version"
}
$manifestPaths = @(
    (Join-Path $repoRoot "package.json")
) + @(Get-ChildItem -Path (Join-Path $repoRoot "apps"), (Join-Path $repoRoot "packages") -Filter package.json -Recurse | Select-Object -ExpandProperty FullName)

function Get-SpdxId([string]$Name) {
    $safe = ($Name -replace "[^A-Za-z0-9.-]", "-").Trim("-")
    if ([string]::IsNullOrWhiteSpace($safe)) {
        $safe = "package"
    }
    return "SPDXRef-$safe"
}

$packageIndex = @{}
foreach ($manifestPath in $manifestPaths) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $workspaceId = Get-SpdxId $manifest.name
    $packageIndex[$workspaceId] = @{
        SPDXID = $workspaceId
        name = $manifest.name
        versionInfo = $manifest.version
        downloadLocation = "NOASSERTION"
        filesAnalyzed = $false
        licenseConcluded = "NOASSERTION"
        licenseDeclared = "NOASSERTION"
        copyrightText = "NOASSERTION"
    }
    foreach ($section in @("dependencies", "devDependencies")) {
        $values = $manifest.$section
        if ($null -eq $values) { continue }
        foreach ($property in $values.PSObject.Properties) {
            $id = Get-SpdxId $property.Name
            if (-not $packageIndex.ContainsKey($id)) {
                $packageIndex[$id] = @{
                    SPDXID = $id
                    name = $property.Name
                    versionInfo = [string]$property.Value
                    downloadLocation = "NOASSERTION"
                    filesAnalyzed = $false
                    licenseConcluded = "NOASSERTION"
                    licenseDeclared = "NOASSERTION"
                    copyrightText = "NOASSERTION"
                }
            }
        }
    }
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$document = @{
    spdxVersion = "SPDX-2.3"
    dataLicense = "CC0-1.0"
    SPDXID = "SPDXRef-DOCUMENT"
    name = "Capture for Tolaria $version"
    documentNamespace = "https://capture-for-tolaria.invalid/spdx/$([guid]::NewGuid())"
    creationInfo = @{
        created = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        creators = @("Tool: Capture for Tolaria SBOM generator")
    }
    packages = @($packageIndex.Values)
} | ConvertTo-Json -Depth 8
Set-Content -LiteralPath $OutputPath -Value $document -Encoding utf8
Write-Output $OutputPath
