$ErrorActionPreference='Stop'
$cases=@(
    @{id='hub-enter-cancel-reenter-native-v1-20261025';level='hub';save='SAVE nexus=0 recent=Area_Intro won=first_puzzle,second_puzzle,third_puzzle';setup='LEFT LEFT LEFT DOWN DOWN DOWN DOWN';timeline='DOWN:40 NONE:80 UNDO:40 NONE:620 DOWN:900 NONE:300';purpose='Undo cancels first portal jump; a later DOWN naturally re-enters.'},
    @{id='hub-enter-direction-change-native-v1-20261025';level='hub';save='SAVE nexus=0 recent=Area_Intro won=first_puzzle,second_puzzle,third_puzzle';setup='LEFT LEFT LEFT DOWN DOWN DOWN DOWN';timeline='DOWN:40 RIGHT:700 NONE:300';purpose='RIGHT is delivered during the DOWN portal jump and remains held across natural scene load. Actual queue and accepted-turn records determine carryover.'},
    @{id='intro-third-win-restart-undo-native-v1-20261025';level='third_puzzle';save='SAVE nexus=0 recent=Area_Intro won=first_puzzle,second_puzzle';setup='RIGHT UP UP UP RIGHT DOWN DOWN DOWN LEFT DOWN RIGHT RIGHT DOWN RIGHT RIGHT UP LEFT LEFT LEFT LEFT UP LEFT LEFT DOWN DOWN RIGHT UP UP UP LEFT UP';timeline='RIGHT:40 NONE:120 RESTART:40 NONE:300 UNDO:40 NONE:2400';purpose='Natural final winning move; restart before completion, undo the restart, then observe resumed native win transition.'}
)
foreach ($probe in $cases) {
    $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$probe.id)
    if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
    & (Join-Path $PSScriptRoot 'capture.ps1') -Id $probe.id -Level $probe.level -Mode IsolatedMotion -Save $probe.save -Commands ($probe.setup+' | '+$probe.timeline) -TimeoutSeconds 45
    [ordered]@{id=$probe.id;level=$probe.level;save=$probe.save;setup=($probe.setup -split ' ');timedCommands=($probe.timeline -split ' ');purpose=$probe.purpose;note='Purpose is the tested hypothesis, not an inferred success. Phases, accepted turns, actual delivered controls and save audit are authoritative.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'probe.json')
    [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath 'F:\Patricks.Parabox_inject_debug\BepInEx\plugins\AgentObserver\AgentObserver.dll').Hash.ToLower();buildWarnings=0;buildErrors=0} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
}
