$ErrorActionPreference='Stop'
$gameRoot='F:\Patricks.Parabox_inject_debug'
$id='native-gui-font-alignment-pairs-v14-20261025'
$destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
[IO.File]::WriteAllLines((Join-Path $gameRoot 'BepInEx\AgentObserver-command.txt'),@($id,'GUI_FONT_ALIGNMENT_PAIRS'),[Text.UTF8Encoding]::new($false))
$deadline=[DateTime]::UtcNow.AddSeconds(30)
$result=$null
do {
    Start-Sleep -Milliseconds 100
    try {$result=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $gameRoot 'BepInEx\AgentObserver-result.json') | ConvertFrom-Json} catch [System.IO.IOException] {continue}
} while ($result.requestId -ne $id -and [DateTime]::UtcNow -lt $deadline)
if ($result.requestId -ne $id) {throw ('Timed out: '+$id)}
if ($result.error) {throw $result.error}
New-Item -ItemType Directory -Path $destination | Out-Null
Get-ChildItem -LiteralPath (Join-Path $gameRoot ('BepInEx\parity-captures\'+$id)) | Copy-Item -Destination $destination
[ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $gameRoot 'BepInEx\plugins\AgentObserver\AgentObserver.dll')).Hash.ToLower();buildWarnings=0;buildErrors=0;requestedFontSize=16;texts=@('Move','U');widths=@(361,362);origins=@(0,-.25);pairs=8;labels=16;columnTranslation=400;rectHeight=82;diagnosticOverlay=$true;nativeGuiMeshVerticesExposed=$false;note='Actual GUI.Label MiddleCenter and actual GUI.Label UpperLeft paired using native center cursor and native padding/contentOffset. Explicit disjoint analysisRegion tiles isolate ink where shifted label rectangles overlap. Raw TextGenerator vertices remain separate comparators.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
[ordered]@{id=$id;labels=$result.samples.Count;probeKind=$result.probeKind} | ConvertTo-Json -Compress
