param(
    [Parameter(Mandatory=$true)][ValidateSet('infenter-walk','infenter-zone-focused','flip-first','flip-recursive-long')][string]$Case
)
$ErrorActionPreference='Stop'
$repository=Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')
$specs=@{
    'infenter-walk'=@{Id='infenter-first-walk-native-v1-20261025'; Level='infenter_first_2'; Fixture='infenter_first_2-walk.json'}
    'infenter-zone-focused'=@{Id='infenter-zone-focused-native-v1-20261025'; Level='infenter_zone_v2'; Fixture='infenter_zone_v2-focused.json'}
    'flip-first'=@{Id='flip-first-focused-native-v1-20261025'; Level='flip_first'; Fixture='flip_first-focused.json'}
    'flip-recursive-long'=@{Id='flip-recursive-long-native-v1-20261025'; Level='1by1_playerr_flip2'; Route='DDRURLUDDLUDDLRUDRUDLDRDULDRRRD'}
}
$spec=$specs[$Case]
$destination=Join-Path $repository ('docs\parity\evidence\original\'+$spec.Id)
if (Test-Path -LiteralPath $destination) { throw ('Capture already exists: '+$destination) }
if ($spec.Fixture) {
    $fixture=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repository ('tests\fixtures\original\'+$spec.Fixture)) | ConvertFrom-Json
    $route=@($fixture.trace | Where-Object command -ne 'START' | ForEach-Object command)
} else {
    $names=@{D='DOWN';U='UP';L='LEFT';R='RIGHT'}
    $route=@($spec.Route.ToCharArray() | ForEach-Object { $names[[string]$_] })
}
$timeline=@($route | ForEach-Object { $_+':40'; 'NONE:650' })
& (Join-Path $PSScriptRoot 'capture.ps1') -Id $spec.Id -Level $spec.Level -Mode SparseMotion -Commands ('| '+($timeline -join ' ')) -TimeoutSeconds 60
$metadata=[ordered]@{id=$spec.Id;level=$spec.Level;route=$route;fixture=$spec.Fixture;timedCommands=$timeline;mode='SparseMotion';tapMs=40;releaseMs=650;note='All native update/accepted phases and frame states are retained. PNGs sample each event start, every eighth frame and final 40ms; file=null explicitly marks unsaved frames. No active animation is stopped.'}
$metadata | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'route.json')
$dll='F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll'
[ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $dll).Hash.ToLower();buildWarnings=0;buildErrors=0;note='Read-only phase and shine submission observer; sparse PNG encoding only. Native rules run unchanged.'} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
