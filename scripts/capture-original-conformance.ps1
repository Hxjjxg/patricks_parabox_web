param(
    [switch]$KeepGameOpen,
    [switch]$Sweep,
    [switch]$InitialOnly,
    [int]$SweepLimit = 0,
    [int]$SweepSkip = 0,
    [int]$FuzzLength = 0,
    [int]$FuzzSeed = 1729,
    [switch]$HubMatrix
)

$ErrorActionPreference = 'Stop'

$gameRoot = 'F:\Patricks.Parabox_inject_debug'
$gameExe = Join-Path $gameRoot "Patrick's Parabox.exe"
$commandPath = Join-Path $gameRoot 'BepInEx\AgentObserver-command.txt'
$resultPath = Join-Path $gameRoot 'BepInEx\AgentObserver-result.json'
$fixtureRoot = if ($HubMatrix) {
    Join-Path $PSScriptRoot '..\tests\fixtures\original-hub'
}
elseif ($Sweep) {
    Join-Path $PSScriptRoot '..\tests\fixtures\original-sweep'
}
else {
    Join-Path $PSScriptRoot '..\tests\fixtures\original'
}
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$walk = 'UP RIGHT DOWN LEFT RIGHT RIGHT UP UP LEFT DOWN RIGHT UP LEFT LEFT DOWN DOWN RIGHT UP RIGHT DOWN LEFT UP'

function New-FuzzCommandSequence {
    param(
        [int]$Seed,
        [int]$Length
    )

    $random = [System.Random]::new($Seed)
    $directions = @('UP', 'RIGHT', 'DOWN', 'LEFT')
    $commands = [System.Collections.Generic.List[string]]::new()

    while ($commands.Count -lt $Length) {
        $roll = $random.Next(100)
        if ($roll -lt 72) {
            $direction = $directions[$random.Next($directions.Count)]
            $burstLength = $random.Next(1, 9)
            for (
                $burstIndex = 0;
                $burstIndex -lt $burstLength -and $commands.Count -lt $Length;
                $burstIndex++
            ) {
                $commands.Add($direction)
            }
        }
        elseif ($roll -lt 85) {
            $undoLength = $random.Next(1, 5)
            for (
                $undoIndex = 0;
                $undoIndex -lt $undoLength -and $commands.Count -lt $Length;
                $undoIndex++
            ) {
                $commands.Add('UNDO')
            }
        }
        elseif ($roll -lt 94) {
            $redoLength = $random.Next(1, 4)
            for (
                $redoIndex = 0;
                $redoIndex -lt $redoLength -and $commands.Count -lt $Length;
                $redoIndex++
            ) {
                $commands.Add('REDO')
            }
        }
        else {
            $commands.Add('RESTART')
        }
    }

    return $commands -join ' '
}

function Select-DeterministicSubset {
    param(
        [string[]]$Values,
        [int]$Count,
        [int]$Seed
    )

    $copy = [System.Collections.Generic.List[string]]::new()
    $copy.AddRange($Values)
    $random = [System.Random]::new($Seed)
    for ($index = $copy.Count - 1; $index -gt 0; $index--) {
        $other = $random.Next($index + 1)
        $temporary = $copy[$index]
        $copy[$index] = $copy[$other]
        $copy[$other] = $temporary
    }
    return @($copy | Select-Object -First $Count)
}

