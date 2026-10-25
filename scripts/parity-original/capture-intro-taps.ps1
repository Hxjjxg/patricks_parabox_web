param([Parameter(Mandatory=$true)][ValidateSet('first_puzzle','second_puzzle','third_puzzle')][string]$Level)
$ErrorActionPreference='Stop'
$repository=Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')
$short=@{first_puzzle='first';second_puzzle='second';third_puzzle='third'}[$Level]
foreach ($direction in @('RIGHT','UP','LEFT','DOWN')) {
    $id='intro-'+$short+'-'+$direction.ToLower()+'-native-v1-20261025'
    $destination=Join-Path $repository ('docs\parity\evidence\original\'+$id)
    if (Test-Path -LiteralPath $destination) { throw ('Capture already exists: '+$destination) }
    & (Join-Path $PSScriptRoot 'capture.ps1') -Id $id -Level $Level -Mode Motion -Commands ('| '+$direction+':40 NONE:400') -TimeoutSeconds 30
    [ordered]@{id=$id;level=$Level;freshLoad=$true;setup=@();direction=$direction;requestedTapMs=40;requestedReleaseMs=400;timedCommands=@(($direction+':40'),'NONE:400');note='Each direction invokes a separate original GoToLevel. Nominal coroutine duration is not an exact delivered-input boundary; phases.json records actual controls/update/history.'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'probe.json')
    [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll').Hash.ToLower();buildWarnings=0;buildErrors=0;note='Natural original movement. All timed input/frame phases observed, all frame-end PNGs retained.'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
}
