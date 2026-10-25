param(
    [Parameter(Mandatory=$true)][string]$Id,
    [Parameter(Mandatory=$true)][string]$Level,
    [ValidateSet("Static","Motion","IsolatedMotion","SparseMotion")][string]$Mode = "Static",
    [string]$Commands = "",
    [string]$Save = "",
    [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
if ($Id -notmatch "^[A-Za-z0-9_-]+$") { throw "Id must be a simple artifact directory name" }
$gameRoot = "F:\Patricks.Parabox_inject_debug"
$requestPath = Join-Path $gameRoot "BepInEx\AgentObserver-command.txt"
$resultPath = Join-Path $gameRoot "BepInEx\AgentObserver-result.json"
$prefix = if ($Mode -eq "IsolatedMotion") { "ISOLATED_MOTION" } elseif ($Mode -eq "SparseMotion") { "SPARSE_MOTION" } elseif ($Mode -eq "Motion") { "MOTION" } else { "CAPTURE" }
$lines=@($Id, "${prefix}:$Level")
if ($Save) { $lines += $Save }
$lines += $Commands
[IO.File]::WriteAllLines($requestPath, $lines, [Text.UTF8Encoding]::new($false))
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$result = $null
do {
    Start-Sleep -Milliseconds 100
    if (Test-Path -LiteralPath $resultPath) {
        try { $result = Get-Content -Raw -Encoding UTF8 -LiteralPath $resultPath | ConvertFrom-Json }
        catch [System.IO.IOException] { continue }
    }
} while ($result.requestId -ne $Id -and [DateTime]::UtcNow -lt $deadline)
if ($result.requestId -ne $Id) { throw "Timed out waiting for original capture $Id" }
if ($result.error) { throw $result.error }
$destination = Join-Path $PSScriptRoot "..\..\docs\parity\evidence\original\$Id"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Get-ChildItem -LiteralPath (Join-Path $gameRoot "BepInEx\parity-captures\$Id") | Copy-Item -Destination $destination -Force
[PSCustomObject]@{Id=$Id; Level=$Level; Width=$result.screenWidth; Height=$result.screenHeight; Frames=$result.frames.Count; Directory=(Resolve-Path -LiteralPath $destination).Path} | ConvertTo-Json -Compress
