param([ValidateSet('enter','third_puzzle')][string]$Level)
$ErrorActionPreference='Stop'
$cases=@(
    @{id='inspection-enter-pointer-native-v3-20261025';level='enter';x=340;y=250;expected='valid-nonfilled-push-pop'},
    @{id='inspection-third-gold-pointer-native-v2-20261025';level='third_puzzle';x=400;y=190;expected='filled-child-reject'}
)
foreach ($probe in $cases) {
    if ($Level -and $probe.level -ne $Level) {continue}
    $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$probe.id)
    if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
    $pointer='POINTER_'+$probe.x+'_'+$probe.y+'_'
    $timeline=@(($pointer+'MOVE:100'),($pointer+'LEFT:40'),($pointer+'MOVE:750'),($pointer+'RIGHT:40'),($pointer+'MOVE:750'))
    & (Join-Path $PSScriptRoot 'capture.ps1') -Id $probe.id -Level $probe.level -Mode Motion -Commands ('| '+($timeline -join ' ')) -TimeoutSeconds 45
    [ordered]@{id=$probe.id;level=$probe.level;setup=@();timedCommands=$timeline;topLeftPointer=@($probe.x,$probe.y);expectedBranch=$probe.expected;note='Temporary Unity InputSystem Mouse device supplies raw coordinate path; effective Controls flags injected after Controls.Update. Original ComputeMousePosition/InspectUpdate process all gates and call PushInspect/PopInspect themselves. Prior device restored. No OS mouse, CUA or physical focus replay claim.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'probe.json')
    [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll').Hash.ToLower();buildWarnings=0;buildErrors=0} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
}
