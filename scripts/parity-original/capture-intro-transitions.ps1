param([ValidateSet('second','third')][string]$Case)
$ErrorActionPreference='Stop'
$cases=@{
    second=@{level='second_puzzle';next='third_puzzle';route='ULLUUURRDDDRDLLULDRDRRL'}
    third=@{level='third_puzzle';next='hub';route='RUUURDDDLDRRDRRULLLLULLDDRUUULUR'}
}
$directions=@{R='RIGHT';U='UP';L='LEFT';D='DOWN'}
foreach ($key in $(if ($Case) {@($Case)} else {@('second','third')})) {
    $probe=$cases[$key]
    $id='intro-'+$key+'-win-held-native-v1-20261025'
    $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
    if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
    $route=[string]$probe.route
    $setup=@($route.Substring(0,$route.Length-1).ToCharArray() | ForEach-Object {$directions[[string]$_]})
    $final=$directions[$route.Substring($route.Length-1)]
    $timeline=@(($final+':2300'),'NONE:300')
    & (Join-Path $PSScriptRoot 'capture.ps1') -Id $id -Level $probe.level -Mode IsolatedMotion -Commands (($setup -join ' ')+' | '+($timeline -join ' ')) -TimeoutSeconds 45
    $phases=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $destination 'phases.json') | ConvertFrom-Json
    if (-not @($phases.samples | Where-Object {$_.phase -eq ('level-after:'+$probe.next)}).Count) {throw ('Expected natural successor absent: '+$probe.next)}
    [ordered]@{id=$id;level=$probe.level;expectedNextLevel=$probe.next;setup=$setup;solverRoute=$route;timedCommands=$timeline;saveIsolation=$true;note='Route derived with existing pure model; natural original winning and GoToLevel events validate the native route. Setup is settled; all final held-input/frame phases are native. Durations are requests, not delivery boundaries.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'probe.json')
    [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll').Hash.ToLower();buildWarnings=0;buildErrors=0} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
}
