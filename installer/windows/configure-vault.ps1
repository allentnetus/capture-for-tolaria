[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$VaultPath,
    [string]$ConfigPath = (Join-Path $env:LOCALAPPDATA "CaptureForTolaria\config.json")
)

$ErrorActionPreference = "Stop"

$item = Get-Item -LiteralPath $VaultPath -Force -ErrorAction Stop
if (-not $item.PSIsContainer) {
    throw "VaultPath must be a directory"
}
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Vault root must not be a reparse point"
}

$resolvedVault = $item.FullName
$configPath = $ConfigPath
$configDirectory = Split-Path -Parent $configPath
$tempPath = Join-Path $configDirectory "config.json.tmp-$PID"

New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$config = @{ vaultRoot = $resolvedVault } | ConvertTo-Json -Depth 3
try {
    $utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($tempPath, $config, $utf8NoBom)
    Move-Item -LiteralPath $tempPath -Destination $configPath -Force
}
finally {
    if (Test-Path -LiteralPath $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force
    }
}

[pscustomobject]@{
    configPath = $configPath
    vaultRoot = $resolvedVault
    inboxCreated = $false
}
