using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using BepInEx;
using HarmonyLib;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace AgentObserver;

[BepInPlugin(
    "com.example.agentobserver",
    "Agent Observer",
    "1.0.0"
)]
public sealed class Plugin : BaseUnityPlugin
{
    private static Mouse CapturePointerMouse;
    private static Mouse PreviousPointerMouse;
    private static string PointerDeviceCreation;
    private static string PointerDeviceRelease;
    private static void ReleasePointerDevice()
    {
        bool hadCaptureDevice = CapturePointerMouse != null;
        if (CapturePointerMouse != null && CapturePointerMouse.added) InputSystem.RemoveDevice(CapturePointerMouse);
        bool temporaryRemoved = CapturePointerMouse == null || !CapturePointerMouse.added;
        CapturePointerMouse = null;
        if (PreviousPointerMouse != null && PreviousPointerMouse.added) PreviousPointerMouse.MakeCurrent();
        if (hadCaptureDevice) PointerDeviceRelease = "{\"temporaryDeviceRemoved\":" + JsonBool(temporaryRemoved) + ",\"previousDeviceName\":\"" + EscapeJson(PreviousPointerMouse == null ? "" : PreviousPointerMouse.name) + "\",\"previousDeviceRestored\":" + JsonBool(Mouse.current == PreviousPointerMouse) + "}";
        PreviousPointerMouse = null;
    }
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
        public static int DirectionMaskLast;
        public static bool Escape, Confirm, Cancel;
        public static bool EscapeLast, ConfirmLast, CancelLast;
        public static bool PointerActive, PointerLeft, PointerRight, PointerLeftLast, PointerRightLast, PointerInitialized;
        public static float PointerX, PointerY, PointerXLast, PointerYLast;
        public static bool PointerIdle;

