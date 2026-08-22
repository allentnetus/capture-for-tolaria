$script:scriptRoot = Split-Path -Parent $PSScriptRoot
$script:repoRoot = (Resolve-Path (Join-Path $script:scriptRoot "..\..")).Path

function script:New-NativeFrame([string]$Json) {
    $payload = [Text.Encoding]::UTF8.GetBytes($Json)
    $header = [BitConverter]::GetBytes([uint32]$payload.Length)
    return $header + $payload
}

function script:Read-NativeFrame($Stream) {
    $header = New-Object byte[] 4
    if ($Stream.Read($header, 0, 4) -ne 4) {
        throw "Helper did not return a Native Messaging header"
    }
    $length = [BitConverter]::ToUInt32($header, 0)
    $payload = New-Object byte[] $length
    $offset = 0
    while ($offset -lt $length) {
        $chunk = $Stream.Read($payload, $offset, $length - $offset)
        if ($chunk -le 0) {
            throw "Helper returned a truncated Native Messaging payload"
        }
        $offset += $chunk
    }
    return [Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json
}

Describe "Windows PowerShell Vault configuration" {
    BeforeAll {
        $script:testRoot = Join-Path $env:TEMP "capture-for-tolaria-config-helper-$PID"
        $script:vault = Join-Path $script:testRoot "Vault"
        $script:configPath = Join-Path $script:testRoot "CaptureForTolaria\config.json"
        $script:helper = Join-Path $script:repoRoot "release\capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe"
        New-Item -ItemType Directory -Path $script:vault -Force | Out-Null
    }

    It "configures with Windows PowerShell 5.1 and writes through SEA Helper" {
        if (-not (Test-Path -LiteralPath $script:helper)) {
            throw "Build the SEA Helper before running this test"
        }
        $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
        & $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:scriptRoot "configure-vault.ps1") `
            -VaultPath $script:vault `
            -ConfigPath $script:configPath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "configure-vault.ps1 failed under Windows PowerShell"
        }

        $configBytes = [IO.File]::ReadAllBytes($script:configPath)
        $configBytes[0] | Should Be ([byte][char]'{')
        $configBytes[0] | Should Not Be 239

        $startInfo = [Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $script:helper
        $startInfo.UseShellExecute = $false
        $startInfo.RedirectStandardInput = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $startInfo.EnvironmentVariables["CAPTURE_FOR_TOLARIA_CONFIG_PATH"] = $script:configPath
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $startInfo
        $process.Start() | Should Be $true

        $request = @{
            protocolVersion = 1
            requestId = "sea-config-test"
            extensionVersion = "0.1.0-alpha.1"
            action = "clip.article"
            payload = @{
                relativeFolder = "Inbox/Web"
                title = "SEA config smoke"
                markdown = "# SEA config smoke`n`nBody"
                sourceUrl = "https://example.com/sea"
                metadata = @{}
            }
        } | ConvertTo-Json -Compress -Depth 6
        $frame = New-NativeFrame $request
        $process.StandardInput.BaseStream.Write($frame, 0, $frame.Length)
        $process.StandardInput.BaseStream.Flush()
        $process.StandardInput.Close()
        $response = Read-NativeFrame $process.StandardOutput.BaseStream
        $process.WaitForExit(5000) | Out-Null

        $response.ok | Should Be $true
        $response.requestId | Should Be "sea-config-test"
        $response.error | Should Be $null
        $written = @(Get-ChildItem -LiteralPath (Join-Path $script:vault "Inbox\Web") -Filter "*.md")
        $written.Count | Should Be 1
        (Get-Content -LiteralPath $written[0].FullName -Raw) | Should Match "SEA config smoke"
        $process.ExitCode | Should Be 0
    }

    AfterAll {
        Remove-Item -LiteralPath $script:testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
