$ErrorActionPreference='Stop'
$gameRoot='F:\Patricks.Parabox_inject_debug'
$texts=@('Move','Undo','U','Move ','Note: You can undo a reset')
foreach ($size in @(12,16,20)) {
    foreach ($width in @(361,362,363)) {
        foreach ($textIndex in 0..4) {
            $id='native-gui-font-sampling-s'+$size+'-w'+$width+'-t'+$textIndex+'-v13-20261025'
            $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
            if (Test-Path -LiteralPath $destination) {throw ('Capture already exists: '+$destination)}
            [IO.File]::WriteAllLines((Join-Path $gameRoot 'BepInEx\AgentObserver-command.txt'),@($id,('GUI_FONT_SAMPLING:'+$size+':'+$width+':'+$textIndex)),[Text.UTF8Encoding]::new($false))
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
            [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $gameRoot 'BepInEx\plugins\AgentObserver\AgentObserver.dll')).Hash.ToLower();buildWarnings=0;buildErrors=0;requestedFontSize=$size;requestedWidth=$width;requestedTextIndex=$textIndex;requestedText=$texts[$textIndex];origins=@(-1,-.75,-.5,-.25,0,.25,.5,.75,1);diagnosticOverlay=$true;nativeGuiMeshVerticesExposed=$false;note='Actual native DrawText/GUI.Label raster/rect/style. Raw UIVertex positions and UVs belong to explicitly separate TextGenerator comparators; private GUI mesh vertices are not exposed.'} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'observer-build.json')
            [ordered]@{id=$id;labels=$result.samples.Count;fontSize=$size;width=$width;text=$texts[$textIndex];atlasCharactersPerSize=$result.charactersPerSize} | ConvertTo-Json -Compress
        }
    }
}