        public static void Clear()
        {
            ReleasePointerDevice();
            Dx = 0;
            Dy = 0;
            DirectionMask = 0;
            RequestedControl = "NONE";
            Force = Undo = Redo = Restart = UndoLast = RedoLast = RestartLast = false;
            DirectionMaskLast = 0;
            Escape = Confirm = Cancel = EscapeLast = ConfirmLast = CancelLast = false;
            PointerActive = PointerLeft = PointerRight = PointerLeftLast = PointerRightLast = PointerInitialized = false;
            PointerX = PointerY = PointerXLast = PointerYLast = 0;
            PointerIdle = true;
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
            int deliveredMask = (Controls.up ? 1 : 0) | (Controls.down ? 2 : 0) | (Controls.left ? 4 : 0) | (Controls.right ? 8 : 0);
            int pressedMask = deliveredMask & ~HoldState.DirectionMaskLast;
            Controls.upPressed = (pressedMask & 1) != 0;
            Controls.downPressed = (pressedMask & 2) != 0;
            Controls.leftPressed = (pressedMask & 4) != 0;
            Controls.rightPressed = (pressedMask & 8) != 0;
            HoldState.DirectionMaskLast = deliveredMask;
            Controls.undo = HoldState.Undo;
            Controls.redo = HoldState.Redo;
            Controls.restart = HoldState.Restart;
            Controls.undoPressed = HoldState.Undo && !HoldState.UndoLast;
            Controls.redoPressed = HoldState.Redo && !HoldState.RedoLast;
            Controls.restartPressed = HoldState.Restart && !HoldState.RestartLast;
            Controls.escape = HoldState.Escape;
            Controls.escapePressed = HoldState.Escape && !HoldState.EscapeLast;
            Controls.confirm = HoldState.Confirm;
            Controls.confirmPressed = HoldState.Confirm && !HoldState.ConfirmLast;
            Controls.cancel = HoldState.Cancel;
            Controls.cancelPressed = HoldState.Cancel && !HoldState.CancelLast;
            HoldState.EscapeLast = HoldState.Escape;
            HoldState.ConfirmLast = HoldState.Confirm;
            HoldState.CancelLast = HoldState.Cancel;
            HoldState.UndoLast = HoldState.Undo;
            HoldState.RedoLast = HoldState.Redo;
            HoldState.RestartLast = HoldState.Restart;
            if (HoldState.PointerActive)
            {
                if (CapturePointerMouse != null) CapturePointerMouse.MakeCurrent();
                Controls.mouseX = HoldState.PointerX;
                Controls.mouseY = HoldState.PointerY;
                Controls.lmb = HoldState.PointerLeft;
                Controls.lmbPressed = HoldState.PointerLeft && !HoldState.PointerLeftLast;
                Controls.lmbReleased = !HoldState.PointerLeft && HoldState.PointerLeftLast;
                Controls.rmb = HoldState.PointerRight;
                Controls.rmbPressed = HoldState.PointerRight && !HoldState.PointerRightLast;
                Controls.rmbReleased = !HoldState.PointerRight && HoldState.PointerRightLast;
                Controls.scrollY = 0;
                if ((Controls.up || Controls.down || Controls.left || Controls.right || Controls.undo || Controls.redo || Controls.restart || Controls.escape || Controls.confirm || Controls.cancel) && Controls.mouseX >= 0 && Controls.mouseX <= Draw.screenWidth && Controls.mouseY >= 0 && Controls.mouseY <= Draw.screenHeight) HoldState.PointerIdle = true;
                if (!HoldState.PointerInitialized || HoldState.PointerX != HoldState.PointerXLast || HoldState.PointerY != HoldState.PointerYLast || Controls.lmb || Controls.rmb) HoldState.PointerIdle = false;
                World.InspectMouseIdle = HoldState.PointerIdle;
                HoldState.PointerXLast = Controls.mouseX;
                HoldState.PointerYLast = Controls.mouseY;
                HoldState.PointerInitialized = true;
            }
            HoldState.PointerLeftLast = HoldState.PointerActive && HoldState.PointerLeft;
            HoldState.PointerRightLast = HoldState.PointerActive && HoldState.PointerRight;
            PhaseTrace.Record("controls-delivered");
        }
    }

    internal static class InspectionTrace
    {
        public static readonly List<string> Samples = new List<string>();
        private static readonly System.Reflection.MethodInfo ComputeMouse = typeof(World).GetMethod("ComputeMousePosition", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        public static void Record(string phase, World world)
        {
            if (!PhaseTrace.Active) return;
            Block focus = World.InspectBlock ?? Draw.FocusBlock;
            int x = -1, y = -1;
            Block candidate = null;
            bool inBounds = false;
            if (focus != null && focus.SubLevel != null)
            {
                object[] arguments = { 0, 0, focus };
                ComputeMouse.Invoke(world, arguments);
                x = (int)arguments[0]; y = (int)arguments[1];
                inBounds = focus.SubLevel.InBounds(x, y);
                if (inBounds) candidate = focus.SubLevel.blocks[x, y];
            }
            var row = new StringBuilder();
            row.Append("{\"phase\":\"").Append(phase).Append("\",\"frame\":").Append(Time.frameCount).Append(",\"elapsedMs\":").Append(Invariant((Time.unscaledTime - PhaseTrace.StartTime) * 1000f));
            row.Append(",\"requestedControl\":\"").Append(EscapeJson(HoldState.RequestedControl)).Append("\",\"injectedPointer\":").Append(JsonBool(HoldState.PointerActive)).Append(",\"applicationFocused\":").Append(JsonBool(Application.isFocused));
            Mouse rawMouse = Mouse.current;
            Vector2 rawPosition = rawMouse == null ? Vector2.zero : rawMouse.position.ReadValue();
            row.Append(",\"rawMouse\":{\"name\":\"").Append(EscapeJson(rawMouse == null ? "" : rawMouse.name)).Append("\",\"temporaryCaptureDevice\":").Append(JsonBool(rawMouse != null && rawMouse == CapturePointerMouse)).Append(",\"x\":").Append(Invariant(rawPosition.x)).Append(",\"nativeBottomY\":").Append(Invariant(rawPosition.y)).Append("}");
            row.Append(",\"mouse\":{\"x\":").Append(Invariant(Controls.mouseX)).Append(",\"nativeBottomY\":").Append(Invariant(Controls.mouseY)).Append(",\"topY\":").Append(Invariant(Screen.height - Controls.mouseY)).Append(",\"left\":").Append(JsonBool(Controls.lmb)).Append(",\"leftPressed\":").Append(JsonBool(Controls.lmbPressed)).Append(",\"leftReleased\":").Append(JsonBool(Controls.lmbReleased)).Append(",\"right\":").Append(JsonBool(Controls.rmb)).Append(",\"rightPressed\":").Append(JsonBool(Controls.rmbPressed)).Append(",\"rightReleased\":").Append(JsonBool(Controls.rmbReleased)).Append(",\"scrollY\":").Append(Invariant(Controls.scrollY)).Append("}");
            row.Append(",\"gates\":{\"drawStyle\":\"").Append(Draw.DrawStyle).Append("\",\"cameraMode\":\"").Append(Draw.CameraMode).Append("\",\"cameraMoving\":").Append(JsonBool(Draw.cameraMoving)).Append(",\"anyBlockMoving\":").Append(JsonBool(World.AnyBlockMoving)).Append(",\"inHub\":").Append(JsonBool(World.InHub())).Append(",\"winning\":").Append(JsonBool(World.Winning)).Append(",\"mobile\":").Append(JsonBool(World.OnMobilePlatform())).Append(",\"inspectMouseIdle\":").Append(JsonBool(World.InspectMouseIdle)).Append(",\"inspectMovedSinceTouch\":").Append(JsonBool(World.InspectMovedSinceTouch)).Append("}");
            row.Append(",\"focusBlock\":").Append(World.blocks.IndexOf(focus)).Append(",\"inspectBlock\":").Append(World.blocks.IndexOf(World.InspectBlock)).Append(",\"hoverBlockLast\":").Append(World.blocks.IndexOf(World.HoverBlockLast)).Append(",\"cellX\":").Append(x).Append(",\"cellY\":").Append(y).Append(",\"inBounds\":").Append(JsonBool(inBounds));
            row.Append(",\"candidate\":");
            if (candidate == null) row.Append("null");
            else row.Append("{\"block\":").Append(World.blocks.IndexOf(candidate)).Append(",\"hasSubLevel\":").Append(JsonBool(candidate.SubLevel != null)).Append(",\"filledWithWalls\":").Append(JsonBool(candidate.SubLevel != null && candidate.SubLevel.FilledWithWalls)).Append(",\"moving\":").Append(JsonBool(candidate.Moving)).Append(",\"inspectHover\":").Append(JsonBool(candidate.InspectHover)).Append("}");
            row.Append(",\"cameraAnimT\":").Append(Invariant(Draw.AnimT)).Append(",\"cameraAnimLength\":").Append(Invariant(Draw.AnimLength)).Append("}");
            Samples.Add(row.ToString());
        }
    }

    [HarmonyPatch(typeof(World), "InspectUpdate")]
    internal static class InspectionBoundaryPatch
    {
        [HarmonyPrefix] private static void Prefix(World __instance) => InspectionTrace.Record("before", __instance);
        [HarmonyPostfix] private static void Postfix(World __instance) => InspectionTrace.Record("after", __instance);
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
            row.Append(",\"worldState\":\"").Append(World.State).Append("\",\"transitionSceneName\":\"").Append(EscapeJson(World.TransitionSceneName ?? "")).Append("\",\"transitionCounter\":").Append(Invariant(World.TransitionCounter)).Append(",\"menu\":\"").Append(PauseMenu.Menu).Append("\",\"menuSelect\":").Append(PauseMenu.Select);
            row.Append(",\"menuControls\":{\"escape\":").Append(JsonBool(Controls.escape)).Append(",\"escapePressed\":").Append(JsonBool(Controls.escapePressed)).Append(",\"confirm\":").Append(JsonBool(Controls.confirm)).Append(",\"confirmPressed\":").Append(JsonBool(Controls.confirmPressed)).Append(",\"cancel\":").Append(JsonBool(Controls.cancel)).Append(",\"cancelPressed\":").Append(JsonBool(Controls.cancelPressed)).Append(",\"upPressed\":").Append(JsonBool(Controls.upPressed)).Append(",\"downPressed\":").Append(JsonBool(Controls.downPressed)).Append(",\"leftPressed\":").Append(JsonBool(Controls.leftPressed)).Append(",\"rightPressed\":").Append(JsonBool(Controls.rightPressed)).Append("}");
            row.Append(",\"drawStyle\":\"").Append(Draw.DrawStyle).Append("\",\"inspectBlock\":").Append(World.blocks.IndexOf(World.InspectBlock)).Append(",\"inspectFlipH\":").Append(JsonBool(World.InspectFlipH)).Append(",\"cameraMoving\":").Append(JsonBool(Draw.cameraMoving)).Append(",\"cameraAnimT\":").Append(Invariant(Draw.AnimT)).Append(",\"cameraAnimLength\":").Append(Invariant(Draw.AnimLength));
            row.Append(",\"focusBlockIndex\":").Append(World.blocks.IndexOf(Draw.FocusBlock)).Append(",\"cameraMovedThisTurn\":").Append(JsonBool(Draw.CameraMovedThisTurn)).Append(",\"playerMiscAnimT\":").Append(player == null ? "null" : Invariant(player.MiscAnimT));
            var moveRows = new List<string>();
            var previewRows = new List<string>();
            foreach (Draw.InfExitPreview preview in Draw.infExitPreviews) previewRows.Add("{\"dx\":" + preview.dx + ",\"dy\":" + preview.dy + ",\"exitBlocks\":[" + string.Join(",", preview.exitBlocks.ConvertAll(item => World.blocks.IndexOf(item).ToString())) + "]}");
            row.Append(",\"infExitPreviews\":[").Append(string.Join(",", previewRows)).Append("]");
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

    [HarmonyPatch(typeof(Draw), "DrawText")]
    internal static class FontTextPatch
    {
        public static int MoveFontSize;
        public static TextAnchor MoveAlignment;
        public static Draw.SquareFont MoveFont;
        public static string MoveText;
        public static Rect MoveRect;
        [HarmonyPostfix] private static void Postfix(string text, TextAnchor alignment, int fontSize, Draw.SquareFont font)
        {
            if (text.Trim() != "Move") return;
            MoveFontSize = fontSize; MoveAlignment = alignment; MoveFont = font;
            MoveText = text;
            MoveRect = (Rect)typeof(Draw).GetField("drawRect", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic).GetValue(null);
        }
    }

    [HarmonyPatch(typeof(Draw), "DrawControl")]
    internal static class ControlGeometryPatch
    {
        public static readonly Dictionary<string, string> Samples = new Dictionary<string, string>();
        [HarmonyPostfix] private static void Postfix(string actionName, string displayName, string groupName, float xCenter, float yCenter, int fontSize, Color color)
        {
            if (actionName != "Move" && actionName != "MoveNR") return;
            Rect rect = (Rect)typeof(Draw).GetField("drawRect", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic).GetValue(null);
            Samples[actionName] = "{\"action\":\"" + actionName + "\",\"displayName\":\"" + EscapeJson(displayName) + "\",\"groupNameArgument\":\"" + EscapeJson(groupName) + "\",\"xCenter\":" + Invariant(xCenter) + ",\"yCenter\":" + Invariant(yCenter) + ",\"fontSize\":" + fontSize + ",\"color\":" + ColorTrace.Rgba(color) + ",\"finalIconRect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"screen\":[" + Screen.width + "," + Screen.height + "],\"frame\":" + Time.frameCount + "}";
        }
    }

    [HarmonyPatch(typeof(Draw), "DrawText")]
    internal static class TuiFontTracePatch
    {
        public static bool Active;
        public static int LastFrame = -1;
        public static GUIStyle SourceStyle;
        public static string LevelContext;
        public static string SetRectArguments;
        public static readonly List<string> Samples = new List<string>();
        public static readonly HashSet<int> FontSizes = new HashSet<int>();
        [HarmonyPostfix] private static void Postfix(string text, Color color, TextAnchor alignment, int fontSize, Draw.SquareFont font)
        {
            if (!Active || font != Draw.SquareFont.FixedWidth || Event.current.type != EventType.Repaint) return;
            if (LastFrame != Time.frameCount) { Samples.Clear(); FontSizes.Clear(); LastFrame = Time.frameCount; }
            GUIStyle style = (GUIStyle)typeof(Draw).GetField("textguiStyle", ColorTrace.Fields).GetValue(null);
            SourceStyle = new GUIStyle(style); FontSizes.Add(fontSize);
            Rect rect = (Rect)typeof(Draw).GetField("drawRect", ColorTrace.Fields).GetValue(null);
            GUIContent content = new GUIContent(text);
            string V(Vector2 value) => "[" + Invariant(value.x) + "," + Invariant(value.y) + "]";
            Samples.Add("{\"text\":\"" + EscapeJson(text) + "\",\"fontSize\":" + fontSize + ",\"actualFontName\":\"" + EscapeJson(style.font.name) + "\",\"actualStyleFontSize\":" + style.fontSize + ",\"actualFontStyle\":\"" + style.fontStyle + "\",\"alignment\":\"" + alignment + "\",\"actualAlignment\":\"" + style.alignment + "\",\"color\":" + ColorTrace.Rgba(color) + ",\"rect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"calcSize\":" + V(style.CalcSize(content)) + ",\"lineHeight\":" + Invariant(style.lineHeight) + ",\"cursor0\":" + V(style.GetCursorPixelPosition(rect, content, 0)) + ",\"cursorEnd\":" + V(style.GetCursorPixelPosition(rect, content, text.Length)) + ",\"frame\":" + Time.frameCount + "}");
            if (LevelContext != null) Samples[Samples.Count - 1] = Samples[Samples.Count - 1].TrimEnd('}') + ",\"nativeLevelArguments\":" + LevelContext + ",\"setDrawRectArguments\":" + (SetRectArguments ?? "null") + "}";
        }
    }

    [HarmonyPatch(typeof(Draw), "TUIDrawLevel")]
    internal static class TuiLevelGeometryPatch
    {
        private static string Bits(float value) => "\"0x" + BitConverter.ToUInt32(BitConverter.GetBytes(value), 0).ToString("X8") + "\"";
        [HarmonyPrefix] private static void Prefix(Level level, float leftX, float topY, int fontSize)
        {
            if (!TuiFontTracePatch.Active) return;
            float ratio = (float)typeof(Draw).GetField("cellYToX", ColorTrace.Fields).GetValue(null);
            float height = (float)typeof(Draw).GetField("cellYToH", ColorTrace.Fields).GetValue(null);
            TuiFontTracePatch.SetRectArguments = null;
            TuiFontTracePatch.LevelContext = "{\"levelIndex\":" + World.levels.IndexOf(level) + ",\"levelWidth\":" + level.width + ",\"levelHeight\":" + level.height + ",\"leftX\":" + DoubleInvariant(leftX) + ",\"leftXFloatBits\":" + Bits(leftX) + ",\"topY\":" + DoubleInvariant(topY) + ",\"topYFloatBits\":" + Bits(topY) + ",\"fontSize\":" + fontSize + ",\"cellYToX\":" + DoubleInvariant(ratio) + ",\"cellYToXFloatBits\":" + Bits(ratio) + ",\"cellYToH\":" + DoubleInvariant(height) + ",\"cellYToHFloatBits\":" + Bits(height) + "}";
        }
        [HarmonyPostfix] private static void Postfix() { TuiFontTracePatch.LevelContext = null; }
    }

    [HarmonyPatch(typeof(Draw), "SetDrawRect")]
    internal static class TuiSetRectArgumentsPatch
    {
        [HarmonyPrefix] private static void Prefix(double x, double y, double width, double height)
        {
            if (!TuiFontTracePatch.Active || TuiFontTracePatch.LevelContext == null) return;
            TuiFontTracePatch.SetRectArguments = "[" + DoubleInvariant(x) + "," + DoubleInvariant(y) + "," + DoubleInvariant(width) + "," + DoubleInvariant(height) + "]";
        }
    }

    [HarmonyPatch(typeof(World), "OnGUI")]
    internal static class GuiFontPackPatch
    {
        public static bool Active;
        public static bool OddRect;
        public static bool FalsifyCase;
        public static bool CrossCase;
        public static bool TextCrossCase;
        public static int VariedTextSize;
        public static bool VariedTextFraction;
        public static int SamplingWidth;
        public static int SamplingTextIndex;
        public static bool AlignmentPairs;
        public static readonly string[] SamplingTexts = { "Move", "Undo", "U", "Move ", "Note: You can undo a reset" };
        public static readonly string[] VariedTexts = { "Move", "Undo", "Redo", "Menu", "M", "U", "MM", "UU", "Move ", "Undo ", "Reset puzzle", "Note: You can undo a reset" };
        public static readonly List<string> Samples = new List<string>();
        [HarmonyPostfix] private static void Postfix()
        {
            if (!Active || Event.current.type != EventType.Repaint) return;
            var flags = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static;
            var rectField = typeof(Draw).GetField("drawRect", flags);
            GUIStyle style = (GUIStyle)typeof(Draw).GetField("textguiStyle", flags).GetValue(null);
            Rect previousRect = (Rect)rectField.GetValue(null);
            Font previousFont = style.font; FontStyle previousFontStyle = style.fontStyle; int previousSize = style.fontSize; TextAnchor previousAlignment = style.alignment; Color previousTextColor = style.normal.textColor; Color previousColor = GUI.color;
            string V(Vector2 p) => "[" + Invariant(p.x) + "," + Invariant(p.y) + "]";
            try
            {
                GUI.color = Color.black; GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture); GUI.color = Color.white;
                Samples.Clear();
                if (AlignmentPairs)
                {
                    int pairIndex = 0;
                    foreach (string pairText in new[] { "Move", "U" })
                    foreach (int pairWidth in new[] { 361, 362 })
                    foreach (float pairOrigin in new[] { 0f, -0.25f })
                    {
                        float rowY = 10f + pairIndex * 64f;
                        Rect centerRect = new Rect(20f + pairOrigin, rowY, pairWidth, 82f);
                        rectField.SetValue(null, centerRect);
                        Draw.DrawText(pairText, Color.white, TextAnchor.MiddleCenter, 16, Draw.SquareFont.Main);
                        Vector2 centerCursor = style.GetCursorPixelPosition(centerRect, new GUIContent(pairText), 0);
                        string centerSample = BuildVariedGuiSample(style, pairText, centerRect, 16, pairIndex * 2);
                        Samples.Add(centerSample.Substring(0, centerSample.Length - 1) + ",\"pairIndex\":" + pairIndex + ",\"pairRole\":\"MiddleCenter\",\"pairOrigin\":" + Invariant(pairOrigin) + ",\"sourceCenterCursor\":" + V(centerCursor) + ",\"analysisRegion\":[0," + Invariant(rowY) + ",400,64]}");
                        Rect leftRect = new Rect(centerCursor.x + 400f - style.padding.left - style.contentOffset.x, centerCursor.y - style.padding.top - style.contentOffset.y, pairWidth, 82f);
                        rectField.SetValue(null, leftRect);
                        Draw.DrawText(pairText, Color.white, TextAnchor.UpperLeft, 16, Draw.SquareFont.Main);
                        string leftSample = BuildVariedGuiSample(style, pairText, leftRect, 16, pairIndex * 2 + 1);
                        Samples.Add(leftSample.Substring(0, leftSample.Length - 1) + ",\"pairIndex\":" + pairIndex + ",\"pairRole\":\"UpperLeft\",\"pairOrigin\":" + Invariant(pairOrigin) + ",\"sourceCenterCursor\":" + V(centerCursor) + ",\"analysisRegion\":[400," + Invariant(rowY) + ",400,64]}");
                        pairIndex++;
                    }
                    return;
                }
                if (VariedTextSize > 0)
                {
                    if (SamplingWidth > 0)
                    {
                        float[] origins = { -1f, -0.75f, -0.5f, -0.25f, 0f, 0.25f, 0.5f, 0.75f, 1f };
                        for (int index = 0; index < origins.Length; index++)
                        {
                            Rect samplingRect = new Rect(origins[index], 10f + index * 64f, SamplingWidth, 82f);
                            string samplingText = SamplingTexts[SamplingTextIndex];
                            rectField.SetValue(null, samplingRect);
                            Draw.DrawText(samplingText, Color.white, TextAnchor.MiddleCenter, VariedTextSize, Draw.SquareFont.Main);
                            Samples.Add(BuildVariedGuiSample(style, samplingText, samplingRect, VariedTextSize, index));
                        }
                        return;
                    }
                    for (int index = 0; index < VariedTexts.Length; index++)
                    {
                        int column = index / 6, row = index % 6;
                        Rect variedRect = new Rect(20f + column * 400f + (VariedTextFraction ? -0.25f : 0f), 10f + row * 95f + (VariedTextFraction ? 0.25f : 0f), 362f, 82f);
                        string variedText = VariedTexts[index];
                        rectField.SetValue(null, variedRect);
                        Draw.DrawText(variedText, Color.white, TextAnchor.MiddleCenter, VariedTextSize, Draw.SquareFont.Main);
                        Samples.Add(BuildVariedGuiSample(style, variedText, variedRect, VariedTextSize, index));
                    }
                    return;
                }
                int[] sizes = { 12, 16, 20 };
                for (int column = 0; column < 3; column++) for (int row = 0; row < (CrossCase ? 6 : 4); row++)
                {
                    float fraction = row * 0.25f; Rect rect = new Rect(50f + column * 240f + (OddRect ? fraction : 0f), 20f + row * 130f + fraction, OddRect ? 101f : 100f, OddRect ? 81f : 80f);
                    string text = "\nMove";
                    if (FalsifyCase) { bool even = row % 2 == 0; rect = new Rect(column * 240f - fraction, 20f + row * 130f + fraction, even ? 99f : 102f, even ? 79f : 82f); if (!even) text = "Undo"; }
                    if (CrossCase) rect = new Rect(column * 240f + (row < 3 ? 1f : -1f) * ((row % 3 + 1) * 0.25f), 10f + row * 95f, 102f, 82f);
                    if (TextCrossCase) { fraction = 0.25f; rect = new Rect(column * 240f - 0.25f, 20.25f + row * 130f, 102f, 82f); text = new[] { "Move", "\nMove", "Undo", "\nUndo" }[row]; }
                    rectField.SetValue(null, rect); Draw.DrawText(text, Color.white, TextAnchor.MiddleCenter, sizes[column], Draw.SquareFont.Main);
                    GUIContent content = new GUIContent(text);
                    Samples.Add("{\"fontSize\":" + sizes[column] + ",\"text\":\"" + EscapeJson(text) + "\",\"placementCursor\":" + (text.StartsWith("\n") ? 1 : 0) + ",\"calcSize\":" + V(style.CalcSize(content)) + ",\"lineHeight\":" + Invariant(style.lineHeight) + ",\"fractionY\":" + Invariant(fraction) + ",\"rect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"cursorIndices\":[0,1," + text.Length + "],\"cursors\":[" + V(style.GetCursorPixelPosition(rect, content, 0)) + "," + V(style.GetCursorPixelPosition(rect, content, 1)) + "," + V(style.GetCursorPixelPosition(rect, content, text.Length)) + "]}");
                }
            }
            finally { rectField.SetValue(null, previousRect); style.font = previousFont; style.fontStyle = previousFontStyle; style.fontSize = previousSize; style.alignment = previousAlignment; style.normal.textColor = previousTextColor; GUI.color = previousColor; }
        }
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
            if (ShineTrace.Context != null) ShineTrace.Record("requested-band", (Rect)typeof(Draw).GetField("drawRect", ColorTrace.Fields).GetValue(null), color);
            if (!ColorTrace.Active || ColorTrace.Context == null) return;
            Rect rect = (Rect)typeof(Draw).GetField("drawRect", ColorTrace.Fields).GetValue(null);
            Color32 candidate = color;
            ColorTrace.Samples.Add("{\"frame\":" + Time.frameCount + ",\"context\":" + ColorTrace.Context + ",\"texture\":\"" + EscapeJson(texture.name) + "\",\"rect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"rawGuiColor\":" + ColorTrace.Rgba(color) + ",\"explicitColor32Candidate\":[" + candidate.r + "," + candidate.g + "," + candidate.b + "," + candidate.a + "]}");
        }
    }

    internal static class ShineTrace
    {
        public static string Context;
        public static readonly List<string> Samples = new List<string>();
        public static void Record(string kind, Rect? rect = null, Color? color = null)
        {
            if (!PhaseTrace.Active || Context == null) return;
            string r = rect.HasValue ? ",\"rect\":[" + Invariant(rect.Value.x) + "," + Invariant(rect.Value.y) + "," + Invariant(rect.Value.width) + "," + Invariant(rect.Value.height) + "]" : "";
            Samples.Add("{\"kind\":\"" + kind + "\",\"frame\":" + Time.frameCount + ",\"elapsedMs\":" + Invariant((Time.unscaledTime - PhaseTrace.StartTime) * 1000f) + ",\"context\":" + Context + r + (color.HasValue ? ",\"color\":" + ColorTrace.Rgba(color.Value) : "") + "}");
        }
    }

    [HarmonyPatch(typeof(Draw), "DrawFlipShine")]
    internal static class FlipShinePatch
    {
        [HarmonyPrefix] private static void Prefix(double xc, double yc, double width, double height, Block block, bool flipH, bool cloneFade, int depth)
        {
            if (!PhaseTrace.Active) return;
            ShineTrace.Context = "{\"blockIndex\":" + World.blocks.IndexOf(block) + ",\"outerLevel\":" + World.levels.IndexOf(block.OuterLevel) + ",\"subLevel\":" + World.levels.IndexOf(block.SubLevel) + ",\"isPlayer\":" + JsonBool(block.IsPlayer) + ",\"miscAnimT\":" + Invariant(block.MiscAnimT) + ",\"anim\":\"" + block.Anim + "\",\"animT\":" + Invariant(block.AnimT) + ",\"animLength\":" + Invariant(block.AnimLength) + ",\"specialEffect\":" + block.SpecialEffect + ",\"flipH\":" + JsonBool(flipH) + ",\"cloneFade\":" + JsonBool(cloneFade) + ",\"depth\":" + depth + ",\"filledWithWalls\":" + JsonBool(block.SubLevel.FilledWithWalls) + ",\"focusBlockIndex\":" + World.blocks.IndexOf(Draw.FocusBlock) + ",\"cameraMovedThisTurn\":" + JsonBool(Draw.CameraMovedThisTurn) + ",\"cameraAnimT\":" + Invariant(Draw.AnimT) + ",\"cameraAnimLength\":" + Invariant(Draw.AnimLength) + ",\"ticketRect\":[" + DoubleInvariant(xc) + "," + DoubleInvariant(yc) + "," + DoubleInvariant(width) + "," + DoubleInvariant(height) + "]}";
            ShineTrace.Record("shine-call");
        }
        [HarmonyPostfix] private static void Postfix() { ShineTrace.Context = null; }
    }

    [HarmonyPatch(typeof(Graphics), "DrawTexture", new Type[] { typeof(Rect), typeof(Texture), typeof(Rect), typeof(int), typeof(int), typeof(int), typeof(int), typeof(Color), typeof(Material) })]
    internal static class GraphicsShineSubmitPatch
    {
        [HarmonyPrefix] private static void Prefix(Rect __0, Color __7) { if (ShineTrace.Context != null) ShineTrace.Record("submitted-band", __0, __7); }
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
        Harmony.CreateAndPatchAll(typeof(InspectionBoundaryPatch), "com.example.agentobserver.inspection-boundary");
        Harmony.CreateAndPatchAll(typeof(CaptureSavePatch), "com.example.agentobserver.capture-save");
        Harmony.CreateAndPatchAll(typeof(FontTextPatch), "com.example.agentobserver.font-text");
        Harmony.CreateAndPatchAll(typeof(ControlGeometryPatch), "com.example.agentobserver.control-geometry");
        Harmony.CreateAndPatchAll(typeof(TuiFontTracePatch), "com.example.agentobserver.tui-font");
        Harmony.CreateAndPatchAll(typeof(TuiLevelGeometryPatch), "com.example.agentobserver.tui-level-geometry");
        Harmony.CreateAndPatchAll(typeof(TuiSetRectArgumentsPatch), "com.example.agentobserver.tui-setrect-arguments");
        Harmony.CreateAndPatchAll(typeof(GuiFontPackPatch), "com.example.agentobserver.gui-font-pack");
        Harmony.CreateAndPatchAll(typeof(UpdatePhasePatch), "com.example.agentobserver.phase-update");
        Harmony.CreateAndPatchAll(typeof(ImpulsePhasePatch), "com.example.agentobserver.phase-impulse");
        Harmony.CreateAndPatchAll(typeof(LevelPhasePatch), "com.example.agentobserver.phase-level");
        Harmony.CreateAndPatchAll(typeof(HistoryPhasePatch), "com.example.agentobserver.phase-history");
        Harmony.CreateAndPatchAll(typeof(BackingColorPatch), "com.example.agentobserver.color-backing");
        Harmony.CreateAndPatchAll(typeof(BorderColorPatch), "com.example.agentobserver.color-border");
        Harmony.CreateAndPatchAll(typeof(WallColorPatch), "com.example.agentobserver.color-wall");
        Harmony.CreateAndPatchAll(typeof(TextureColorPatch), "com.example.agentobserver.color-texture");
        Harmony.CreateAndPatchAll(typeof(FlipShinePatch), "com.example.agentobserver.flip-shine");
        Harmony.CreateAndPatchAll(typeof(GraphicsShineSubmitPatch), "com.example.agentobserver.shine-submit");
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
            if (levelName == "GUI_FONT_ALIGNMENT_PAIRS")
            {
                GuiFontPackPatch.AlignmentPairs = true;
                GuiFontPackPatch.VariedTextSize = 16;
                GuiFontPackPatch.SamplingWidth = 0;
                GuiFontPackPatch.CrossCase = GuiFontPackPatch.TextCrossCase = GuiFontPackPatch.VariedTextFraction = false;
                StartCoroutine(RunGuiFontPackScenario(requestId));
                return;
            }
            if (levelName.StartsWith("GUI_FONT_SAMPLING:", StringComparison.OrdinalIgnoreCase))
            {
                string[] sampling = levelName.Split(':');
                int size = int.Parse(sampling[1]), width = int.Parse(sampling[2]), textIndex = int.Parse(sampling[3]);
                if ((size != 12 && size != 16 && size != 20) || width < 361 || width > 363 || textIndex < 0 || textIndex >= GuiFontPackPatch.SamplingTexts.Length) throw new ArgumentException("Invalid font sampling matrix case");
                GuiFontPackPatch.VariedTextSize = size;
                GuiFontPackPatch.SamplingWidth = width;
                GuiFontPackPatch.SamplingTextIndex = textIndex;
                GuiFontPackPatch.CrossCase = GuiFontPackPatch.TextCrossCase = GuiFontPackPatch.VariedTextFraction = false;
                StartCoroutine(RunGuiFontPackScenario(requestId));
                return;
            }
            if (levelName.StartsWith("GUI_FONT_VARIETY:", StringComparison.OrdinalIgnoreCase))
            {
                string[] variation = levelName.Split(':');
                int variedSize = int.Parse(variation[1]);
                if (variedSize != 12 && variedSize != 16 && variedSize != 20) throw new ArgumentException("Varied font size must be12/16/20");
                GuiFontPackPatch.VariedTextSize = variedSize;
                GuiFontPackPatch.SamplingWidth = 0;
                GuiFontPackPatch.VariedTextFraction = variation[2] == "FRACTION";
                GuiFontPackPatch.CrossCase = GuiFontPackPatch.TextCrossCase = false;
                StartCoroutine(RunGuiFontPackScenario(requestId));
                return;
            }
            if (levelName == "GUI_FONT_PACK" || levelName == "GUI_FONT_PACK_ODD" || levelName == "GUI_FONT_PACK_FALSIFY" || levelName == "GUI_FONT_PACK_CROSS" || levelName == "GUI_FONT_PACK_TEXT_CROSS")
            {
                GuiFontPackPatch.CrossCase = levelName == "GUI_FONT_PACK_CROSS";
                GuiFontPackPatch.TextCrossCase = levelName == "GUI_FONT_PACK_TEXT_CROSS";
                StartCoroutine(RunGuiFontPackScenario(requestId, levelName == "GUI_FONT_PACK_ODD", levelName == "GUI_FONT_PACK_FALSIFY"));
                return;
            }
            if (levelName == "FONT_FACE_METRICS")
            {
                RunFontFaceMetricsScenario(requestId);
                return;
            }
            if (levelName == "TUI_FONT_METRICS")
            {
                StartCoroutine(RunTuiFontMetricsScenario(requestId));
                return;
            }
            if (levelName == "FONT_METRICS")
            {
                StartCoroutine(RunFontMetricsScenario(requestId));
                return;
            }
            if (levelName.StartsWith("FONT_METRICS:", StringComparison.OrdinalIgnoreCase))
            {
                string[] size = levelName.Substring(13).Split('x');
                StartCoroutine(RunFontMetricsScenario(requestId, int.Parse(size[0]), int.Parse(size[1])));
                return;
            }
            if (levelName.StartsWith("GPU_WALL:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunWallReadbackScenario(requestId, levelName.Substring(9)));
                return;
            }
            if (levelName.StartsWith("ISOLATED_MOTION:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunIsolatedMotionCaptureScenario(requestId, levelName.Substring(16), commands, options));
                return;
            }
            if (levelName.StartsWith("MOTION:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunMotionCaptureScenario(requestId, levelName.Substring(7), commands));
                return;
            }
            if (levelName.StartsWith("SPARSE_MOTION:", StringComparison.OrdinalIgnoreCase))
            {
                StartCoroutine(RunMotionCaptureScenario(requestId, levelName.Substring(14), commands, 8));
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
        HoldState.Escape = HoldState.Confirm = HoldState.Cancel = false;
        HoldState.PointerActive = HoldState.PointerLeft = HoldState.PointerRight = false;
        if (command.StartsWith("POINTER_", StringComparison.OrdinalIgnoreCase))
        {
            string[] pointer = command.ToUpperInvariant().Split('_');
            if (pointer.Length != 4) throw new ArgumentException("Expected POINTER_x_topY_MOVE/LEFT/RIGHT");
            HoldState.PointerX = float.Parse(pointer[1], System.Globalization.CultureInfo.InvariantCulture);
            HoldState.PointerY = Screen.height - float.Parse(pointer[2], System.Globalization.CultureInfo.InvariantCulture);
            if (pointer[3] != "MOVE" && pointer[3] != "LEFT" && pointer[3] != "RIGHT") throw new ArgumentException("Unknown pointer state " + pointer[3]);
            HoldState.PointerActive = true;
            HoldState.PointerLeft = pointer[3] == "LEFT";
            HoldState.PointerRight = pointer[3] == "RIGHT";
            if (CapturePointerMouse == null)
            {
                PreviousPointerMouse = Mouse.current;
                CapturePointerMouse = InputSystem.AddDevice<Mouse>("ParityEvidenceMouse");
                PointerDeviceCreation = "{\"temporaryDeviceName\":\"" + EscapeJson(CapturePointerMouse.name) + "\",\"previousDeviceName\":\"" + EscapeJson(PreviousPointerMouse == null ? "" : PreviousPointerMouse.name) + "\"}";
            }
            CapturePointerMouse.MakeCurrent();
            MouseState state = new MouseState { position = new Vector2(HoldState.PointerX, HoldState.PointerY) };
            state = state.WithButton(MouseButton.Left, HoldState.PointerLeft).WithButton(MouseButton.Right, HoldState.PointerRight);
            InputSystem.QueueStateEvent(CapturePointerMouse, state);
            return;
        }
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
                case "ESCAPE": HoldState.Escape = true; break;
                case "CONFIRM": HoldState.Confirm = true; break;
                case "CANCEL": HoldState.Cancel = true; break;
                case "NONE": break;
                default: throw new ArgumentException("Unknown timed control " + command);
            }
        }
    }

    private IEnumerator RunMotionCaptureScenario(string requestId, string levelName, IReadOnlyList<string> commands, int screenshotStride = 1)
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
        if (World.InHub()) File.WriteAllText(Path.Combine(directory, "hub-start-state.json"), BuildHubSnapshot(requestId), new UTF8Encoding(false));
        HoldState.Force = true;
        var frames = new StringBuilder();
        frames.Append("{\"requestId\":\"").Append(EscapeJson(requestId)).Append("\",\"level\":\"").Append(EscapeJson(levelName)).Append("\",\"screenWidth\":").Append(Screen.width).Append(",\"screenHeight\":").Append(Screen.height);
        frames.Append(",\"targetFrameRate\":60,\"vSyncCount\":0,\"moveDelay\":").Append(Prefs.MoveDelay).Append(",\"allowSkippingAnimation\":").Append(JsonBool(Prefs.AllowSkippingAnimation)).Append(",\"instantZoom\":").Append(JsonBool(Prefs.InstantZoom)).Append(",\"frames\":[");
        if (screenshotStride > 1) { frames.Length -= "\"frames\":[".Length; frames.Append("\"screenshotStride\":").Append(screenshotStride).Append(",\"frames\":["); }
        float start = Time.unscaledTime;
        PhaseTrace.Samples.Clear();
        InspectionTrace.Samples.Clear();
        PointerDeviceCreation = PointerDeviceRelease = null;
        ShineTrace.Samples.Clear(); ShineTrace.Context = null;
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
            int eventFrameIndex = 0;
            while ((Time.unscaledTime - eventStart) * 1000f < duration)
            {
                yield return new WaitForEndOfFrame();
                Block player = World.FindPlayerBlock();
                string filename = "frame-" + captureIndex.ToString("D4") + ".png";
                bool imageCaptured = screenshotStride == 1 || eventFrameIndex % screenshotStride == 0 || duration - (Time.unscaledTime - eventStart) * 1000f <= 40f;
                if (captureIndex > 0) frames.Append(",");
                frames.Append("{\"file\":").Append(imageCaptured ? "\"" + filename + "\"" : "null").Append(",\"imageCaptured\":").Append(JsonBool(imageCaptured)).Append(",\"frame\":").Append(Time.frameCount).Append(",\"elapsedMs\":").Append(Invariant((Time.unscaledTime-start)*1000f)).Append(",\"deltaMs\":").Append(Invariant(Time.unscaledDeltaTime*1000f)).Append(",\"control\":\"").Append(EscapeJson(control)).Append("\",\"eventIndex\":").Append(eventIndex-timelineStart).Append(",\"eventStartMs\":").Append(Invariant((eventStart-start)*1000f));
                frames.Append(",\"moveCount\":").Append(World.MoveCount).Append(",\"levelName\":\"").Append(EscapeJson(World.currentLevelName)).Append("\",\"outerLevel\":").Append(World.levels.IndexOf(player.OuterLevel)).Append(",\"x\":").Append(player.xpos).Append(",\"y\":").Append(player.ypos).Append(",\"anim\":\"").Append(player.Anim).Append("\",\"animT\":").Append(Invariant(player.AnimT)).Append(",\"animLength\":").Append(Invariant(player.AnimLength)).Append(",\"drawXOffset\":").Append(Invariant(player.DrawXOffset)).Append(",\"drawYOffset\":").Append(Invariant(player.DrawYOffset)).Append(",\"drawXScale\":").Append(Invariant(player.DrawXScale)).Append(",\"drawYScale\":").Append(Invariant(player.DrawYScale));
                frames.Append(",\"anyBlockMoving\":").Append(JsonBool(World.AnyBlockMoving)).Append(",\"cameraFlipH\":").Append(JsonBool(Draw.FlipH)).Append(",\"cameraAnimT\":").Append(Invariant(Draw.AnimT)).Append(",\"cameraAnimLength\":").Append(Invariant(Draw.AnimLength)).Append(",\"newCamT\":").Append(Invariant(Draw.newCamT)).Append(",\"newX\":").Append(DrawField("newX")).Append(",\"newY\":").Append(DrawField("newY")).Append(",\"newXS\":").Append(DrawField("newXS")).Append(",\"newYS\":").Append(DrawField("newYS")).Append("}");
                if (imageCaptured) { Texture2D image = ScreenCapture.CaptureScreenshotAsTexture(); File.WriteAllBytes(Path.Combine(directory, filename), image.EncodeToPNG()); UnityEngine.Object.Destroy(image); }
                eventFrameIndex++;
                captureIndex++;
                yield return null;
            }
        }
        HoldState.Clear();
        PhaseTrace.Record("capture-end");
        PhaseTrace.Active = false;
        File.WriteAllText(Path.Combine(directory, "inspection.json"), "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"note\":\"Actual World.InspectUpdate before/after effective Controls with raw Unity InputSystem Mouse coordinates. Injected values use top-left converted to native bottom-up; not a physical OS mouse or focus-gate replay. No PushInspect/PopInspect method is invoked by timed pointer controls.\",\"deviceCreation\":" + (PointerDeviceCreation ?? "null") + ",\"deviceRelease\":" + (PointerDeviceRelease ?? "null") + ",\"samples\":[" + string.Join(",", InspectionTrace.Samples) + "]}", new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(directory, "shine.json"), "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"note\":\"Read-only original DrawFlipShine context; requested-band is pre-clamp DrawTexture entry; submitted-band is the actual Graphics.DrawTexture screenRect after native clamping.\",\"samples\":[" + string.Join(",", ShineTrace.Samples) + "]}", new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(directory, "phases.json"), "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"startTime\":" + Invariant(start) + ",\"samples\":[" + string.Join(",", PhaseTrace.Samples) + "]}", new UTF8Encoding(false));
        frames.Append("]}");
        File.WriteAllText(Path.Combine(directory, "capture.json"), frames.ToString(), new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(directory, "end-state.json"), BuildSnapshot(requestId, new List<KeyValuePair<string, string>>()), new UTF8Encoding(false));
        if (World.InHub()) File.WriteAllText(Path.Combine(directory, "hub-end-state.json"), BuildHubSnapshot(requestId), new UTF8Encoding(false));
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

    private IEnumerator RunGuiFontPackScenario(string requestId, bool oddRect = false, bool falsify = false)
    {
        _busy = true;
        Screen.SetResolution(800, 600, FullScreenMode.Windowed);
        yield return new WaitForSecondsRealtime(0.5f);
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;
        object draw = typeof(Draw).GetField("instance", flags).GetValue(null); Font font = (Font)typeof(Draw).GetField("MainFont", flags).GetValue(draw);
        var requestedCharacters = new StringBuilder();
        for (int ascii = 32; ascii <= 126; ascii++) requestedCharacters.Append((char)ascii);
        string fontCharacters = GuiFontPackPatch.VariedTextSize > 0 ? requestedCharacters.ToString() : "MoveUnd";
        foreach (int size in new[] { 12, 16, 20 }) font.RequestCharactersInTexture(fontCharacters, size, FontStyle.Normal);
        GuiFontPackPatch.OddRect = oddRect;
        GuiFontPackPatch.FalsifyCase = falsify;
        GuiFontPackPatch.Active = true;
        yield return new WaitForEndOfFrame();
        string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId); Directory.CreateDirectory(directory);
        try
        {
            Texture2D screen = ScreenCapture.CaptureScreenshotAsTexture();
            try { File.WriteAllBytes(Path.Combine(directory, "screen.png"), screen.EncodeToPNG()); } finally { UnityEngine.Object.Destroy(screen); }
            Texture texture = font.material.mainTexture; RenderTexture previousTarget = RenderTexture.active; bool previousSrgb = GL.sRGBWrite;
            RenderTexture target = RenderTexture.GetTemporary(texture.width, texture.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear);
            Texture2D readback = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false, true);
            try { GL.sRGBWrite = false; Graphics.Blit(texture, target); RenderTexture.active = target; readback.ReadPixels(new Rect(0, 0, texture.width, texture.height), 0, 0, false); readback.Apply(false, false); File.WriteAllBytes(Path.Combine(directory, "font-atlas.png"), readback.EncodeToPNG()); }
            finally { RenderTexture.active = previousTarget; GL.sRGBWrite = previousSrgb; RenderTexture.ReleaseTemporary(target); UnityEngine.Object.Destroy(readback); }
            var sizes = new List<string>();
            foreach (int size in new[] { 12, 16, 20 })
            {
                var glyphs = new List<string>();
                foreach (char character in fontCharacters) { bool found = font.GetCharacterInfo(character, out CharacterInfo glyph, size, FontStyle.Normal); glyphs.Add("{\"character\":\"" + EscapeJson(character.ToString()) + "\",\"found\":" + JsonBool(found) + ",\"advance\":" + glyph.advance + ",\"bounds\":[" + glyph.minX + "," + glyph.minY + "," + glyph.maxX + "," + glyph.maxY + "],\"uvBottomLeft\":" + JsonUtility.ToJson(glyph.uvBottomLeft) + ",\"uvBottomRight\":" + JsonUtility.ToJson(glyph.uvBottomRight) + ",\"uvTopLeft\":" + JsonUtility.ToJson(glyph.uvTopLeft) + ",\"uvTopRight\":" + JsonUtility.ToJson(glyph.uvTopRight) + "}"); }
                sizes.Add("{\"fontSize\":" + size + ",\"glyphs\":[" + string.Join(",", glyphs) + "]}");
            }
            var generatedTexts = new List<string>();
            if (GuiFontPackPatch.TextCrossCase) foreach (int size in new[] { 12, 16, 20 }) foreach (string text in new[] { "Move", "\nMove", "Undo", "\nUndo" }) generatedTexts.Add(GenerateTextMetric(font, size, text));
            string metadata = "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"screenWidth\":" + Screen.width + ",\"screenHeight\":" + Screen.height + ",\"entrypoint\":\"Draw.DrawText / GUI.Label\",\"probeKind\":\"" + (GuiFontPackPatch.AlignmentPairs ? "actual-gui-alignment-pairs" : GuiFontPackPatch.SamplingWidth > 0 ? "pixel-center-sampling-matrix" : GuiFontPackPatch.VariedTextSize > 0 ? "twelve-varied-single-line-strings" : "legacy-layout-pack") + "\",\"fontAtlasTextureId\":" + font.material.mainTexture.GetInstanceID() + ",\"charactersPerSize\":" + fontCharacters.Length + ",\"backdrop\":\"opaque black GUI.DrawTexture; diagnostic overlay only\",\"samples\":[" + string.Join(",", GuiFontPackPatch.Samples) + "],\"metrics\":[" + string.Join(",", sizes) + "]}";
            metadata = metadata.Substring(0, metadata.Length - 1) + ",\"textGeneratorMeasurements\":[" + string.Join(",", generatedTexts) + "]}";
            metadata = metadata.Substring(0, metadata.Length - 1) + ",\"fontSource\":{\"fontAssetName\":\"" + EscapeJson(font.name) + "\",\"fontNames\":[" + string.Join(",", Array.ConvertAll(font.fontNames, name => "\"" + EscapeJson(name) + "\"")) + "],\"assetFontSize\":" + font.fontSize + ",\"assetAscent\":" + font.ascent + ",\"assetLineHeight\":" + font.lineHeight + ",\"materialName\":\"" + EscapeJson(font.material.name) + "\",\"shaderName\":\"" + EscapeJson(font.material.shader.name) + "\",\"textureName\":\"" + EscapeJson(texture.name) + "\",\"textureWidth\":" + texture.width + ",\"textureHeight\":" + texture.height + ",\"filterMode\":\"" + texture.filterMode + "\",\"wrapMode\":\"" + texture.wrapMode + "\",\"graphicsFormat\":\"" + texture.graphicsFormat + "\"},\"samplingMatrixWidth\":" + GuiFontPackPatch.SamplingWidth + ",\"nativeGuiMeshVerticesExposed\":false}";
            File.WriteAllText(Path.Combine(directory, "gui-font-pack.json"), metadata, new UTF8Encoding(false)); WriteResult(metadata);
        }
        finally { GuiFontPackPatch.Active = false; GuiFontPackPatch.AlignmentPairs = false; GuiFontPackPatch.OddRect = false; GuiFontPackPatch.FalsifyCase = false; GuiFontPackPatch.VariedTextSize = 0; GuiFontPackPatch.VariedTextFraction = false; GuiFontPackPatch.SamplingWidth = 0; GuiFontPackPatch.SamplingTextIndex = 0; _busy = false; }
    }

    private static string BuildVariedGuiSample(GUIStyle style, string text, Rect rect, int size, int index)
    {
        string V(Vector2 vector) => "[" + Invariant(vector.x) + "," + Invariant(vector.y) + "]";
        GUIContent content = new GUIContent(text);
        var generated = new List<string>();
        foreach (TextAnchor anchor in new[] { TextAnchor.UpperLeft, TextAnchor.MiddleCenter })
        foreach (bool contentExtents in new[] { false, true })
        {
            using (var generator = new TextGenerator())
            {
                var extents = new Vector2(rect.width - (contentExtents ? style.padding.horizontal : 0), rect.height - (contentExtents ? style.padding.vertical : 0));
                var settings = new TextGenerationSettings { font = style.font, fontSize = size, fontStyle = style.fontStyle, color = Color.white, lineSpacing = 1f, scaleFactor = 1f, textAnchor = anchor, generationExtents = extents, pivot = new Vector2(0f, 1f), horizontalOverflow = HorizontalWrapMode.Overflow, verticalOverflow = VerticalWrapMode.Overflow, richText = style.richText, generateOutOfBounds = true };
                bool populated = generator.Populate(text, settings);
                var vertices = new List<string>(); foreach (UIVertex vertex in generator.verts) vertices.Add("[" + Invariant(vertex.position.x) + "," + Invariant(vertex.position.y) + "," + Invariant(vertex.position.z) + "]");
                var rawVertices = new List<string>(); foreach (UIVertex vertex in generator.verts) rawVertices.Add(JsonUtility.ToJson(vertex));
                var characters = new List<string>(); foreach (UICharInfo character in generator.characters) characters.Add(JsonUtility.ToJson(character));
                var lines = new List<string>(); foreach (UILineInfo line in generator.lines) lines.Add(JsonUtility.ToJson(line));
                string generatedRect = JsonUtility.ToJson(generator.rectExtents);
                float preferredWidth = generator.GetPreferredWidth(text, settings);
                generated.Add("{\"anchor\":\"" + anchor + "\",\"extentsKind\":\"" + (contentExtents ? "rect-minus-GUI-padding" : "full-GUI-rect") + "\",\"populated\":" + JsonBool(populated) + ",\"settings\":" + JsonUtility.ToJson(settings) + ",\"preferredWidth\":" + Invariant(preferredWidth) + ",\"rectExtents\":" + generatedRect + ",\"characters\":[" + string.Join(",", characters) + "],\"lines\":[" + string.Join(",", lines) + "],\"vertices\":[" + string.Join(",", vertices) + "],\"rawVertices\":[" + string.Join(",", rawVertices) + "]}");
            }
        }
        return "{\"fontSize\":" + size + ",\"text\":\"" + EscapeJson(text) + "\",\"index\":" + index + ",\"placementCursor\":0,\"fractionY\":" + Invariant(rect.y - Mathf.Floor(rect.y)) + ",\"frame\":" + Time.frameCount + ",\"fontName\":\"" + EscapeJson(style.font.name) + "\",\"fontAtlasTextureId\":" + style.font.material.mainTexture.GetInstanceID() + ",\"fontStyle\":\"" + style.fontStyle + "\",\"alignment\":\"" + style.alignment + "\",\"wordWrap\":" + JsonBool(style.wordWrap) + ",\"richText\":" + JsonBool(style.richText) + ",\"clipping\":\"" + style.clipping + "\",\"padding\":[" + style.padding.left + "," + style.padding.right + "," + style.padding.top + "," + style.padding.bottom + "],\"contentOffset\":" + V(style.contentOffset) + ",\"calcSize\":" + V(style.CalcSize(content)) + ",\"calcHeight\":" + Invariant(style.CalcHeight(content, rect.width)) + ",\"lineHeight\":" + Invariant(style.lineHeight) + ",\"rect\":[" + Invariant(rect.x) + "," + Invariant(rect.y) + "," + Invariant(rect.width) + "," + Invariant(rect.height) + "],\"cursorIndices\":[0,1," + text.Length + "],\"cursors\":[" + V(style.GetCursorPixelPosition(rect, content, 0)) + "," + V(style.GetCursorPixelPosition(rect, content, 1)) + "," + V(style.GetCursorPixelPosition(rect, content, text.Length)) + "],\"textGenerators\":[" + string.Join(",", generated) + "]}";
    }

    private IEnumerator RunTuiFontMetricsScenario(string requestId)
    {
        _busy = true;
        try
        {
            Screen.SetResolution(800, 600, FullScreenMode.Windowed);
            World.GoToLevel("text_1");
            int remaining = 600;
            while (remaining-- > 0 && (World.currentLevelName != "text_1" || World.State != World.WS.Playing || World.Transitioning)) yield return null;
            if (World.currentLevelName != "text_1" || World.State != World.WS.Playing || World.Transitioning) throw new InvalidOperationException("TUI font level load timed out");
            float deadline = Time.unscaledTime + 0.8f;
            while (Time.unscaledTime < deadline || World.PostInitializingT < World.initFadeLength) yield return null;
            TuiFontTracePatch.Samples.Clear(); TuiFontTracePatch.FontSizes.Clear(); TuiFontTracePatch.SourceStyle = null; TuiFontTracePatch.Active = true;
            yield return new WaitForEndOfFrame();
            if (TuiFontTracePatch.SourceStyle == null) throw new InvalidOperationException("No native FixedWidth DrawText was observed");
            Font font = TuiFontTracePatch.SourceStyle.font;
            var alphabet = new StringBuilder(); for (char c = ' '; c <= '~'; c++) alphabet.Append(c);
            var requestedSizes = new List<int>(TuiFontTracePatch.FontSizes); requestedSizes.Sort();
            foreach (int size in requestedSizes) font.RequestCharactersInTexture(alphabet.ToString(), size, FontStyle.Normal);
            yield return new WaitForEndOfFrame();
            TuiFontTracePatch.Active = false;
            string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId); Directory.CreateDirectory(directory);
            Texture2D screen = ScreenCapture.CaptureScreenshotAsTexture();
            try { File.WriteAllBytes(Path.Combine(directory, "screen.png"), screen.EncodeToPNG()); } finally { UnityEngine.Object.Destroy(screen); }
            Texture texture = font.material.mainTexture; RenderTexture previous = RenderTexture.active; bool previousSrgb = GL.sRGBWrite;
            RenderTexture target = RenderTexture.GetTemporary(texture.width, texture.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear);
            Texture2D atlas = new Texture2D(texture.width, texture.height, TextureFormat.RGBA32, false, true);
            try { GL.sRGBWrite = false; Graphics.Blit(texture, target); RenderTexture.active = target; atlas.ReadPixels(new Rect(0, 0, texture.width, texture.height), 0, 0, false); atlas.Apply(false, false); File.WriteAllBytes(Path.Combine(directory, "font-atlas.png"), atlas.EncodeToPNG()); }
            finally { RenderTexture.active = previous; GL.sRGBWrite = previousSrgb; RenderTexture.ReleaseTemporary(target); UnityEngine.Object.Destroy(atlas); }
            string V(Vector2 value) => "[" + Invariant(value.x) + "," + Invariant(value.y) + "]";
            string S(string value) => "\"" + EscapeJson(value ?? "") + "\"";
            var metrics = new List<string>(); var generated = new List<string>(); var faces = new List<string>();
            string initialized = UnityEngine.TextCore.LowLevel.FontEngine.InitializeFontEngine().ToString();
            foreach (int size in requestedSizes)
            {
                var glyphs = new List<string>();
                foreach (char c in alphabet.ToString())
                {
                    bool found = font.GetCharacterInfo(c, out CharacterInfo glyph, size, FontStyle.Normal);
                    glyphs.Add("{\"character\":" + S(c.ToString()) + ",\"found\":" + JsonBool(found) + ",\"advance\":" + glyph.advance + ",\"bounds\":[" + glyph.minX + "," + glyph.minY + "," + glyph.maxX + "," + glyph.maxY + "],\"uvBottomLeft\":" + V(glyph.uvBottomLeft) + ",\"uvBottomRight\":" + V(glyph.uvBottomRight) + ",\"uvTopLeft\":" + V(glyph.uvTopLeft) + ",\"uvTopRight\":" + V(glyph.uvTopRight) + "}");
                }
                metrics.Add("{\"fontSize\":" + size + ",\"glyphs\":[" + string.Join(",", glyphs) + "]}");
                foreach (string text in new[] { "M", ".", "#", "A", "@", "0", "i", "/", "=", "_", ":" }) generated.Add(GenerateTextMetric(font, size, text));
                string loaded = UnityEngine.TextCore.LowLevel.FontEngine.LoadFontFace(font, size).ToString();
                faces.Add("{\"fontSize\":" + size + ",\"loadResult\":" + S(loaded) + ",\"face\":" + JsonUtility.ToJson(UnityEngine.TextCore.LowLevel.FontEngine.GetFaceInfo()) + "}");
            }
            GUIStyle style = TuiFontTracePatch.SourceStyle;
            string sourceStyle = "{\"fontName\":" + S(style.font.name) + ",\"fontSize\":" + style.fontSize + ",\"fontStyle\":" + S(style.fontStyle.ToString()) + ",\"alignment\":" + S(style.alignment.ToString()) + ",\"lineHeight\":" + Invariant(style.lineHeight) + ",\"wordWrap\":" + JsonBool(style.wordWrap) + ",\"richText\":" + JsonBool(style.richText) + ",\"clipping\":" + S(style.clipping.ToString()) + ",\"padding\":[" + style.padding.left + "," + style.padding.right + "," + style.padding.top + "," + style.padding.bottom + "],\"contentOffset\":" + V(style.contentOffset) + "}";
            string metadata = "{\"requestId\":" + S(requestId) + ",\"levelName\":" + S(World.currentLevelName) + ",\"drawStyle\":" + S(Draw.DrawStyle.ToString()) + ",\"screenWidth\":" + Screen.width + ",\"screenHeight\":" + Screen.height + ",\"fontAssetName\":" + S(font.name) + ",\"fontNames\":[" + string.Join(",", Array.ConvertAll(font.fontNames, S)) + "],\"dynamic\":" + JsonBool(font.dynamic) + ",\"fontFontSize\":" + font.fontSize + ",\"fontAscent\":" + font.ascent + ",\"fontLineHeight\":" + font.lineHeight + ",\"sourceStyle\":" + sourceStyle + ",\"texture\":{\"width\":" + texture.width + ",\"height\":" + texture.height + ",\"filterMode\":" + S(texture.filterMode.ToString()) + ",\"wrapMode\":" + S(texture.wrapMode.ToString()) + ",\"shader\":" + S(font.material.shader.name) + "},\"characterRange\":\"ASCII U+0020..U+007E\",\"metrics\":[" + string.Join(",", metrics) + "],\"actualLabels\":[" + string.Join(",", TuiFontTracePatch.Samples) + "],\"textGeneratorMeasurements\":[" + string.Join(",", generated) + "],\"fontEngineInitializeResult\":" + S(initialized) + ",\"fontFaces\":[" + string.Join(",", faces) + "]}";
            metadata = metadata.Substring(0, metadata.Length - 1) + ",\"postInitializingT\":" + Invariant(World.PostInitializingT) + ",\"initFadeLength\":" + Invariant(World.initFadeLength) + ",\"startupFadeComplete\":" + JsonBool(World.PostInitializingT >= World.initFadeLength) + "}";
            File.WriteAllText(Path.Combine(directory, "tui-font-metrics.json"), metadata, new UTF8Encoding(false));
            File.WriteAllText(Path.Combine(directory, "state.json"), BuildSnapshot(requestId, new List<KeyValuePair<string, string>>()), new UTF8Encoding(false));
            WriteResult(metadata);
        }
        finally { TuiFontTracePatch.Active = false; _busy = false; }
    }

    private static string GenerateTextMetric(Font font, int size, string text)
    {
        using (var generator = new TextGenerator())
        {
            var settings = new TextGenerationSettings { font = font, fontSize = size, fontStyle = FontStyle.Normal, color = Color.white, lineSpacing = 1f, scaleFactor = 1f, textAnchor = TextAnchor.UpperLeft, generationExtents = new Vector2(600f, 600f), pivot = new Vector2(0f, 1f), horizontalOverflow = HorizontalWrapMode.Overflow, verticalOverflow = VerticalWrapMode.Overflow, richText = true, generateOutOfBounds = true };
            bool populated = generator.Populate(text, settings);
            var vertices = new List<string>(); foreach (UIVertex vertex in generator.verts) vertices.Add("[" + Invariant(vertex.position.x) + "," + Invariant(vertex.position.y) + "," + Invariant(vertex.position.z) + "]");
            var characters = new List<string>(); foreach (UICharInfo character in generator.characters) characters.Add(JsonUtility.ToJson(character));
            var lines = new List<string>(); foreach (UILineInfo line in generator.lines) lines.Add(JsonUtility.ToJson(line));
            float preferredWidth = generator.GetPreferredWidth(text, settings);
            return "{\"fontSize\":" + size + ",\"text\":\"" + EscapeJson(text) + "\",\"populated\":" + JsonBool(populated) + ",\"settings\":" + JsonUtility.ToJson(settings) + ",\"preferredWidth\":" + Invariant(preferredWidth) + ",\"rectExtents\":" + JsonUtility.ToJson(generator.rectExtents) + ",\"characters\":[" + string.Join(",", characters) + "],\"lines\":[" + string.Join(",", lines) + "],\"vertices\":[" + string.Join(",", vertices) + "]}";
        }
    }

    private void RunFontFaceMetricsScenario(string requestId)
    {
        _busy = true;
        try
        {
            var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;
            object draw = typeof(Draw).GetField("instance", flags).GetValue(null);
            Font font = (Font)typeof(Draw).GetField("MainFont", flags).GetValue(draw);
            string init = UnityEngine.TextCore.LowLevel.FontEngine.InitializeFontEngine().ToString();
            var rows = new List<string>();
            foreach (int size in new[] { 12, 16, 20 })
            {
                string load = UnityEngine.TextCore.LowLevel.FontEngine.LoadFontFace(font, size).ToString();
                string face = JsonUtility.ToJson(UnityEngine.TextCore.LowLevel.FontEngine.GetFaceInfo());
                using (var generator = new TextGenerator())
                {
                    var settings = new TextGenerationSettings { font = font, fontSize = size, fontStyle = FontStyle.Normal, color = Color.white, lineSpacing = 1f, scaleFactor = 1f, textAnchor = TextAnchor.UpperLeft, generationExtents = new Vector2(600f, 600f), pivot = new Vector2(0f, 1f), horizontalOverflow = HorizontalWrapMode.Overflow, verticalOverflow = VerticalWrapMode.Overflow, richText = true, generateOutOfBounds = true };
                    bool populated = generator.Populate("\nMove", settings);
                    var vertices = new List<string>(); foreach (UIVertex vertex in generator.verts) vertices.Add("[" + Invariant(vertex.position.x) + "," + Invariant(vertex.position.y) + "," + Invariant(vertex.position.z) + "]");
                    var characters = new List<string>(); foreach (UICharInfo character in generator.characters) characters.Add(JsonUtility.ToJson(character));
                    var lines = new List<string>(); foreach (UILineInfo line in generator.lines) lines.Add(JsonUtility.ToJson(line));
                    rows.Add("{\"size\":" + size + ",\"loadResult\":\"" + load + "\",\"face\":" + face + ",\"textGenerator\":{\"populated\":" + JsonBool(populated) + ",\"settings\":" + JsonUtility.ToJson(settings) + ",\"rectExtents\":" + JsonUtility.ToJson(generator.rectExtents) + ",\"characters\":[" + string.Join(",", characters) + "],\"lines\":[" + string.Join(",", lines) + "],\"vertices\":[" + string.Join(",", vertices) + "]}}");
                }
            }
            string metadata = "{\"requestId\":\"" + EscapeJson(requestId) + "\",\"font\":\"" + EscapeJson(font.name) + "\",\"fontFontSize\":" + font.fontSize + ",\"fontAscent\":" + font.ascent + ",\"fontLineHeight\":" + font.lineHeight + ",\"initializeResult\":\"" + init + "\",\"measurements\":[" + string.Join(",", rows) + "]}";
            string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId); Directory.CreateDirectory(directory);
            File.WriteAllText(Path.Combine(directory, "font-face-metrics.json"), metadata, new UTF8Encoding(false));
            WriteResult(metadata);
        }
        finally { _busy = false; }
    }

    private IEnumerator RunFontMetricsScenario(string requestId, int requestedWidth = 0, int requestedHeight = 0)
    {
        _busy = true;
        if (requestedWidth > 0 && requestedHeight > 0)
        {
            Screen.SetResolution(requestedWidth, requestedHeight, FullScreenMode.Windowed);
            yield return new WaitForSecondsRealtime(0.5f);
            if (Screen.width != requestedWidth || Screen.height != requestedHeight) throw new InvalidOperationException("Requested font capture viewport was not applied");
        }
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;
        object draw = typeof(Draw).GetField("instance", flags).GetValue(null);
        Font font = (Font)typeof(Draw).GetField("MainFont", flags).GetValue(draw);
        var alphabet = new StringBuilder();
        for (char character = ' '; character <= '~'; character++) alphabet.Append(character);
        string glyphCharacters = alphabet.ToString();
        foreach (int size in new[] { 12, 16, 20 }) font.RequestCharactersInTexture(glyphCharacters, size, FontStyle.Normal);
        yield return new WaitForEndOfFrame();
        GUIStyle sourceStyle = (GUIStyle)typeof(Draw).GetField("textguiStyle", flags).GetValue(null);
        string directory = Path.Combine(Paths.BepInExRootPath, "parity-captures", requestId);
        Directory.CreateDirectory(directory);
        string V(Vector2 value) => "[" + Invariant(value.x) + "," + Invariant(value.y) + "]";
        string S(string value) => "\"" + EscapeJson(value ?? "") + "\"";
        var metrics = new List<string>();
        foreach (int size in new[] { 12, 16, 20 })
        {
            GUIStyle style = new GUIStyle(sourceStyle) { font = font, fontSize = size, fontStyle = FontStyle.Normal };
            var glyphs = new List<string>();
            foreach (char character in glyphCharacters)
            {
                bool found = font.GetCharacterInfo(character, out CharacterInfo glyph, size, FontStyle.Normal);
                object flipped = typeof(CharacterInfo).GetProperty("flipped")?.GetValue(glyph) ?? typeof(CharacterInfo).GetField("flipped")?.GetValue(glyph);
                glyphs.Add("{\"character\":" + S(character.ToString()) + ",\"found\":" + JsonBool(found) + ",\"advance\":" + glyph.advance + ",\"bounds\":[" + glyph.minX + "," + glyph.minY + "," + glyph.maxX + "," + glyph.maxY + "],\"glyphWidth\":" + glyph.glyphWidth + ",\"glyphHeight\":" + glyph.glyphHeight + ",\"bearing\":" + glyph.bearing + ",\"uvBottomLeft\":" + V(glyph.uvBottomLeft) + ",\"uvBottomRight\":" + V(glyph.uvBottomRight) + ",\"uvTopLeft\":" + V(glyph.uvTopLeft) + ",\"uvTopRight\":" + V(glyph.uvTopRight) + ",\"flipped\":" + (flipped == null ? "null" : JsonBool((bool)flipped)) + "}");
            }
            metrics.Add("{\"fontSize\":" + size + ",\"fontStyle\":" + S(style.fontStyle.ToString()) + ",\"alignment\":" + S(style.alignment.ToString()) + ",\"lineHeight\":" + Invariant(style.lineHeight) + ",\"calcSize\":" + V(style.CalcSize(new GUIContent("Move"))) + ",\"calcHeight1000\":" + Invariant(style.CalcHeight(new GUIContent("Move"), 1000f)) + ",\"glyphs\":[" + string.Join(",", glyphs) + "]}");
        }
        Texture source = font.material.mainTexture;
        RenderTexture previous = RenderTexture.active;
        bool previousSrgbWrite = GL.sRGBWrite;
        RenderTexture target = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear);
        Texture2D readback = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false, true);
        try
        {
            GL.sRGBWrite = false; Graphics.Blit(source, target); RenderTexture.active = target;
            readback.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0, false); readback.Apply(false, false);
            File.WriteAllBytes(Path.Combine(directory, "font-atlas.png"), readback.EncodeToPNG());
        }
        finally
        {
            RenderTexture.active = previous; GL.sRGBWrite = previousSrgbWrite;
            RenderTexture.ReleaseTemporary(target); UnityEngine.Object.Destroy(readback);
        }
        string metadata = "{\"requestId\":" + S(requestId) + ",\"levelName\":" + S(World.currentLevelName) + ",\"fontAssetName\":" + S(font.name) + ",\"fontNames\":[" + string.Join(",", Array.ConvertAll(font.fontNames, S)) + "],\"dynamic\":" + JsonBool(font.dynamic) + ",\"fontFontSize\":" + font.fontSize + ",\"fontAscent\":" + font.ascent + ",\"fontLineHeight\":" + font.lineHeight + ",\"sourceStyle\":{\"fontName\":" + S(sourceStyle.font.name) + ",\"fontSize\":" + sourceStyle.fontSize + ",\"fontStyle\":" + S(sourceStyle.fontStyle.ToString()) + ",\"alignment\":" + S(sourceStyle.alignment.ToString()) + ",\"wordWrap\":" + JsonBool(sourceStyle.wordWrap) + ",\"richText\":" + JsonBool(sourceStyle.richText) + ",\"clipping\":" + S(sourceStyle.clipping.ToString()) + ",\"padding\":[" + sourceStyle.padding.left + "," + sourceStyle.padding.right + "," + sourceStyle.padding.top + "," + sourceStyle.padding.bottom + "],\"contentOffset\":" + V(sourceStyle.contentOffset) + "},\"lastMoveDraw\":{\"fontSize\":" + FontTextPatch.MoveFontSize + ",\"alignment\":" + S(FontTextPatch.MoveAlignment.ToString()) + ",\"font\":" + S(FontTextPatch.MoveFont.ToString()) + "},\"texture\":{\"file\":\"font-atlas.png\",\"name\":" + S(source.name) + ",\"width\":" + source.width + ",\"height\":" + source.height + ",\"filterMode\":" + S(source.filterMode.ToString()) + ",\"wrapMode\":" + S(source.wrapMode.ToString()) + ",\"shader\":" + S(font.material.shader.name) + "},\"metrics\":[" + string.Join(",", metrics) + "]}";
        var captions = new List<string>();
        foreach (int size in new[] { 12, 16, 20 })
        {
            GUIStyle style = new GUIStyle(sourceStyle) { font = font, fontSize = size, fontStyle = FontStyle.Normal };
            GUIContent caption = new GUIContent("\nMove");
            string C(Rect rect) => "[" + V(style.GetCursorPixelPosition(rect, caption, 0)) + "," + V(style.GetCursorPixelPosition(rect, caption, 1)) + "," + V(style.GetCursorPixelPosition(rect, caption, 5)) + "]";
            captions.Add("{\"fontSize\":" + size + ",\"calcSize\":" + V(style.CalcSize(caption)) + ",\"calcHeight600\":" + Invariant(style.CalcHeight(caption, 600f)) + ",\"fontAscent\":" + font.ascent + ",\"fontLineHeight\":" + font.lineHeight + ",\"styleLineHeight\":" + Invariant(style.lineHeight) + ",\"cursorIndices\":[0,1,5],\"cursorActualRect\":" + C(FontTextPatch.MoveRect) + ",\"cursorCentered600Rect\":" + C(new Rect(-300f, -300f, 600f, 600f)) + "}");
        }
        metadata = metadata.Substring(0, metadata.Length - 1) + ",\"actualMoveText\":" + S(FontTextPatch.MoveText) + ",\"actualMoveRect\":[" + Invariant(FontTextPatch.MoveRect.x) + "," + Invariant(FontTextPatch.MoveRect.y) + "," + Invariant(FontTextPatch.MoveRect.width) + "," + Invariant(FontTextPatch.MoveRect.height) + "],\"captionMeasurements\":[" + string.Join(",", captions) + "]}";
        metadata = metadata.Substring(0, metadata.Length - 1) + ",\"characterRange\":\"ASCII U+0020..U+007E\",\"charactersPerSize\":95}";
        Texture2D screen = ScreenCapture.CaptureScreenshotAsTexture();
        try { File.WriteAllBytes(Path.Combine(directory, "screen.png"), screen.EncodeToPNG()); }
        finally { UnityEngine.Object.Destroy(screen); }
        metadata = metadata.Substring(0, metadata.Length - 1) + ",\"screenWidth\":" + Screen.width + ",\"screenHeight\":" + Screen.height + ",\"screenshot\":\"screen.png\",\"controls\":[" + string.Join(",", ControlGeometryPatch.Samples.Values) + "]}";
        File.WriteAllText(Path.Combine(directory, "font-metrics.json"), metadata, new UTF8Encoding(false));
        WriteResult(metadata);
        Logger.LogInfo("Parity font metrics complete: " + directory);
        _busy = false;
    }

    private static string FileHash(string path)
    {
        if (!File.Exists(path)) return "absent";
        using (SHA256 sha = SHA256.Create())
            return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant();
    }

    private IEnumerator RunIsolatedMotionCaptureScenario(string requestId, string levelName, IReadOnlyList<string> commands, ScenarioOptions options)
    {
        SaveFile.SaveData previousSave = SaveFile.Current;
        string savePath = (string)typeof(SaveFile).GetMethod("GetSaveFilePath", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic).Invoke(null, new object[] { SaveFile.Slot });
        string beforeHash = FileHash(savePath);
        CaptureSaveGuard.Suppress = true;
        CaptureSaveGuard.SuppressedCalls = 0;
        CaptureSaveGuard.PendingResult = null;
        SaveFile.Current = new SaveFile.SaveData();
        if (options.HasSaveOverride)
        {
            SaveFile.Current.NexusUnlocked = options.NexusUnlocked;
            SaveFile.Current.RecentArea = options.RecentArea;
            foreach (string wonLevel in options.WonLevels)
            {
                SaveFile.Current.LevelWon[wonLevel] = true;
                SaveFile.Current.LevelAttempted[wonLevel] = true;
            }
            World.RecentPuzzle = null;
            World.UnlockAllRepositionAreaName = null;
            World.TransitionXPosOffset = 0;
            World.TransitionYPosOffset = -1;
            World.levelsNewlyWon = 0;
            World.hubLoaded = false;
        }
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
