$ErrorActionPreference='Stop'
$gameRoot='F:\Patricks.Parabox_inject_debug'
foreach ($size in @(12,16,20)) {
    foreach ($origin in @('INTEGER','FRACTION')) {
        $id='native-gui-font-variety-size'+$size+'-'+$origin.ToLower()+'-v12-20261025'
        $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
        if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
        [IO.File]::WriteAllLines((Join-Path $gameRoot 'BepInEx\AgentObserver-command.txt'),@($id,('GUI_FONT_VARIETY:'+$size+':'+$origin)),[Text.UTF8Encoding]::new($false))
        $deadline=[DateTime]::UtcNow.AddSeconds(30)
        $result=$null
        do {
            Start-Sleep -Milliseconds 100
            try { $result=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $gameRoot 'BepInEx\AgentObserver-result.json') | ConvertFrom-Json } catch [System.IO.IOException] {continue}
        } while ($result.requestId -ne $id -and [DateTime]::UtcNow -lt $deadline)
        if ($result.requestId -ne $id) {throw ('Timed out: '+$id)}
        if ($result.error) {throw $result.error}
        New-Item -ItemType Directory -Path $destination | Out-Null
        Get-ChildItem -LiteralPath (Join-Path $gameRoot ('BepInEx\parity-captures\'+$id)) | Copy-Item -Destination $destination
        [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $gameRoot 'BepInEx\plugins\AgentObserver\AgentObserver.dll')).Hash.ToLower();buildWarnings=0;buildErrors=0;requestedFontSize=$size;origin=$origin;diagnosticOverlay=$true;note='Actual native DrawText/GUI.Label style. Each sample exports UpperLeft and MiddleCenter TextGenerator with full rect and rect-minus-padding extents; these are explicit diagnostic comparators, not an assumed GUI internals mapping.'} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
        [ordered]@{id=$id;labels=$result.samples.Count;fontSize=$size;origin=$origin;atlasCharactersPerSize=$result.charactersPerSize} | ConvertTo-Json -Compress
    }
}
