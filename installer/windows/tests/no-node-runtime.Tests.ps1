Describe "single-file Helper" {
    BeforeAll {
        $scriptRoot = Split-Path -Parent $PSScriptRoot

        function New-NativeFrame([string]$Json) {
            $payload = [Text.Encoding]::UTF8.GetBytes($Json)
            $header = [BitConverter]::GetBytes([uint32]$payload.Length)
            return $header + $payload
        }

        function Read-NativeFrame($Stream) {
            $header = New-Object byte[] 4
            $read = $Stream.Read($header, 0, 4)
            if ($read -ne 4) {
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
    }

    It "answers hello without requiring a Node.js runtime" {
        $repoRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
        $helper = Join-Path $repoRoot "release\capture-for-tolaria-helper-0.1.0-alpha.1-windows-x64.exe"
        if (-not (Test-Path -LiteralPath $helper)) {
            throw "Build the SEA Helper before running this test"
        }

        $startInfo = [Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $helper
        $startInfo.UseShellExecute = $false
        $startInfo.RedirectStandardInput = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $startInfo
        $process.Start() | Should -Be $true

        $request = '{"protocolVersion":1,"requestId":"hello-test","extensionVersion":"0.1.0-alpha.1","action":"hello"}'
        $frame = New-NativeFrame $request
        $process.StandardInput.BaseStream.Write($frame, 0, $frame.Length)
        $process.StandardInput.BaseStream.Flush()
        $process.StandardInput.Close()
        $response = Read-NativeFrame $process.StandardOutput.BaseStream
        $process.WaitForExit(5000) | Out-Null

        $response.protocolVersion | Should -Be 1
        ($response.capabilities -contains "clip.article") | Should -Be $true
        $process.ExitCode | Should -Be 0
    }
}