$scenarios = @(
    @{
        Name = 'first_puzzle-right-restart-undo'
        Level = 'first_puzzle'
        Commands = 'RIGHT RESTART UNDO'
    },
    @{
        Name = 'enter-walk'
        Level = 'enter'
        Commands = $walk
    },
    @{
        Name = 'possess_first-walk'
        Level = 'possess_first'
        Commands = $walk
    },
    @{
        Name = 'eat_same_side-walk'
        Level = 'eat_same_side'
        Commands = $walk
    },
    @{
        Name = 'flip_first-walk'
        Level = 'flip_first'
        Commands = $walk
    },
    @{
        Name = 'cycle_line-walk'
        Level = 'cycle_line'
        Commands = $walk
    },
    @{
        Name = 'shed_first-walk'
        Level = 'shed_first'
        Commands = $walk
    },
    @{
        Name = 'infenter_first_2-walk'
        Level = 'infenter_first_2'
        Commands = $walk
    },
    @{
        Name = 'infexit_ref_first-walk'
        Level = 'infexit_ref_first'
        Commands = $walk
    },
    @{
        Name = 'carry-walk'
        Level = 'carry'
        Commands = $walk
    },
    @{
        Name = 'cycle_line-start'
        Level = 'cycle_line'
        Commands = ''
    },
    @{
        Name = 'flip_first-start'
        Level = 'flip_first'
        Commands = ''
    },
    @{
        Name = 'infenter_first_2-start'
        Level = 'infenter_first_2'
        Commands = ''
    },
    @{
        Name = 'infexit_ref_first-start'
        Level = 'infexit_ref_first'
        Commands = ''
    },
    @{
        Name = 'enter-focused'
        Level = 'enter'
        Commands = 'RIGHT UP UP UP LEFT UP RIGHT RIGHT RIGHT RIGHT'
    },
    @{
        Name = 'possess_first-focused'
        Level = 'possess_first'
        Commands = 'LEFT DOWN DOWN LEFT LEFT'
    },
    @{
        Name = 'flip_first-focused'
        Level = 'flip_first'
        Commands = 'RIGHT DOWN DOWN RIGHT RIGHT'
    },
    @{
        Name = 'eat_same_side-focused'
        Level = 'eat_same_side'
        Commands = 'LEFT LEFT'
    },
    @{
        Name = 'shed_first-focused'
        Level = 'shed_first'
        Commands = 'RIGHT RIGHT RIGHT RIGHT UP UP'
    },
    @{
        Name = 'infenter_zone_v2-focused'
        Level = 'infenter_zone_v2'
        Commands = "$walk RIGHT RIGHT RIGHT RIGHT RIGHT UP UP UP UP UP LEFT LEFT LEFT LEFT LEFT DOWN DOWN DOWN DOWN"
    }
)

if ($HubMatrix) {
    $metadataPath = Join-Path $PSScriptRoot '..\src\assets\data\puzzle_data.txt'
    [string[]]$allLevels = Get-Content -Encoding UTF8 -LiteralPath $metadataPath |
        ForEach-Object {
            $trimmed = $_.Trim()
            if ($trimmed) {
                ($trimmed -split '\s+')[0]
            }
        }
    $random25 = Select-DeterministicSubset -Values $allLevels -Count 25 -Seed 11
    $random90 = Select-DeterministicSubset -Values $allLevels -Count 90 -Seed 73
    $random180 = Select-DeterministicSubset -Values $allLevels -Count 180 -Seed 137
    $hubCases = @(
        @{ Name = 'empty-intro'; Nexus = 0; Recent = 'Area_Intro'; Won = @() },
        @{ Name = 'empty-no-recent'; Nexus = 0; Recent = '_'; Won = @() },
        @{ Name = 'first-won'; Nexus = 0; Recent = 'Area_Intro'; Won = @('first_puzzle') },
        @{
            Name = 'intro-three-won'
            Nexus = 0
            Recent = 'Area_Intro'
            Won = @('first_puzzle', 'second_puzzle', 'third_puzzle')
        },
        @{ Name = 'random-25'; Nexus = 0; Recent = 'Area_Enter'; Won = $random25 },
        @{ Name = 'random-90'; Nexus = 0; Recent = 'Area_Flip'; Won = $random90 },
        @{ Name = 'random-180'; Nexus = 0; Recent = 'Area_InfiniteEnter'; Won = $random180 },
        @{ Name = 'nexus-empty'; Nexus = 1; Recent = 'Area_Reception'; Won = @() },
        @{ Name = 'all-no-nexus'; Nexus = 0; Recent = 'Area_Gallery'; Won = $allLevels },
        @{ Name = 'all-with-nexus'; Nexus = 1; Recent = 'Area_Reception'; Won = $allLevels }
    )
    $scenarios = @(
        foreach ($hubCase in $hubCases) {
            $wonCsv = @($hubCase.Won) -join ','
            @{
                Name = "hub-$($hubCase.Name)"
                Level = 'hub'
                Commands = ''
                Save = "SAVE nexus=$($hubCase.Nexus) recent=$($hubCase.Recent) won=$wonCsv"
            }
        }
    )
}
elseif ($Sweep) {
    $metadataPath = Join-Path $PSScriptRoot '..\src\assets\data\puzzle_data.txt'
    $levelRoot = Join-Path $PSScriptRoot '..\src\assets\levels'
    $sweepCommands = if ($InitialOnly) {
        ''
    }
    else {
        @(
            $walk,
            'RIGHT RIGHT RIGHT RIGHT RIGHT',
            'UP UP UP UP UP',
            'LEFT LEFT LEFT LEFT LEFT',
            'DOWN DOWN DOWN DOWN DOWN',
            'UP LEFT DOWN RIGHT DOWN RIGHT UP LEFT',
            'UNDO UNDO REDO RIGHT UP RESTART UNDO REDO'
        ) -join ' '
    }
    $levelNames = Get-Content -Encoding UTF8 -LiteralPath $metadataPath |
        ForEach-Object {
            $trimmed = $_.Trim()
            if ($trimmed) {
                ($trimmed -split '\s+')[0]
            }
        } |
        Where-Object {
            Test-Path -LiteralPath (Join-Path $levelRoot "$_.txt")
        }
    if ($SweepSkip -gt 0) {
        $levelNames = $levelNames | Select-Object -Skip $SweepSkip
    }
    if ($SweepLimit -gt 0) {
        $levelNames = $levelNames | Select-Object -First $SweepLimit
    }
    $levelOrdinal = 0
    $scenarios = @(
        foreach ($levelName in $levelNames) {
            $commands = if ($FuzzLength -gt 0 -and -not $InitialOnly) {
                New-FuzzCommandSequence `
                    -Seed ($FuzzSeed + $levelOrdinal * 104729) `
                    -Length $FuzzLength
            }
            else {
                $sweepCommands
            }
            $suffix = if ($FuzzLength -gt 0 -and -not $InitialOnly) {
                "fuzz-$FuzzSeed"
            }
            else {
                'sweep'
            }
            $levelOrdinal++
            @{
                Name = "$levelName-$suffix"
                Level = $levelName
                Commands = $commands
            }
        }
    )
}

