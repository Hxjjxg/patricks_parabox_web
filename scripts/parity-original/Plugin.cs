using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using BepInEx;
using HarmonyLib;
using UnityEngine;

namespace AgentObserver;

[BepInPlugin(
    "com.example.agentobserver",
    "Agent Observer",
    "1.0.0"
)]
public sealed class Plugin : BaseUnityPlugin
{
    private sealed class ScenarioOptions
    {
        public bool HasSaveOverride;
        public bool NexusUnlocked;
        public string RecentArea;
        public readonly List<string> WonLevels = new List<string>();
    }

    internal static class HoldState
    {
        public static int Dx;
        public static int Dy;
        public static int DirectionMask;
        public static string RequestedControl = "NONE";
        public static bool Force;
        public static bool Undo;
        public static bool Redo;
        public static bool Restart;
        public static bool UndoLast;
        public static bool RedoLast;
        public static bool RestartLast;

        public static void Clear()
        {
            Dx = 0;
            Dy = 0;
            DirectionMask = 0;
            RequestedControl = "NONE";
            Force = Undo = Redo = Restart = UndoLast = RedoLast = RestartLast = false;
        }
    }

    [HarmonyPatch(typeof(Controls), "Update")]
    internal static class TimedInputPatch
    {
        [HarmonyPostfix]
        private static void Postfix()
        {
            if (!HoldState.Force) return;
            Controls.right = HoldState.Dx > 0 || (HoldState.DirectionMask & 8) != 0;
            Controls.left = HoldState.Dx < 0 || (HoldState.DirectionMask & 4) != 0;
            Controls.up = HoldState.Dy > 0 || (HoldState.DirectionMask & 1) != 0;
            Controls.down = HoldState.Dy < 0 || (HoldState.DirectionMask & 2) != 0;
            Controls.undo = HoldState.Undo;
            Controls.redo = HoldState.Redo;
            Controls.restart = HoldState.Restart;
            Controls.undoPressed = HoldState.Undo && !HoldState.UndoLast;
            Controls.redoPressed = HoldState.Redo && !HoldState.RedoLast;
            Controls.restartPressed = HoldState.Restart && !HoldState.RestartLast;
            HoldState.UndoLast = HoldState.Undo;
            HoldState.RedoLast = HoldState.Redo;
            HoldState.RestartLast = HoldState.Restart;
            PhaseTrace.Record("controls-delivered");
        }
    }

    internal static class CaptureSaveGuard
    {
        public static bool Suppress;
        public static int SuppressedCalls;
        public static string PendingResult;
    }

    [HarmonyPatch(typeof(SaveFile), "Save")]
    internal static class CaptureSavePatch
    {
        [HarmonyPrefix]
        private static bool Prefix()
        {
            if (!CaptureSaveGuard.Suppress) return true;
            CaptureSaveGuard.SuppressedCalls++;
            return false;
        }
    }

    [HarmonyPatch(typeof(Movement), "PlayerMovementLogic")]
    internal static class HoldInputPatch
    {
        [HarmonyPrefix]
        private static void Prefix()
        {
            if (HoldState.Dx > 0) Controls.right = true;
            if (HoldState.Dx < 0) Controls.left = true;
            if (HoldState.Dy > 0) Controls.up = true;
            if (HoldState.Dy < 0) Controls.down = true;
            PhaseTrace.Record("movement-before");
        }

        [HarmonyPostfix]
        private static void Postfix() => PhaseTrace.Record("movement-after");
    }

