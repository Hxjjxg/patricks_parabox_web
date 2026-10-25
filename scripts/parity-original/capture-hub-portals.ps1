param([ValidateSet('first','second','third','enter')][string]$Case)
$ErrorActionPreference='Stop'
$cases=@{
    first=@{level='first_puzzle';setup='RIGHT DOWN DOWN';won=''}
    second=@{level='second_puzzle';setup='DOWN DOWN';won='first_puzzle'}
    third=@{level='third_puzzle';setup='LEFT DOWN DOWN';won='first_puzzle,second_puzzle'}
    enter=@{level='enter';setup='LEFT LEFT LEFT DOWN DOWN DOWN DOWN';won='first_puzzle,second_puzzle,third_puzzle'}
}
foreach ($key in $(if ($Case) {@($Case)} else {@('first','second','third','enter')})) {
    $probe=$cases[$key]
    $id='hub-'+$key+'-portal-leave-native-v1-20261025'
    $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
    if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
    $save='SAVE nexus=0 recent=Area_Intro won='+$probe.won
    $timeline='DOWN:1000 NONE:200 ESCAPE:40 NONE:120 DOWN:40 NONE:120 CONFIRM:40 NONE:1200'
    & (Join-Path $PSScriptRoot 'capture.ps1') -Id $id -Level hub -Mode IsolatedMotion -Save $save -Commands ($probe.setup+' | '+$timeline) -TimeoutSeconds 45
    $phases=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $destination 'phases.json') | ConvertFrom-Json
    foreach ($expected in @($probe.level,'hub')) {
        if (-not @($phases.samples | Where-Object {$_.phase -eq ('level-after:'+$expected)}).Count) {throw ('Expected natural level event absent: '+$expected)}
    }
    [ordered]@{id=$id;level='hub';destination=$probe.level;save=$save;setup=($probe.setup -split ' ');timedCommands=($timeline -split ' ');inputBoundary='controls-delivered after actual Controls.Update; native World/PauseMenu run normally';note='Fresh isolated save initializes only listed wins; portal step, held input, Escape/down/confirm and Leave puzzle are actual delivered native controls. No direct GoToHub/PushInspect entrypoint.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'probe.json')
    [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll').Hash.ToLower();buildWarnings=0;buildErrors=0} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
}