New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null

$existingGame = Get-Process | Where-Object {
    $_.Path -eq $gameExe
} | Select-Object -First 1
$startedGame = $null

if (-not $existingGame) {
    $startedGame = Start-Process `
        -FilePath $gameExe `
        -ArgumentList '-screen-fullscreen', '0', '-screen-width', '800', '-screen-height', '600' `
        -WorkingDirectory $gameRoot `
        -WindowStyle Hidden `
        -PassThru
}

try {
    foreach ($scenario in $scenarios) {
        $requestId = '{0}-{1}' -f $scenario.Name, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $commandWritten = $false
        for ($attempt = 0; $attempt -lt 50 -and -not $commandWritten; $attempt++) {
            try {
                $commandLines = @(
                    $requestId,
                    $scenario.Level,
                    $scenario.Commands
                )
                if ($scenario.Save) {
                    $commandLines += $scenario.Save
                }
                [System.IO.File]::WriteAllLines(
                    $commandPath,
                    $commandLines,
                    $utf8NoBom
                )
                $commandWritten = $true
            }
            catch [System.IO.IOException] {
                Start-Sleep -Milliseconds 50
            }
        }
        if (-not $commandWritten) {
            throw "Could not write command for $($scenario.Name)"
        }

        $timeoutSeconds = if ($FuzzLength -gt 0) {
            # Some recursive clone/flip states make the original runtime's
            # per-step structural hash substantially slower even though the
            # scenario still completes normally.
            [Math]::Max(180, [Math]::Ceiling($FuzzLength / 2))
        }
        else {
            30
        }
        $deadline = (Get-Date).AddSeconds($timeoutSeconds)
        $matched = $false
        do {
            if (Test-Path -LiteralPath $resultPath) {
                try {
                    $resultText = Get-Content -Raw -Encoding UTF8 -LiteralPath $resultPath
                    $result = $resultText | ConvertFrom-Json
                    if ($result.requestId -eq $requestId) {
                        $matched = $true
                        break
                    }
                }
                catch {
                    # The plugin atomically replaces this file. A poll can land
                    # between delete and move, so retry transient read failures.
                }
            }
            Start-Sleep -Milliseconds 100
        } while ((Get-Date) -lt $deadline)

        if (-not $matched) {
            throw "Timed out capturing $($scenario.Name)"
        }
        if ($result.error) {
            throw "Original runtime failed $($scenario.Name): $($result.error)"
        }

        $destination = Join-Path $fixtureRoot "$($scenario.Name).json"
        Copy-Item -LiteralPath $resultPath -Destination $destination -Force
        Write-Host "Captured $($scenario.Name): moves=$($result.moveCount), blocks=$($result.blocks.Count)"
    }
}
finally {
    if ($startedGame -and -not $KeepGameOpen) {
        $debugProcesses = Get-Process | Where-Object {
            $_.Path -like "$gameRoot*"
        }
        foreach ($debugProcess in $debugProcesses) {
            Stop-Process -Id $debugProcess.Id -Force
        }
    }
}
