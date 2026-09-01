[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$ReleaseTag,
    [string]$ExtensionDirectory
)

$ErrorActionPreference = "Stop"
$scriptDirectory = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
$versionPath = Join-Path $repoRoot "VERSION"
if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
    throw "VERSION file not found: $versionPath"
}
$version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
if ($version -notmatch '^(?<chromeVersion>\d+\.\d+\.\d+)-(?<channel>alpha|beta)\.(?<releaseNumber>\d+)$') {
    throw "VERSION is not a supported pre-release version: $version"
}
$chromeVersion = $Matches.chromeVersion
$channelName = if ($Matches.channel -eq "alpha") { "Alpha" } else { "Beta" }
$releaseNumber = $Matches.releaseNumber
$expectedVersionName = "$chromeVersion $channelName $releaseNumber"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repoRoot "release"
}
$OutputDirectory = (New-Item -ItemType Directory -Path $OutputDirectory -Force).FullName
if ([string]::IsNullOrWhiteSpace($ReleaseTag)) {
    $ReleaseTag = if ([string]::IsNullOrWhiteSpace($env:GITHUB_REF_NAME)) { "v$version" } else { $env:GITHUB_REF_NAME }
}
if ($ReleaseTag -ne "v$version") {
    throw "Release tag $ReleaseTag does not match VERSION $version"
}

if ([string]::IsNullOrWhiteSpace($ExtensionDirectory)) {
    $extensionDist = Join-Path $repoRoot "apps\extension\dist"
}
else {
    $extensionDist = (Resolve-Path $ExtensionDirectory).Path
}
$helperName = "capture-for-tolaria-helper-$version-windows-x64.exe"
$helperPath = Join-Path $OutputDirectory $helperName
if (-not (Test-Path -LiteralPath $extensionDist -PathType Container)) {
    throw "Extension build output not found: $extensionDist"
}
if (-not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
    throw "SEA Helper not found: $helperPath"
}

$stagingRoot = Join-Path $OutputDirectory ".staging-$PID"
$extensionStage = Join-Path $stagingRoot "extension"
$installerStage = Join-Path $stagingRoot "installer-package"
$installerExtensionStage = Join-Path $installerStage "extension"
try {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $extensionStage, $installerExtensionStage, (Join-Path $installerStage "installer\windows") -Force | Out-Null
    Copy-Item -Path (Join-Path $extensionDist "*") -Destination $extensionStage -Recurse -Force
    Copy-Item -Path (Join-Path $extensionDist "*") -Destination $installerExtensionStage -Recurse -Force
    Copy-Item -Path (Join-Path $scriptDirectory "*.ps1") -Destination (Join-Path $installerStage "installer\windows") -Force
    Copy-Item -Path (Join-Path $scriptDirectory "*.json") -Destination (Join-Path $installerStage "installer\windows") -Force
    Copy-Item -Path (Join-Path $scriptDirectory "*.in") -Destination (Join-Path $installerStage "installer\windows") -Force
    Copy-Item -Path (Join-Path $scriptDirectory "*.md") -Destination (Join-Path $installerStage "installer\windows") -Force
    Copy-Item -LiteralPath @(
        (Join-Path $repoRoot "INSTALL-WINDOWS.md"),
        (Join-Path $repoRoot "README.md"),
        (Join-Path $repoRoot "LICENSE"),
        (Join-Path $repoRoot "THIRD_PARTY_NOTICES.md"),
        (Join-Path $repoRoot "VERSION")
    ) -Destination $installerStage -Force
    Copy-Item -LiteralPath $helperPath -Destination (Join-Path $installerStage $helperName) -Force

    $extensionZip = Join-Path $OutputDirectory "capture-for-tolaria-extension-$ReleaseTag.zip"
    $installerZip = Join-Path $OutputDirectory "capture-for-tolaria-installer-$ReleaseTag.zip"
    Remove-Item -LiteralPath $extensionZip, $installerZip -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path (Join-Path $extensionStage "*") -DestinationPath $extensionZip -Force
    Compress-Archive -Path (Join-Path $installerStage "*") -DestinationPath $installerZip -Force

    $hostTemplate = Get-Content -LiteralPath (Join-Path $scriptDirectory "native-host-manifest.json.in") -Raw | ConvertFrom-Json
    if (@($hostTemplate.allowed_origins) -notcontains "chrome-extension://ncjeeembmcgkfjipkfhganbdnadbhdcl/") {
        throw "Native Host allowed_origins does not contain the fixed Extension ID"
    }

    $extensionUnpack = Join-Path $env:TEMP "capture-for-tolaria-extension-check-$PID"
    $unpack = Join-Path $env:TEMP "capture-for-tolaria-installer-check-$PID"
    try {
        Expand-Archive -LiteralPath $extensionZip -DestinationPath $extensionUnpack -Force
        $extensionManifest = Get-Content -LiteralPath (Join-Path $extensionUnpack "manifest.json") -Raw | ConvertFrom-Json
        $permissions = @($extensionManifest.permissions | Sort-Object) -join ","
        if ($permissions -ne "activeTab,nativeMessaging,scripting,storage" -or $null -ne $extensionManifest.host_permissions -or $extensionManifest.options_page -ne "options.html") {
            throw "Extension manifest permissions are outside the V0.1 contract"
        }
        if ($extensionManifest.version -ne $chromeVersion -or $extensionManifest.version_name -ne $expectedVersionName) {
            throw "Extension manifest version contract is invalid"
        }

        Expand-Archive -LiteralPath $installerZip -DestinationPath $unpack -Force
        $requiredFiles = @(
            $helperName,
            "VERSION",
            "extension\manifest.json",
            "extension\background.js",
            "extension\options.html",
            "extension\popup.html",
            "installer\windows\install.ps1",
            "installer\windows\repair.ps1",
            "installer\windows\configure-vault.ps1",
            "installer\windows\uninstall.ps1",
            "installer\windows\native-host-manifest.json.in",
            "installer\windows\install-extension.md",
            "INSTALL-WINDOWS.md"
        )
        foreach ($requiredFile in $requiredFiles) {
            if (-not (Test-Path -LiteralPath (Join-Path $unpack $requiredFile))) {
                throw "Installer archive is missing $requiredFile"
            }
        }
    }
    finally {
        Remove-Item -LiteralPath $extensionUnpack -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $unpack -Recurse -Force -ErrorAction SilentlyContinue
    }

    [pscustomobject]@{
        extensionZip = $extensionZip
        installerZip = $installerZip
        helper = $helperPath
    }
}
finally {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}
