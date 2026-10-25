param([switch]$ResumeVerified,[switch]$OddCssAxesOnly)
$ErrorActionPreference='Stop'
$gameRoot='F:\Patricks.Parabox_inject_debug'
$cases=@(
    @{Width=1600;Height=1200;Levels=@('first_puzzle','second_puzzle','third_puzzle')},
    @{Width=2002;Height=1466;Levels=@('first_puzzle','second_puzzle','third_puzzle')},
    @{Width=2560;Height=1440;Levels=@('first_puzzle','second_puzzle','third_puzzle')},
    @{Width=2560;Height=1800;Levels=@('third_puzzle')}
)
if ($OddCssAxesOnly) {$cases=@(@{Width=2002;Height=1398;Levels=@('first_puzzle')})}
foreach ($case in $cases) {
    foreach ($level in $case.Levels) {
        $id='native-framebuffer-'+$case.Width+'x'+$case.Height+'-'+$level.Replace('_','-')+'-v15-20261025'
        $destination=Join-Path $PSScriptRoot ('..\..\docs\parity\evidence\original\'+$id)
        if (Test-Path -LiteralPath $destination) {
            if (-not $ResumeVerified) {throw ('Capture ID already exists: '+$id)}
            $prior=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $destination 'resolution-request.json') | ConvertFrom-Json
            if ($prior.requested[0] -ne $case.Width -or $prior.requested[1] -ne $case.Height) {throw ('Unexpected existing request: '+$id)}
        } else {
            & (Join-Path $PSScriptRoot 'capture.ps1') -Id $id -Level ($level+':'+$case.Width+':'+$case.Height) -Mode Static | Out-Null
        }
        $capture=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $destination 'capture.json') | ConvertFrom-Json
        if ($capture.requestId -ne $id -or $capture.level -ne $level) {throw ('Unexpected capture identity: '+$id)}
        $pngs=@(Get-ChildItem -LiteralPath $destination -Filter 'static-*.png' | Sort-Object Name)
        if ($pngs.Count -ne 3) {throw ('Expected three native PNGs: '+$id)}
        $dimensions=[ordered]@{}
        $applied=$capture.screenWidth -eq $case.Width -and $capture.screenHeight -eq $case.Height
        foreach ($png in $pngs) {
            $bytes=[IO.File]::ReadAllBytes($png.FullName)
            if ([BitConverter]::ToString($bytes[0..7]) -ne '89-50-4E-47-0D-0A-1A-0A') {throw ('Invalid native PNG: '+$png.Name)}
            [byte[]]$widthBytes=$bytes[16..19];[Array]::Reverse($widthBytes)
            [byte[]]$heightBytes=$bytes[20..23];[Array]::Reverse($heightBytes)
            $width=[BitConverter]::ToUInt32($widthBytes,0);$height=[BitConverter]::ToUInt32($heightBytes,0)
            if ($width -ne $capture.screenWidth -or $height -ne $capture.screenHeight) {throw ('Screen/PNG dimensions disagree: '+$id)}
            $dimensions[$png.Name]=@($width,$height)
            $applied=$applied -and $width -eq $case.Width -and $height -eq $case.Height
        }
        $status=if ($applied) {'native-size-applied'} else {'unsupported-request-not-applied'}
        $requestPath=Join-Path $destination 'resolution-request.json'
        if (-not (Test-Path -LiteralPath $requestPath)) {
            [ordered]@{requested=@($case.Width,$case.Height);command=('CAPTURE:'+$level+':'+$case.Width+':'+$case.Height);actualScreen=@($capture.screenWidth,$capture.screenHeight);pngDimensions=$dimensions;status=$status;resampled=$false;drawLogicChanged=$false} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $requestPath
        }
        $buildPath=Join-Path $destination 'observer-build.json'
        if (-not (Test-Path -LiteralPath $buildPath)) {
            [ordered]@{sourceSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $PSScriptRoot 'Plugin.cs')).Hash.ToLower();dllSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $gameRoot 'BepInEx\plugins\AgentObserver\AgentObserver.dll')).Hash.ToLower();buildWarnings=0;buildErrors=0;resolutionPath='Existing ConfigureCaptureResolution→Screen.SetResolution(width,height,false)';capturePath='Existing RunCaptureScenario→WaitForEndOfFrame→ScreenCapture.CaptureScreenshotAsTexture';freshStatePath='Existing World.GoToLevel with no setup commands';referenceLogicalViewport=@(($case.Width/2),($case.Height/2));intendedWebDpr=2;resampled=$false;nativeDrawLogicChanged=$false;cuaOrOsBypass=$false;note='Actual native framebuffer dimensions checked independently from PNG IHDR and capture Screen.width/height. Unsupported/clamped requests are retained with explicit status.'} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $buildPath
        }
        [ordered]@{id=$id;requested=@($case.Width,$case.Height);actual=@($capture.screenWidth,$capture.screenHeight);pngs=$pngs.Count;status=$status} | ConvertTo-Json -Compress
    }
}