    internal static class PhaseTrace
    {
        public static bool Active;
        public static float StartTime;
        public static readonly List<string> Samples = new List<string>();
        private static readonly System.Reflection.FieldInfo Dirs = typeof(Movement).GetField("dirs", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
        private static readonly System.Reflection.FieldInfo UndoNextTime = typeof(UndoInput).GetField("nextUndoTime", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
        private static readonly System.Reflection.FieldInfo UndoSpacing = typeof(UndoInput).GetField("spacing", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
        private static readonly System.Reflection.FieldInfo UndoDirection = typeof(UndoInput).GetField("undo", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);

        public static void Record(string phase)
        {
            if (!Active) return;
            Block player = World.FindPlayerBlock();
            var directions = new List<string>();
            foreach (object direction in (IEnumerable)Dirs.GetValue(null)) directions.Add(direction.ToString());
            var row = new StringBuilder();
            row.Append("{\"phase\":\"").Append(EscapeJson(phase)).Append("\",\"frame\":").Append(Time.frameCount).Append(",\"elapsedMs\":").Append(Invariant((Time.unscaledTime - StartTime) * 1000f)).Append(",\"deltaMs\":").Append(Invariant(Time.unscaledDeltaTime * 1000f));
            row.Append(",\"updateCount\":").Append(World.UpdateCount).Append(",\"scaledTime\":").Append(Invariant(Time.time)).Append(",\"deltaTime\":").Append(Invariant(Time.deltaTime)).Append(",\"requestedControl\":\"").Append(EscapeJson(HoldState.RequestedControl)).Append("\",\"undoNextTime\":").Append(Invariant((float)UndoNextTime.GetValue(null))).Append(",\"undoSpacing\":").Append(Invariant((float)UndoSpacing.GetValue(null)));
            row.Append(",\"controls\":{\"up\":").Append(JsonBool(Controls.up)).Append(",\"down\":").Append(JsonBool(Controls.down)).Append(",\"left\":").Append(JsonBool(Controls.left)).Append(",\"right\":").Append(JsonBool(Controls.right)).Append(",\"undo\":").Append(JsonBool(Controls.undo)).Append(",\"redo\":").Append(JsonBool(Controls.redo)).Append(",\"restart\":").Append(JsonBool(Controls.restart)).Append("}");
            row.Append(",\"levelName\":\"").Append(EscapeJson(World.currentLevelName)).Append("\",\"moveCount\":").Append(World.MoveCount).Append(",\"queued\":").Append(JsonBool(World.multiPlayerQueued)).Append(",\"queueIndex\":").Append(World.multiPlayerQueueIndex).Append(",\"queueDX\":").Append(World.multiPlayerDX).Append(",\"queueDY\":").Append(World.multiPlayerDY).Append(",\"anyBlockMoving\":").Append(JsonBool(World.AnyBlockMoving));
            row.Append(",\"winning\":").Append(JsonBool(World.Winning)).Append(",\"winCount\":").Append(Invariant(World.WinCount)).Append(",\"transitioning\":").Append(JsonBool(World.Transitioning)).Append(",\"moveDelayCounter\":").Append(Invariant(Movement.moveDelayCounter)).Append(",\"waitForMoveDirChange\":").Append(JsonBool(Movement.WaitForMoveDirChange)).Append(",\"dxLast\":").Append(Movement.dxLast).Append(",\"dyLast\":").Append(Movement.dyLast).Append(",\"dirs\":\"").Append(string.Join(",", directions)).Append("\"");
            row.Append(",\"undoDirection\":").Append(JsonBool((bool)UndoDirection.GetValue(null)));
            row.Append(",\"drawStyle\":\"").Append(Draw.DrawStyle).Append("\",\"inspectBlock\":").Append(World.blocks.IndexOf(World.InspectBlock)).Append(",\"inspectFlipH\":").Append(JsonBool(World.InspectFlipH)).Append(",\"cameraMoving\":").Append(JsonBool(Draw.cameraMoving)).Append(",\"cameraAnimT\":").Append(Invariant(Draw.AnimT)).Append(",\"cameraAnimLength\":").Append(Invariant(Draw.AnimLength));
            var moveRows = new List<string>();
            bool cloneEntry = false;
            foreach (Movement.Move move in Movement.moves) if (move.moveType == Movement.MoveType.Enter && move.toLevelBlock != null && move.toLevelBlock.SubLevel != null && move.toLevelBlock != move.toLevelBlock.SubLevel.GetExitBlock()) cloneEntry = true;
            row.Append(",\"cloneEntry\":").Append(JsonBool(cloneEntry));
            foreach (Movement.Move move in Movement.moves) moveRows.Add("{\"block\":" + World.blocks.IndexOf(move.block) + ",\"type\":\"" + move.moveType + "\",\"infExitNum\":" + move.infExitNum + ",\"infEnterNum\":" + move.infEnterNum + ",\"fromLevel\":" + World.levels.IndexOf(move.fromLevel) + ",\"toLevel\":" + World.levels.IndexOf(move.toLevel) + ",\"shed\":" + JsonBool(move.shed) + "}");
            row.Append(",\"attemptMoves\":[").Append(string.Join(",", moveRows)).Append("]");
            var pastCounts = new List<string>();
            var futureCounts = new List<string>();
            foreach (UndoManager.Turn turn in UndoManager.past) pastCounts.Add(turn.MoveCount.ToString());
            foreach (UndoManager.Turn turn in UndoManager.future) futureCounts.Add(turn.MoveCount.ToString());
            row.Append(",\"history\":{\"pastCount\":").Append(UndoManager.past.Count).Append(",\"futureCount\":").Append(UndoManager.future.Count).Append(",\"pastMoveCounts\":[").Append(string.Join(",", pastCounts)).Append("],\"futureMoveCounts\":[").Append(string.Join(",", futureCounts)).Append("],\"pastTopIsRestart\":").Append(JsonBool(UndoManager.past.Count > 0 && UndoManager.past.Peek().IsRestart)).Append(",\"futureTopIsRestart\":").Append(JsonBool(UndoManager.future.Count > 0 && UndoManager.future.Peek().IsRestart)).Append(",\"currentTurnMoveCount\":").Append(UndoManager.CurrentTurn.MoveCount).Append(",\"currentTurnMoves\":").Append(UndoManager.CurrentTurn.moves.Count).Append("}");
            if (player != null) row.Append(",\"player\":{\"outerLevel\":").Append(World.levels.IndexOf(player.OuterLevel)).Append(",\"x\":").Append(player.xpos).Append(",\"y\":").Append(player.ypos).Append(",\"anim\":\"").Append(player.Anim).Append("\",\"animT\":").Append(Invariant(player.AnimT)).Append(",\"animLength\":").Append(Invariant(player.AnimLength)).Append("}");
            if (player != null) row.Append(",\"playerDrawFlags\":{\"isPlayer\":").Append(JsonBool(player.IsPlayer)).Append(",\"drawIsPlayer\":").Append(JsonBool(player.DrawIsPlayer)).Append(",\"possessable\":").Append(JsonBool(player.Possessable)).Append("}");
            row.Append('}');
            Samples.Add(row.ToString());
        }
    }

    [HarmonyPatch(typeof(World), "UpdateInner")]
    internal static class UpdatePhasePatch
    {
        [HarmonyPrefix] private static void Prefix() => PhaseTrace.Record("update-before");
        [HarmonyPostfix] private static void Postfix() => PhaseTrace.Record("update-after");
    }

    [HarmonyPatch(typeof(World), "DoNextMultiPlayerImpulse")]
    internal static class ImpulsePhasePatch
    {
        [HarmonyPrefix] private static void Prefix() => PhaseTrace.Record("impulse-before");
        [HarmonyPostfix] private static void Postfix() => PhaseTrace.Record("impulse-after");
    }

    [HarmonyPatch(typeof(World), "GoToLevel")]
    internal static class LevelPhasePatch
    {
        [HarmonyPrefix] private static void Prefix(string levelName) => PhaseTrace.Record("level-before:" + levelName);
        [HarmonyPostfix] private static void Postfix(string levelName) => PhaseTrace.Record("level-after:" + levelName);
    }

    [HarmonyPatch]
    internal static class HistoryPhasePatch
    {
        private static IEnumerable<System.Reflection.MethodBase> TargetMethods()
        {
            foreach (string name in new[] { "Undo", "Redo", "RestartLevel", "TurnCompleted", "TurnCompletedDontPerform" })
                yield return AccessTools.Method(typeof(UndoManager), name);
        }
        [HarmonyPrefix] private static void Prefix(System.Reflection.MethodBase __originalMethod) => PhaseTrace.Record("history-before:" + __originalMethod.Name);
        [HarmonyPostfix] private static void Postfix(System.Reflection.MethodBase __originalMethod) => PhaseTrace.Record("history-after:" + __originalMethod.Name);
    }

    internal static class ColorTrace
    {
        public static bool Active;
        public static string Context;
        public static readonly List<string> Samples = new List<string>();
        public static readonly System.Reflection.BindingFlags Fields = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;
        public static string Rgba(Color color) => "[" + Invariant(color.r) + "," + Invariant(color.g) + "," + Invariant(color.b) + "," + Invariant(color.a) + "]";
        public static string BlockContext(string kind, Block block) => "{\"kind\":\"" + kind + "\",\"blockIndex\":" + World.blocks.IndexOf(block) + ",\"outerLevel\":" + World.levels.IndexOf(block.OuterLevel) + ",\"subLevel\":" + World.levels.IndexOf(block.SubLevel) + ",\"subSize\":[" + block.SubLevel.width + "," + block.SubLevel.height + "],\"filledWithWalls\":" + JsonBool(block.SubLevel.FilledWithWalls) + ",\"hsv\":[" + Invariant(block.hue) + "," + Invariant(block.sat) + "," + Invariant(block.val) + "],\"borderColor\":" + Rgba(block.borderColor);
    }

    [HarmonyPatch(typeof(Draw), "DrawBlock")]
    internal static class BackingColorPatch
    {
        [HarmonyPrefix]
        private static void Prefix(object ticket)
        {
            if (!ColorTrace.Active) return;
            Type type = ticket.GetType();
            Block block = (Block)type.GetField("block", ColorTrace.Fields).GetValue(ticket);
            double width = (double)type.GetField("width", ColorTrace.Fields).GetValue(ticket);
            double height = (double)type.GetField("height", ColorTrace.Fields).GetValue(ticket);
            double x = (double)type.GetField("x", ColorTrace.Fields).GetValue(ticket);
            double y = (double)type.GetField("y", ColorTrace.Fields).GetValue(ticket);
            int depth = (int)type.GetField("depth", ColorTrace.Fields).GetValue(ticket);
            bool cloneFade = (bool)type.GetField("cloneFade", ColorTrace.Fields).GetValue(ticket);
            Draw.ComputeBlockColor(block, (width + height) / 2.0 / Screen.height, depth, cloneFade, out float hue, out float sat, out float val);
            Color wallColor = Draw.ComputeWallColor(block, (width / block.SubLevel.width + height / block.SubLevel.height) / 2.0 / Screen.height, depth, cloneFade);
            ColorTrace.Context = ColorTrace.BlockContext("backing", block) + ",\"depth\":" + depth + ",\"ticketRect\":[" + DoubleInvariant(x) + "," + DoubleInvariant(y) + "," + DoubleInvariant(width) + "," + DoubleInvariant(height) + "],\"computedHsv\":[" + Invariant(hue) + "," + Invariant(sat) + "," + Invariant(val) + "],\"computedWallGuiColor\":" + ColorTrace.Rgba(wallColor) + "}";
        }
        [HarmonyPostfix] private static void Postfix() { if (ColorTrace.Active) ColorTrace.Context = null; }
    }

    [HarmonyPatch(typeof(Draw), "DrawBlockBorder")]
    internal static class BorderColorPatch
    {
        [HarmonyPrefix] private static void Prefix(Block block, int depth, double centerX, double centerY, double width, double height, double staticWidth, double staticHeight) { if (ColorTrace.Active) ColorTrace.Context = ColorTrace.BlockContext("border", block) + ",\"depth\":" + depth + ",\"ticketRect\":[" + DoubleInvariant(centerX) + "," + DoubleInvariant(centerY) + "," + DoubleInvariant(width) + "," + DoubleInvariant(height) + "],\"staticSize\":[" + DoubleInvariant(staticWidth) + "," + DoubleInvariant(staticHeight) + "]}"; }
        [HarmonyPostfix] private static void Postfix() { if (ColorTrace.Active) ColorTrace.Context = null; }
    }

    [HarmonyPatch(typeof(Draw), "DrawWall")]
    internal static class WallColorPatch
    {
        [HarmonyPrefix] private static void Prefix(Block block) { if (ColorTrace.Active) ColorTrace.Context = "{\"kind\":\"wall\",\"blockIndex\":" + World.blocks.IndexOf(block) + ",\"outerLevel\":" + World.levels.IndexOf(block.OuterLevel) + "}"; }
        [HarmonyPostfix] private static void Postfix() { if (ColorTrace.Active) ColorTrace.Context = null; }
    }

    [HarmonyPatch(typeof(Draw), "DrawTexture")]
    internal static class TextureColorPatch
    {
        [HarmonyPrefix]
        private static void Prefix(Texture texture, Color color)
        {
            if (!ColorTrace.Active || ColorTrace.Context == null) return;
            Rect rect = (Rect)typeof(Draw).GetField("drawRect", ColorTrace.Fields).GetValue(null);
            Color32 candidate = color;
            ColorTrace.Samples.Add("{\"frame\":" + Time.frameCount + ",\"context\":" + ColorTrace.Context + ",\"texture\":\"" + EscapeJson(texture.name) + "\",\"rect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"rawGuiColor\":" + ColorTrace.Rgba(color) + ",\"explicitColor32Candidate\":[" + candidate.r + "," + candidate.g + "," + candidate.b + "," + candidate.a + "]}");
        }
    }

    private string _commandPath = string.Empty;
    private string _resultPath = string.Empty;
    private string _lastRequestId = string.Empty;
    private float _nextPollTime;
    private bool _busy;

    private void Awake()
    {
        _commandPath = Path.Combine(Paths.BepInExRootPath, "AgentObserver-command.txt");
        Harmony.CreateAndPatchAll(typeof(HoldInputPatch), "com.example.agentobserver.hold");
        Harmony.CreateAndPatchAll(typeof(TimedInputPatch), "com.example.agentobserver.timed");
        Harmony.CreateAndPatchAll(typeof(CaptureSavePatch), "com.example.agentobserver.capture-save");
        Harmony.CreateAndPatchAll(typeof(UpdatePhasePatch), "com.example.agentobserver.phase-update");
        Harmony.CreateAndPatchAll(typeof(ImpulsePhasePatch), "com.example.agentobserver.phase-impulse");
        Harmony.CreateAndPatchAll(typeof(LevelPhasePatch), "com.example.agentobserver.phase-level");
        Harmony.CreateAndPatchAll(typeof(HistoryPhasePatch), "com.example.agentobserver.phase-history");
        Harmony.CreateAndPatchAll(typeof(BackingColorPatch), "com.example.agentobserver.color-backing");
        Harmony.CreateAndPatchAll(typeof(BorderColorPatch), "com.example.agentobserver.color-border");
        Harmony.CreateAndPatchAll(typeof(WallColorPatch), "com.example.agentobserver.color-wall");
        Harmony.CreateAndPatchAll(typeof(TextureColorPatch), "com.example.agentobserver.color-texture");
        _resultPath = Path.Combine(Paths.BepInExRootPath, "AgentObserver-result.json");
        Logger.LogInfo($"Agent Observer ready: {_commandPath}");
    }

    private void Update()
    {
        if (_busy || Time.realtimeSinceStartup < _nextPollTime)
        {
            return;
        }

        _nextPollTime = Time.realtimeSinceStartup + 0.1f;
        if (!File.Exists(_commandPath))
        {
            return;
        }

        try
        {
            string[] lines = File.ReadAllLines(_commandPath, Encoding.UTF8);
            if (lines.Length < 2)
            {
                return;
            }

            string requestId = lines[0].Trim();
            string levelName = lines[1].Trim();
            if (requestId.Length == 0 || levelName.Length == 0 || requestId == _lastRequestId)
            {
                return;
            }

            var commands = new List<string>();
            var options = new ScenarioOptions();
            for (int index = 2; index < lines.Length; index++)
            {
                string line = lines[index].Trim();
                if (line.StartsWith("SAVE ", StringComparison.OrdinalIgnoreCase))
                {
                    ParseSaveOptions(line, options);
                    continue;
                }
                string[] tokens = lines[index].Split(
                    new[] { ' ', '\t', ',' },
                    StringSplitOptions.RemoveEmptyEntries
                );
                commands.AddRange(tokens);
            }

            _lastRequestId = requestId;
            if (levelName.StartsWith("GPU_WALL:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunWallReadbackScenario(requestId, levelName.Substring(9)));
                return;
            }
            if (levelName.StartsWith("ISOLATED_MOTION:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunIsolatedMotionCaptureScenario(requestId, levelName.Substring(16), commands));
                return;
            }
            if (levelName.StartsWith("MOTION:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunMotionCaptureScenario(requestId, levelName.Substring(7), commands));
                return;
            }
            if (levelName.StartsWith("CAPTURE:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunCaptureScenario(requestId, levelName.Substring(8), commands));
                return;
            }
            if (levelName.StartsWith("HOLD:", StringComparison.OrdinalIgnoreCase))
            {
                string[] holdParts = levelName.Split(':');
                string holdDirection = holdParts.Length > 1 ? holdParts[1] : "UP";
                int holdMs = holdParts.Length > 2 ? int.Parse(holdParts[2]) : 1500;
                string holdLevel = holdParts.Length > 3 ? holdParts[3] : "first_puzzle";
                StartCoroutine(RunHoldScenario(requestId, holdDirection, holdMs, holdLevel));
                return;
            }
            StartCoroutine(RunScenario(requestId, levelName, commands, options));
        }
        catch (Exception exception)
        {
            Logger.LogError(exception);
        }
    }

    private IEnumerator RunScenario(
        string requestId,
        string levelName,
        IReadOnlyList<string> commands,
        ScenarioOptions options
    )
    {
        _busy = true;
        Exception scenarioError = null;
        SaveFile.SaveData previousSave = null;
        try
        {
            if (options.HasSaveOverride)
            {
                previousSave = SaveFile.Current;
                var save = new SaveFile.SaveData
                {
                    NexusUnlocked = options.NexusUnlocked,
                    RecentArea = options.RecentArea
                };
                foreach (string wonLevel in options.WonLevels)
                {
                    save.LevelWon[wonLevel] = true;
                    save.LevelAttempted[wonLevel] = true;
                }
                SaveFile.Current = save;
                World.RecentPuzzle = null;
                World.UnlockAllRepositionAreaName = null;
                World.TransitionXPosOffset = 0;
                World.TransitionYPosOffset = -1;
                World.levelsNewlyWon = 0;
                if (levelName == "hub")
                {
                    World.hubLoaded = false;
                }
            }
            World.GoToLevel(levelName);
        }
        catch (Exception exception)
        {
            scenarioError = exception;
        }

        int framesRemaining = 600;
        while (
            scenarioError == null
            && framesRemaining-- > 0
            && (
                World.currentLevelName != levelName
                || World.State != World.WS.Playing
                || World.Transitioning
            )
        )
        {
            yield return null;
        }

        try
        {
            if (scenarioError != null)
            {
                throw scenarioError;
            }
            if (
                World.currentLevelName != levelName
                || World.State != World.WS.Playing
                || World.Transitioning
            )
            {
                throw new InvalidOperationException(
                    $"Timed out loading {levelName}; current={World.currentLevelName}, state={World.State}"
                );
            }

            UndoManager.StopAnimations();
            World.AnyBlockMoving = false;
            World.ResetMultiplePlayersState();
            var trace = new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("START", ComputeStateHash())
            };

            foreach (string rawCommand in commands)
            {
                ExecuteCommand(rawCommand);
                UndoManager.StopAnimations();
                World.AnyBlockMoving = false;
                World.ResetMultiplePlayersState();
                trace.Add(
                    new KeyValuePair<string, string>(
                        rawCommand.ToUpperInvariant(),
                        ComputeStateHash()
                    )
                );
            }

            WriteResult(
                options.HasSaveOverride && levelName == "hub"
                    ? BuildHubSnapshot(requestId)
                    : BuildSnapshot(requestId, trace)
            );
            Logger.LogInfo(
                $"Scenario {requestId} complete: {levelName} [{string.Join(" ", commands)}]"
            );
        }
        catch (Exception exception)
        {
            Logger.LogError(exception);
            WriteResult(
                "{\"requestId\":\""
                + EscapeJson(requestId)
                + "\",\"error\":\""
                + EscapeJson(exception.ToString())
                + "\"}"
            );
        }
        finally
        {
            if (previousSave != null)
            {
                SaveFile.Current = previousSave;
            }
            _busy = false;
        }
    }

    private static void ParseSaveOptions(
        string line,
        ScenarioOptions options
    )
    {
        options.HasSaveOverride = true;
        string[] tokens = line.Substring(5).Split(
            new[] { ' ', '\t' },
            StringSplitOptions.RemoveEmptyEntries
        );
        foreach (string token in tokens)
        {
            int separator = token.IndexOf('=');
            if (separator <= 0)
            {
                continue;
            }
            string key = token.Substring(0, separator).ToLowerInvariant();
            string value = token.Substring(separator + 1);
            switch (key)
            {
                case "nexus":
                    options.NexusUnlocked =
                        value == "1"
                        || value.Equals("true", StringComparison.OrdinalIgnoreCase);
                    break;
                case "recent":
                    options.RecentArea =
                        value == "_" || value.Length == 0 ? null : value;
                    break;
                case "won":
                    options.WonLevels.Clear();
                    options.WonLevels.AddRange(
                        value.Split(
                            new[] { ',' },
                            StringSplitOptions.RemoveEmptyEntries
                        )
                    );
                    break;
            }
        }
    }

    private static void ExecuteCommand(string rawCommand)
    {
        string command = rawCommand.Trim().ToUpperInvariant();
        if (command.StartsWith("INSPECT_"))
        {
            if (command == "INSPECT_OUT") World.PopInspect();
            else World.PushInspect(World.blocks[int.Parse(command.Substring(8))]);
            return;
        }
        switch (command)
        {
            case "LEFT":
                ApplyDirectionalInput(-1, 0);
                break;
            case "RIGHT":
                ApplyDirectionalInput(1, 0);
                break;
            case "UP":
                ApplyDirectionalInput(0, 1);
                break;
            case "DOWN":
                ApplyDirectionalInput(0, -1);
                break;
            case "UNDO":
                UndoManager.Undo();
                break;
            case "REDO":
                UndoManager.Redo();
                break;
            case "RESTART":
                UndoManager.RestartLevel();
                break;
            case "":
                break;
            default:
                throw new ArgumentException($"Unknown scenario command: {rawCommand}");
        }
    }

    private static void ApplyDirectionalInput(int dx, int dy)
    {
        if (World.Winning)
        {
            return;
        }
        World.MoveCount++;
        bool anyMoved = false;
        int controlledBlockIndex = 0;

        while (controlledBlockIndex < World.FindPlayerBlocks().Count)
        {
            List<Block> controlledBlocks = World.FindPlayerBlocks();
            if (Movement.Impulse(controlledBlocks[controlledBlockIndex], dx, dy))
            {
                anyMoved = true;
            }
            controlledBlockIndex++;
        }

        if (!anyMoved)
        {
            World.MoveCount--;
        }
    }

    private static string BuildHubSnapshot(string requestId)
    {
        World.ComputeBlockLists();
        World.UpdateButtonsPressed();
        Block player = World.FindPlayerBlock();
        var portals = new List<Floor>();
        var specialFloors = new List<Floor>();
        foreach (Floor floor in World.floors)
        {
            if (floor.Type == Floor.FloorType.LevelPortal)
            {
                portals.Add(floor);
            }
            else if (
                floor.OuterLevel.floors[floor.xpos, floor.ypos] == floor
                && (
                    floor.Type == Floor.FloorType.Info
                    || floor.Type == Floor.FloorType.BreakFloor
                    || floor.Type == Floor.FloorType.GalleryFloor
                    || floor.Type == Floor.FloorType.Smile
                    || floor.Type == Floor.FloorType.Show
                )
            )
            {
                specialFloors.Add(floor);
            }
        }
        portals.Sort(
            (left, right) => string.CompareOrdinal(left.SceneName, right.SceneName)
        );
        specialFloors.Sort(
            (left, right) =>
            {
                int result = string.CompareOrdinal(
                    left.OuterLevel.hubAreaName,
                    right.OuterLevel.hubAreaName
                );
                if (result != 0) return result;
                result = left.Type.CompareTo(right.Type);
                if (result != 0) return result;
                result = left.xpos.CompareTo(right.xpos);
                return result != 0 ? result : left.ypos.CompareTo(right.ypos);
            }
        );

        var walls = new List<Block>();
        foreach (Block block in World.blocks)
        {
            if (
                block.SubLevel == null
                && block.unlockerScene != null
                && block.OuterLevel != null
                && block.OuterLevel.InBounds(block.xpos, block.ypos)
                && block.OuterLevel.blocks[block.xpos, block.ypos] == block
            )
            {
                walls.Add(block);
            }
        }
        walls.Sort(
            (left, right) =>
            {
                int result = string.CompareOrdinal(
                    left.OuterLevel.hubAreaName,
                    right.OuterLevel.hubAreaName
                );
                if (result != 0) return result;
                result = left.xpos.CompareTo(right.xpos);
                if (result != 0) return result;
                result = left.ypos.CompareTo(right.ypos);
                return result != 0
                    ? result
                    : string.CompareOrdinal(left.unlockerScene, right.unlockerScene);
            }
        );

        var shortcutLevels = new List<Level>();
        foreach (Level level in World.levels)
        {
            if (level.hubAreaName != null && level.hubShortcutWon)
            {
                shortcutLevels.Add(level);
            }
        }
        shortcutLevels.Sort(
            (left, right) =>
                string.CompareOrdinal(left.hubAreaName, right.hubAreaName)
        );
        var wonLevels = new List<string>(SaveFile.Current.LevelWon.Keys);
        wonLevels.Sort(StringComparer.Ordinal);

        var json = new StringBuilder();
        json.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append('"');
        json.Append(",\"kind\":\"hub\"");
        json.Append(",\"levelName\":\"hub\"");
        json.Append(",\"nexusUnlocked\":")
            .Append(JsonBool(SaveFile.Current.NexusUnlocked));
        json.Append(",\"allWon\":")
            .Append(JsonBool(SaveFile.AllWon(SaveFile.Current)));
        json.Append(",\"recentArea\":");
        if (SaveFile.Current.RecentArea == null)
        {
            json.Append("null");
        }
        else
        {
            json.Append('"')
                .Append(EscapeJson(SaveFile.Current.RecentArea))
                .Append('"');
        }
        json.Append(",\"wonLevels\":[");
        for (int index = 0; index < wonLevels.Count; index++)
        {
            if (index > 0) json.Append(',');
            json.Append('"').Append(EscapeJson(wonLevels[index])).Append('"');
        }
        json.Append(']');
        json.Append(",\"player\":{\"area\":\"")
            .Append(EscapeJson(player.OuterLevel.hubAreaName ?? ""))
            .Append("\",\"x\":")
            .Append(player.xpos)
            .Append(",\"y\":")
            .Append(player.ypos)
            .Append('}');

        json.Append(",\"portals\":[");
        for (int index = 0; index < portals.Count; index++)
        {
            if (index > 0) json.Append(',');
            Floor floor = portals[index];
            json.Append("{\"scene\":\"")
                .Append(EscapeJson(floor.SceneName))
                .Append("\",\"area\":\"")
                .Append(EscapeJson(floor.OuterLevel.hubAreaName ?? ""))
                .Append("\",\"x\":")
                .Append(floor.xpos)
                .Append(",\"y\":")
                .Append(floor.ypos)
                .Append(",\"won\":")
                .Append(JsonBool(floor.Won))
                .Append(",\"unlocked\":")
                .Append(JsonBool(floor.Unlocked))
                .Append(",\"hard\":")
                .Append(floor.Hard)
                .Append('}');
        }
        json.Append(']');

        json.Append(",\"walls\":[");
        for (int index = 0; index < walls.Count; index++)
        {
            if (index > 0) json.Append(',');
            Block block = walls[index];
            json.Append("{\"area\":\"")
                .Append(EscapeJson(block.OuterLevel.hubAreaName ?? ""))
                .Append("\",\"x\":")
                .Append(block.xpos)
                .Append(",\"y\":")
                .Append(block.ypos)
                .Append(",\"unlocker\":\"")
                .Append(EscapeJson(block.unlockerScene))
                .Append("\"}");
        }
        json.Append(']');

        json.Append(",\"fastTravel\":[");
        for (int index = 0; index < World.fastTravelFloors.Count; index++)
        {
            if (index > 0) json.Append(',');
            Floor floor = World.fastTravelFloors[index];
            json.Append("{\"area\":\"")
                .Append(EscapeJson(floor.OuterLevel.hubAreaName ?? ""))
                .Append("\",\"x\":")
                .Append(floor.xpos)
                .Append(",\"y\":")
                .Append(floor.ypos)
                .Append('}');
        }
        json.Append(']');

        json.Append(",\"specialFloors\":[");
        for (int index = 0; index < specialFloors.Count; index++)
        {
            if (index > 0) json.Append(',');
            Floor floor = specialFloors[index];
            json.Append("{\"type\":\"")
                .Append(floor.Type)
                .Append("\",\"area\":\"")
                .Append(EscapeJson(floor.OuterLevel.hubAreaName ?? ""))
                .Append("\",\"x\":")
                .Append(floor.xpos)
                .Append(",\"y\":")
                .Append(floor.ypos);
            if (floor.Type == Floor.FloorType.Info)
            {
                json.Append(",\"info\":\"")
                    .Append(EscapeJson(floor.info ?? ""))
                    .Append('"');
            }
            json.Append('}');
        }
        json.Append(']');

        json.Append(",\"shortcutAreas\":[");
        for (int index = 0; index < shortcutLevels.Count; index++)
        {
            if (index > 0) json.Append(',');
            json.Append('"')
                .Append(EscapeJson(shortcutLevels[index].hubAreaName))
                .Append('"');
        }
        json.Append("]}");
        return json.ToString();
    }

    private static string BuildSnapshot(
        string requestId,
        IReadOnlyList<KeyValuePair<string, string>> trace
    )
    {
        World.ComputeBlockLists();
        World.UpdateButtonsPressed();

        var json = new StringBuilder();
        json.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append('"');
        json.Append(",\"levelName\":\"").Append(EscapeJson(World.currentLevelName)).Append('"');
        json.Append(",\"moveCount\":").Append(World.MoveCount);
        json.Append(",\"winning\":").Append(JsonBool(World.Winning));
        json.Append(",\"buttonsSatisfied\":").Append(JsonBool(World.ButtonsSatisfied));
        json.Append(",\"finishesSatisfied\":").Append(JsonBool(World.FinishesSatisfied));
        json.Append(",\"wentToInfZone\":").Append(JsonBool(World.WentToInfZone));
        json.Append(",\"pastCount\":").Append(UndoManager.past.Count);
        json.Append(",\"futureCount\":").Append(UndoManager.future.Count);
        json.Append(",\"trace\":[");
        for (int index = 0; index < trace.Count; index++)
        {
            if (index > 0)
            {
                json.Append(',');
            }
            json.Append("{\"command\":\"").Append(EscapeJson(trace[index].Key)).Append('"');
            json.Append(",\"hash\":\"").Append(trace[index].Value).Append("\"}");
        }
        json.Append(']');
        json.Append(",\"blocks\":[");

        List<Block> activeBlocks = FindActiveBlocks();

        for (int index = 0; index < activeBlocks.Count; index++)
        {
            if (index > 0)
            {
                json.Append(',');
            }

            Block block = activeBlocks[index];
            json.Append("{\"index\":").Append(index);
            json.Append(",\"outer\":").Append(World.levels.IndexOf(block.OuterLevel));
            json.Append(",\"sub\":").Append(World.levels.IndexOf(block.SubLevel));
            json.Append(",\"x\":").Append(block.xpos);
            json.Append(",\"y\":").Append(block.ypos);
            json.Append(",\"isPlayer\":").Append(JsonBool(block.IsPlayer));
            json.Append(",\"playerOrder\":").Append(block.PlayerOrder);
            json.Append(",\"flipH\":").Append(JsonBool(block.FlipH));
            json.Append(",\"movedSinceRestart\":").Append(JsonBool(block.MovedSinceRestart));
            json.Append('}');
        }

        json.Append("]}");
        return json.ToString();
    }

    private static string ComputeStateHash()
    {
        World.ComputeBlockLists();
        World.UpdateButtonsPressed();
        var state = new StringBuilder();
        state.Append(World.currentLevelName).Append('|');
        state.Append(World.MoveCount).Append('|');
        state.Append(JsonBool(World.Winning)).Append('|');
        state.Append(JsonBool(World.ButtonsSatisfied)).Append('|');
        state.Append(JsonBool(World.FinishesSatisfied)).Append('|');
        state.Append(JsonBool(World.WentToInfZone)).Append('|');
        state.Append(UndoManager.past.Count).Append('|');
        state.Append(UndoManager.future.Count);

        foreach (Block block in FindActiveBlocks())
        {
            state.Append(';');
            state.Append(World.levels.IndexOf(block.OuterLevel)).Append(',');
            state.Append(World.levels.IndexOf(block.SubLevel)).Append(',');
            state.Append(block.xpos).Append(',');
            state.Append(block.ypos).Append(',');
            state.Append(JsonBool(block.IsPlayer)).Append(',');
            state.Append(block.PlayerOrder).Append(',');
            state.Append(JsonBool(block.FlipH)).Append(',');
            state.Append(JsonBool(block.MovedSinceRestart));
        }

        using (SHA256 sha256 = SHA256.Create())
        {
            byte[] digest = sha256.ComputeHash(Encoding.UTF8.GetBytes(state.ToString()));
            var hex = new StringBuilder(digest.Length * 2);
            foreach (byte value in digest)
            {
                hex.Append(value.ToString("x2"));
            }
            return hex.ToString();
        }
    }

    private static List<Block> FindActiveBlocks()
    {
        var activeBlocks = new List<Block>();
        foreach (Block block in World.blocks)
        {
            if (
                block.OuterLevel == null
                || (
                    block.OuterLevel.InBounds(block.xpos, block.ypos)
                    && block.OuterLevel.blocks[block.xpos, block.ypos] == block
                )
            )
            {
                activeBlocks.Add(block);
            }
        }
        return activeBlocks;
    }

    private IEnumerator RunHoldScenario(
        string requestId,
        string direction,
        int holdMs,
        string levelName
    )
    {
        _busy = true;
        World.GoToLevel(levelName);
        int framesRemaining = 600;
        while (
            framesRemaining-- > 0
            && (
                World.currentLevelName != levelName
                || World.State != World.WS.Playing
                || World.Transitioning
            )
        )
        {
            yield return null;
        }
        UndoManager.StopAnimations();
        World.AnyBlockMoving = false;
        World.ResetMultiplePlayersState();
        yield return null;

        int dx = 0;
        int dy = 0;
        switch (direction.ToUpperInvariant())
        {
            case "LEFT": dx = -1; break;
            case "RIGHT": dx = 1; break;
            case "UP": dy = 1; break;
            case "DOWN": dy = -1; break;
        }

        var samples = new List<string>();
        Block player = World.FindPlayerBlock();
        samples.Add("level=" + levelName);
        samples.Add("moveDelay=" + Prefs.MoveDelay.ToString());
        samples.Add("startPos=" + player.xpos + "," + player.ypos);
        HoldState.Dx = dx;
        HoldState.Dy = dy;
        float start = Time.unscaledTime;
        int lastMoveCount = World.MoveCount;
        while ((Time.unscaledTime - start) * 1000f < holdMs)
        {
            int moveCount = World.MoveCount;
            if (moveCount != lastMoveCount)
            {
                float elapsed = (Time.unscaledTime - start) * 1000f;
                Block current = World.FindPlayerBlock();
                samples.Add(
                    "t=" + ((int)elapsed).ToString()
                    + " mc=" + moveCount.ToString()
                    + " pos=" + current.xpos + "," + current.ypos
                    + " any=" + (World.AnyBlockMoving ? "1" : "0")
                );
                lastMoveCount = moveCount;
            }
            yield return null;
        }
        HoldState.Clear();
        float total = (Time.unscaledTime - start) * 1000f;
        samples.Add("endMs=" + ((int)total).ToString());
        samples.Add("endPos=" + World.FindPlayerBlock().xpos + "," + World.FindPlayerBlock().ypos);

        var json = new StringBuilder();
        json.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append('"');
        json.Append(",\"kind\":\"hold\"");
        json.Append(",\"samples\":[");
        for (int index = 0; index < samples.Count; index++)
        {
            if (index > 0) json.Append(',');
            json.Append('"').Append(EscapeJson(samples[index])).Append('"');
        }
        json.Append("]}");
        WriteResult(json.ToString());
        Logger.LogInfo("Hold scenario " + requestId + ": " + string.Join(" | ", samples));
        _busy = false;
    }

    private IEnumerator RunCaptureScenario(string requestId, string levelName, IReadOnlyList<string> commands)
    {
        _busy = true;
        ConfigureCaptureResolution(ref levelName);
        World.GoToLevel(levelName);
        int framesRemaining = 600;
        while (framesRemaining-- > 0 && (World.currentLevelName != levelName || World.State != World.WS.Playing || World.Transitioning))
            yield return null;
        if (World.currentLevelName != levelName || World.State != World.WS.Playing || World.Transitioning)
        {
            WriteResult("{\"requestId\":\"" + EscapeJson(requestId) + "\",\"error\":\"Capture level load timed out\"}");
            _busy = false;
            yield break;
        }
        HoldState.Clear();
        UndoManager.StopAnimations();
        World.AnyBlockMoving = false;
        World.ResetMultiplePlayersState();
        foreach (string command in commands)
        {
            ExecuteCommand(command);
            UndoManager.StopAnimations();
            World.AnyBlockMoving = false;
            World.ResetMultiplePlayersState();
        }
        float settleDeadline = Time.unscaledTime + 0.8f;
        while (Time.unscaledTime < settleDeadline || (Draw.CameraMode == Draw.CM.SpecificBlock ? Draw.cameraMoving : Draw.newCamT < 1f)) yield return null;
        string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId);
        Directory.CreateDirectory(directory);
        var frames = new StringBuilder();
        frames.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append("\",\"level\":\"").Append(EscapeJson(levelName)).Append("\",\"screenWidth\":").Append(Screen.width).Append(",\"screenHeight\":").Append(Screen.height);
        frames.Append(",\"moveDelay\":").Append(Prefs.MoveDelay).Append(",\"allowSkippingAnimation\":").Append(JsonBool(Prefs.AllowSkippingAnimation)).Append(",\"instantZoom\":").Append(JsonBool(Prefs.InstantZoom)).Append(",\"frames\":[");
        for (int index = 0; index < 3; index++)
        {
            if (index == 0) { ColorTrace.Samples.Clear(); ColorTrace.Context = null; ColorTrace.Active = true; }
            yield return new WaitForEndOfFrame();
            string path = Path.Combine(directory, "static-" + index + ".png");
            Texture2D image = ScreenCapture.CaptureScreenshotAsTexture();
            File.WriteAllBytes(path, image.EncodeToPNG());
            UnityEngine.Object.Destroy(image);
            if (index == 0)
            {
                ColorTrace.Active = false;
                Type argumentType = typeof(Graphics).Assembly.GetType("UnityEngine.Internal_DrawTextureArguments");
                string colorArgumentType = argumentType.GetField("color", ColorTrace.Fields).FieldType.FullName;
                File.WriteAllText(Path.Combine(directory, "colors.json"), "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"focusGeometry\":[" + DoubleInvariant(Draw.blockXLast) + "," + DoubleInvariant(Draw.blockYLast) + "," + DoubleInvariant(Draw.blockWLast) + "," + DoubleInvariant(Draw.blockHLast) + "],\"focusBlockIndex\":" + World.blocks.IndexOf(Draw.FocusBlock) + ",\"managedNativeArgumentType\":\"" + colorArgumentType + "\",\"note\":\"explicitColor32Candidate is an observed CPU conversion candidate only, not proof that Graphics native submission uses it\",\"samples\":[" + string.Join(",", ColorTrace.Samples) + "]}", new UTF8Encoding(false));
            }
            if (index > 0) frames.Append(",");
            frames.Append("{\"file\":\"").Append(EscapeJson(path)).Append("\",\"frame\":").Append(Time.frameCount).Append(",\"time\":").Append(Time.unscaledTime.ToString(System.Globalization.CultureInfo.InvariantCulture)).Append(",\"deltaTime\":").Append(Time.unscaledDeltaTime.ToString(System.Globalization.CultureInfo.InvariantCulture)).Append("}");
            yield return null;
        }
        frames.Append("]}");
        File.WriteAllText(Path.Combine(directory, "capture.json"), frames.ToString(), new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(directory, "state.json"), BuildSnapshot(requestId, new List<KeyValuePair<string, string>>()), new UTF8Encoding(false));
        WriteResult(frames.ToString());
        Logger.LogInfo("Parity capture complete: " + directory);
        _busy = false;
    }

    private static string Invariant(float value) => value.ToString("R", System.Globalization.CultureInfo.InvariantCulture);
    private static string DoubleInvariant(double value) => value.ToString("R", System.Globalization.CultureInfo.InvariantCulture);

    private static void ConfigureCaptureResolution(ref string levelName)
    {
        string[] parts = levelName.Split(':');
        if (parts.Length != 3) return;
        levelName = parts[0];
        Screen.SetResolution(int.Parse(parts[1]), int.Parse(parts[2]), false);
    }

    private static string DrawField(string name)
    {
        var field = typeof(Draw).GetField(name, System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        return Invariant((float)field.GetValue(null));
    }

    private static void SetTimedControl(string command)
    {
        HoldState.Dx = HoldState.Dy = 0;
        HoldState.DirectionMask = 0;
        HoldState.RequestedControl = command.ToUpperInvariant();
        HoldState.Undo = HoldState.Redo = HoldState.Restart = false;
        if (command.StartsWith("INSPECT_", StringComparison.OrdinalIgnoreCase))
        {
            ExecuteCommand(command);
            return;
        }
        foreach (string token in command.ToUpperInvariant().Split('+'))
        {
            switch (token)
            {
                case "RIGHT": HoldState.DirectionMask |= 8; break;
                case "LEFT": HoldState.DirectionMask |= 4; break;
                case "UP": HoldState.DirectionMask |= 1; break;
                case "DOWN": HoldState.DirectionMask |= 2; break;
                case "UNDO": HoldState.Undo = true; break;
                case "REDO": HoldState.Redo = true; break;
                case "RESTART": HoldState.Restart = true; break;
                case "NONE": break;
                default: throw new ArgumentException("Unknown timed control " + command);
            }
        }
    }

    private IEnumerator RunMotionCaptureScenario(string requestId, string levelName, IReadOnlyList<string> commands)
    {
        _busy = true;
        int previousTargetFrameRate = Application.targetFrameRate;
        int previousVSync = QualitySettings.vSyncCount;
        Application.targetFrameRate = 60;
        QualitySettings.vSyncCount = 0;
        ConfigureCaptureResolution(ref levelName);
        World.GoToLevel(levelName);
        int framesRemaining = 600;
        while (framesRemaining-- > 0 && (World.currentLevelName != levelName || World.State != World.WS.Playing || World.Transitioning)) yield return null;
        if (World.currentLevelName != levelName || World.State != World.WS.Playing || World.Transitioning)
        {
            WriteResult("{\"requestId\":\"" + EscapeJson(requestId) + "\",\"error\":\"Motion level load timed out\"}");
            Application.targetFrameRate = previousTargetFrameRate;
            QualitySettings.vSyncCount = previousVSync;
            _busy = false;
            yield break;
        }
        HoldState.Clear();
        UndoManager.StopAnimations();
        World.AnyBlockMoving = false;
        World.ResetMultiplePlayersState();
        int timelineStart = 0;
        for (int i = 0; i < commands.Count; i++) if (commands[i] == "|") timelineStart = i + 1;
        for (int i = 0; i < timelineStart - 1; i++)
        {
            ExecuteCommand(commands[i]);
            UndoManager.StopAnimations();
            World.AnyBlockMoving = false;
            World.ResetMultiplePlayersState();
        }
        float settleDeadline = Time.unscaledTime + 0.8f;
        while (Time.unscaledTime < settleDeadline || (Draw.CameraMode == Draw.CM.SpecificBlock ? Draw.cameraMoving : Draw.newCamT < 1f)) yield return null;
        string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId);
        Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, "start-state.json"), BuildSnapshot(requestId, new List<KeyValuePair<string, string>>()), new UTF8Encoding(false));
        HoldState.Force = true;
        var frames = new StringBuilder();
        frames.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append("\",\"level\":\"").Append(EscapeJson(levelName)).Append("\",\"screenWidth\":").Append(Screen.width).Append(",\"screenHeight\":").Append(Screen.height);
        frames.Append(",\"targetFrameRate\":60,\"vSyncCount\":0,\"moveDelay\":").Append(Prefs.MoveDelay).Append(",\"allowSkippingAnimation\":").Append(JsonBool(Prefs.AllowSkippingAnimation)).Append(",\"instantZoom\":").Append(JsonBool(Prefs.InstantZoom)).Append(",\"frames\":[");
        float start = Time.unscaledTime;
        PhaseTrace.Samples.Clear();
        PhaseTrace.StartTime = start;
        PhaseTrace.Active = true;
        PhaseTrace.Record("capture-start");
        int captureIndex = 0;
        for (int eventIndex = timelineStart; eventIndex < commands.Count; eventIndex++)
        {
            string[] parts = commands[eventIndex].Split(':');
            string control = parts[0];
            int duration = parts.Length > 1 ? int.Parse(parts[1]) : 120;
            SetTimedControl(control);
            PhaseTrace.Record("request:" + control);
            float eventStart = Time.unscaledTime;
            while ((Time.unscaledTime - eventStart) * 1000f < duration)
            {
                yield return new WaitForEndOfFrame();
                Block player = World.FindPlayerBlock();
                string filename = "frame-" + captureIndex.ToString("D4") + ".png";
                if (captureIndex > 0) frames.Append(",");
                frames.Append("{\"file\":\"").Append(filename).Append("\",\"frame\":").Append(Time.frameCount).Append(",\"elapsedMs\":").Append(Invariant((Time.unscaledTime-start)*1000f)).Append(",\"deltaMs\":").Append(Invariant(Time.unscaledDeltaTime*1000f)).Append(",\"control\":\"").Append(EscapeJson(control)).Append("\",\"eventIndex\":").Append(eventIndex-timelineStart).Append(",\"eventStartMs\":").Append(Invariant((eventStart-start)*1000f));
                frames.Append(",\"moveCount\":").Append(World.MoveCount).Append(",\"levelName\":\"").Append(EscapeJson(World.currentLevelName)).Append("\",\"outerLevel\":").Append(World.levels.IndexOf(player.OuterLevel)).Append(",\"x\":").Append(player.xpos).Append(",\"y\":").Append(player.ypos).Append(",\"anim\":\"").Append(player.Anim).Append("\",\"animT\":").Append(Invariant(player.AnimT)).Append(",\"animLength\":").Append(Invariant(player.AnimLength)).Append(",\"drawXOffset\":").Append(Invariant(player.DrawXOffset)).Append(",\"drawYOffset\":").Append(Invariant(player.DrawYOffset)).Append(",\"drawXScale\":").Append(Invariant(player.DrawXScale)).Append(",\"drawYScale\":").Append(Invariant(player.DrawYScale));
                frames.Append(",\"anyBlockMoving\":").Append(JsonBool(World.AnyBlockMoving)).Append(",\"cameraFlipH\":").Append(JsonBool(Draw.FlipH)).Append(",\"cameraAnimT\":").Append(Invariant(Draw.AnimT)).Append(",\"cameraAnimLength\":").Append(Invariant(Draw.AnimLength)).Append(",\"newCamT\":").Append(Invariant(Draw.newCamT)).Append(",\"newX\":").Append(DrawField("newX")).Append(",\"newY\":").Append(DrawField("newY")).Append(",\"newXS\":").Append(DrawField("newXS")).Append(",\"newYS\":").Append(DrawField("newYS")).Append("}");
                Texture2D image = ScreenCapture.CaptureScreenshotAsTexture();
                File.WriteAllBytes(Path.Combine(directory, filename), image.EncodeToPNG());
                UnityEngine.Object.Destroy(image);
                captureIndex++;
                yield return null;
            }
        }
        HoldState.Clear();
        PhaseTrace.Record("capture-end");
        PhaseTrace.Active = false;
        File.WriteAllText(Path.Combine(directory, "phases.json"), "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"startTime\":" + Invariant(start) + ",\"samples\":[" + string.Join(",", PhaseTrace.Samples) + "]}", new UTF8Encoding(false));
        frames.Append("]}");
        File.WriteAllText(Path.Combine(directory, "capture.json"), frames.ToString(), new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(directory, "end-state.json"), BuildSnapshot(requestId, new List<KeyValuePair<string, string>>()), new UTF8Encoding(false));
        WriteResult(frames.ToString());
        Application.targetFrameRate = previousTargetFrameRate;
        QualitySettings.vSyncCount = previousVSync;
        Logger.LogInfo("Parity motion capture complete: " + directory);
        _busy = false;
    }

    private IEnumerator RunWallReadbackScenario(string requestId, string selection)
    {
        _busy = true;
        yield return new WaitForEndOfFrame();
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic;
        object draw = typeof(Draw).GetField("instance", flags | System.Reflection.BindingFlags.Static).GetValue(null);
        string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId);
        Directory.CreateDirectory(directory);
        var metadata = new StringBuilder();
        metadata.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append("\",\"kind\":\"gpu-wall-readback\",\"activeColorSpace\":\"").Append(QualitySettings.activeColorSpace).Append("\",\"graphicsDeviceType\":\"").Append(SystemInfo.graphicsDeviceType).Append("\",\"graphicsDeviceVersion\":\"").Append(EscapeJson(SystemInfo.graphicsDeviceVersion)).Append("\",\"renderTextureReadWrite\":\"Linear\",\"readbackFormat\":\"RGBA32 linear\",\"glSrgbWriteDuringBlit\":false,\"textures\":[");
        bool first = true;
        var sourceGroups = new List<KeyValuePair<string, Texture[]>>();
        foreach (string fieldName in selection == "RENDER" || selection == "EFFECTS" ? Array.Empty<string>() : selection == "EXTRAS" ? new[] { "WallBig", "WallBigFlip" } : new[] { "WallTiles", "WallTilesFlip" })
            sourceGroups.Add(new KeyValuePair<string, Texture[]>(fieldName, (Texture[])typeof(Draw).GetField(fieldName, flags | System.Reflection.BindingFlags.Instance).GetValue(draw)));
        if (selection == "RENDER")
            foreach (string fieldName in new[] { "CenterGradientTex", "ButtonTex", "PlayerButtonTex", "PlayerButtonOnlyEyesTex", "PlayerButtonOnlyEyesSmallTex", "PlayerButtonEyeTex", "PlayerButtonEyeSmallTex", "EyeOpen", "EyeOpenSmall", "EyeClosed", "EyeClosedSmall", "PossessEye", "PossessEyeSmall", "QuickAnimButtonTex", "QuickAnimPlayerButtonTex", "ArrowKeys", "WASD" })
                sourceGroups.Add(new KeyValuePair<string, Texture[]>(fieldName, new[] { (Texture)typeof(Draw).GetField(fieldName, flags | System.Reflection.BindingFlags.Instance).GetValue(draw) }));
        if (selection == "EXTRAS")
        {
            int controlIndex = 0;
            foreach (Draw.ControlIcon icon in ((Draw)draw).KeyboardControls)
            {
                string safeName = System.Text.RegularExpressions.Regex.Replace(icon.controlName, "[^A-Za-z0-9_-]", "_");
                sourceGroups.Add(new KeyValuePair<string, Texture[]>("KeyboardControls_" + controlIndex++ + "_" + safeName, new[] { icon.texture }));
            }
            sourceGroups.Add(new KeyValuePair<string, Texture[]>("MouseZoom", new[] { (Texture)typeof(Draw).GetField("MouseZoom", flags | System.Reflection.BindingFlags.Instance).GetValue(draw) }));
        }
        if (selection == "EFFECTS")
            foreach (string fieldName in new[] { "InfParticleTex", "InfParticleOutlineTex" })
                sourceGroups.Add(new KeyValuePair<string, Texture[]>(fieldName, new[] { (Texture)typeof(Draw).GetField(fieldName, flags | System.Reflection.BindingFlags.Instance).GetValue(draw) }));
        foreach (KeyValuePair<string, Texture[]> group in sourceGroups)
        {
            string fieldName = group.Key;
            Texture[] textures = group.Value;
            for (int index = 0; index < textures.Length; index++)
            {
                if (selection != "ALL" && selection != "EXTRAS" && selection != "RENDER" && selection != "EFFECTS" && index != int.Parse(selection)) continue;
                Texture source = textures[index];
                RenderTexture previous = RenderTexture.active;
                bool previousSrgbWrite = GL.sRGBWrite;
                RenderTexture target = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear);
                Texture2D readback = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false, true);
                string filename = (fieldName == "WallTiles" ? "wall_main_" : fieldName == "WallTilesFlip" ? "wall_flip_" : fieldName.ToLowerInvariant() + "_") + index + ".png";
                try
                {
                    GL.sRGBWrite = false;
                    Graphics.Blit(source, target);
                    RenderTexture.active = target;
                    readback.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0, false);
                    readback.Apply(false, false);
                    File.WriteAllBytes(Path.Combine(directory, filename), readback.EncodeToPNG());
                }
                finally
                {
                    RenderTexture.active = previous;
                    GL.sRGBWrite = previousSrgbWrite;
                    RenderTexture.ReleaseTemporary(target);
                    UnityEngine.Object.Destroy(readback);
                }
                Texture2D texture2D = source as Texture2D;
                if (!first) metadata.Append(",");
                first = false;
                metadata.Append("{\"file\":\"").Append(filename).Append("\",\"sourceField\":\"").Append(fieldName).Append("\",\"index\":").Append(index).Append(",\"name\":\"").Append(EscapeJson(source.name)).Append("\",\"width\":").Append(source.width).Append(",\"height\":").Append(source.height).Append(",\"sourceFormat\":\"").Append(texture2D == null ? "unknown" : texture2D.format.ToString()).Append("\",\"graphicsFormat\":\"").Append(source.graphicsFormat).Append("\",\"filterMode\":\"").Append(source.filterMode).Append("\",\"wrapMode\":\"").Append(source.wrapMode).Append("\",\"mipmapCount\":").Append(source.mipmapCount).Append("}");
            }
        }
        metadata.Append("]}");
        File.WriteAllText(Path.Combine(directory, "capture.json"), metadata.ToString(), new UTF8Encoding(false));
        WriteResult(metadata.ToString());
        Logger.LogInfo("Parity GPU readback complete: " + directory);
        _busy = false;
    }

    private static string FileHash(string path)
    {
        if (!File.Exists(path)) return "absent";
        using (SHA256 sha = SHA256.Create())
            return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant();
    }

    private IEnumerator RunIsolatedMotionCaptureScenario(string requestId, string levelName, IReadOnlyList<string> commands)
    {
        SaveFile.SaveData previousSave = SaveFile.Current;
        string savePath = (string)typeof(SaveFile).GetMethod("GetSaveFilePath", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic).Invoke(null, new object[] { SaveFile.Slot });
        string beforeHash = FileHash(savePath);
        CaptureSaveGuard.Suppress = true;
        CaptureSaveGuard.SuppressedCalls = 0;
        CaptureSaveGuard.PendingResult = null;
        SaveFile.Current = new SaveFile.SaveData();
        try
        {
            IEnumerator inner = RunMotionCaptureScenario(requestId, levelName, commands);
            while (inner.MoveNext()) yield return inner.Current;
        }
        finally
        {
            HoldState.Clear();
            SaveFile.Current = previousSave;
            CaptureSaveGuard.Suppress = false;
            string afterHash = FileHash(savePath);
            string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId);
            Directory.CreateDirectory(directory);
            string audit = "{\"savePath\":\"" + EscapeJson(savePath) + "\",\"beforeHash\":\"" + beforeHash + "\",\"afterHash\":\"" + afterHash + "\",\"unchanged\":" + JsonBool(beforeHash == afterHash) + ",\"suppressedSaveCalls\":" + CaptureSaveGuard.SuppressedCalls + ",\"previousInMemorySaveRestored\":true}";
            File.WriteAllText(Path.Combine(directory, "isolation.json"), audit, new UTF8Encoding(false));
            WriteResult(CaptureSaveGuard.PendingResult ?? ("{\"requestId\":\"" + EscapeJson(requestId) + "\",\"error\":\"Isolated capture failed; inspect original log\"}"));
        }
    }

    private void WriteResult(string contents)
    {
        if (CaptureSaveGuard.Suppress)
        {
            CaptureSaveGuard.PendingResult = contents;
            return;
        }
        string temporaryPath = _resultPath + ".tmp";
        for (int attempt = 0; attempt < 50; attempt++)
        {
            try
            {
                File.WriteAllText(temporaryPath, contents, new UTF8Encoding(false));
                if (File.Exists(_resultPath))
                {
                    File.Delete(_resultPath);
                }
                File.Move(temporaryPath, _resultPath);
                return;
            }
            catch (IOException) when (attempt < 49)
            {
                System.Threading.Thread.Sleep(10);
            }
        }
    }

    private static string JsonBool(bool value)
    {
        return value ? "true" : "false";
    }

    private static string EscapeJson(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("\t", "\\t");
    }
}
