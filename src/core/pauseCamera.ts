/** Bounded desktop pause camera port. No world, rendering or clock dependencies. */
export type PauseCameraMode = "normal" | "synced" | "gradual" | "specificBlock" | "title" | "perpetualZoomOut";

export interface PauseCameraSnapshot {
  readonly zoomT: number;
  readonly controlsZoomT: number;
  readonly cameraUnpause: boolean;
  readonly cameraUnpauseIgnoreOneDelta: boolean;
  /** Draw.cs:1915, updated only when the ordinary pause branch is rendered. */
  readonly cameraUnpauseLastY: number;
}

export interface StartUnpauseOptions {
  readonly cameraMoving: boolean;
  readonly quickAnim: boolean;
  readonly cameraMode: PauseCameraMode;
  readonly leavingPuzzle?: boolean;
}

export interface PauseCameraTickOptions {
  /** State at update dispatch, before a Resume/Leave menu action changes it. */
  readonly paused: boolean;
  /** Draw.Update(false) must not consume an unpause delta. Defaults to !paused. */
  readonly updateCamera?: boolean;
  /** PauseMenu.LangExpandMenu(); includes controls screens in English. */
  readonly controlsExpanded?: boolean;
}

export interface PauseCameraSampleOptions {
  /** Physical integer framebuffer dimensions, not CSS dimensions. */
  readonly width: number;
  readonly height: number;
  readonly paused: boolean;
  readonly playing?: boolean;
  readonly quickAnim?: boolean;
  readonly cameraMode?: PauseCameraMode;
  readonly normalFocusFraction?: number;
  readonly camZoomFactor?: number;
  /** Earlier Draw branches (trailer, Credits, TitleT<1) take precedence. */
  readonly overrideCamera?: boolean;
}

export interface PauseCameraSample {
  readonly pauseWeight: number;
  readonly focusFraction: number;
  /** Native float min(screen)*focus, followed by double CamZoomFactor product. */
  readonly size: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly controlsOffset: number;
}

const f32 = Math.fround;
const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v;

function lerp32(a: number, b: number, t: number): number {
  return f32(f32(a) + f32(f32(f32(b) - f32(a)) * clamp01(t)));
}

/** Util.QuadOut with float operations retained, rather than pow(1-t,8). */
export function pauseCameraWeight(zoomT: number, unpausing = false): number {
  let k = f32(zoomT);
  for (let i = 0; i < 3; i++) k = f32(k * f32(2 - k));
  return unpausing ? f32(1 - k) : k;
}

function quadInOut32(value: number): number {
  let k = f32(value * 2);
  if (k < 1) return f32(f32(0.5 * k) * k);
  k = f32(k - 1);
  return f32(-0.5 * f32(f32(k * f32(k - 2)) - 1));
}

/** Draw.GetFocusFractPause, desktop branch (Draw.cs:2591-2602). */
export function getPauseFocusFraction(width: number, height: number): number {
  const aspect = f32(f32(width) / f32(height));
  const from = f32(1.7777778);
  const t = clamp01(f32(f32(aspect - from) / f32(1 - from)));
  return lerp32(f32(0.6), f32(0.335), t);
}

function delta32(deltaTime: number): number {
  if (!Number.isFinite(deltaTime) || deltaTime < 0) {
    throw new RangeError("Pause camera delta must be finite and nonnegative");
  }
  return f32(deltaTime);
}

/**
 * Source globals grouped into an isolated deterministic state machine.
 * sample() represents Draw and records its last rendered Y for interruptions.
 * Timing/flags are source-derived, not newly measured native private fields.
 */
export class PauseCamera {
  private zoomT = 0;
  private controlsZoomT = 0;
  private cameraUnpause = false;
  private cameraUnpauseIgnoreOneDelta = false;
  private cameraUnpauseLastY = 0;

  snapshot(): PauseCameraSnapshot {
    return {
      zoomT: this.zoomT, controlsZoomT: this.controlsZoomT,
      cameraUnpause: this.cameraUnpause,
      cameraUnpauseIgnoreOneDelta: this.cameraUnpauseIgnoreOneDelta,
      cameraUnpauseLastY: this.cameraUnpauseLastY,
    };
  }

  /** World.cs:1013-1020: includes this entering frame's one pause increment. */
  enterPause(deltaTime: number): void {
    const dt = delta32(deltaTime);
    this.zoomT = 0;
    if (this.cameraUnpause) {
      this.zoomT = f32(1 - f32(Math.pow(f32(1 - this.cameraUnpauseLastY), 0.125)));
      this.cameraUnpause = false;
    }
    this.zoomT = Math.min(1, f32(this.zoomT + dt));
    this.controlsZoomT = 0;
  }

  /** World.SetCameraUnpause. A rejected guard leaves every field untouched. */
  startUnpause(options: StartUnpauseOptions): boolean {
    if ((options.cameraMoving && !this.cameraUnpause) || options.quickAnim || options.cameraMode === "title") return false;
    this.cameraUnpause = true;
    this.zoomT = f32(1 - f32(Math.pow(this.cameraUnpauseLastY, 0.125)));
    if (options.leavingPuzzle) this.cameraUnpauseIgnoreOneDelta = true;
    return true;
  }

  tick(deltaTime: number, options: PauseCameraTickOptions): void {
    const dt = delta32(deltaTime);
    if (options.paused) {
      this.zoomT = Math.min(1, f32(this.zoomT + dt));
      const step = f32(dt * 2);
      this.controlsZoomT = clamp01(f32(this.controlsZoomT + (options.controlsExpanded ? step : -step)));
    }
    if (!(options.updateCamera ?? !options.paused) || !this.cameraUnpause) return;
    if (this.cameraUnpauseIgnoreOneDelta) {
      this.cameraUnpauseIgnoreOneDelta = false;
      return;
    }
    this.zoomT = Math.min(1, f32(this.zoomT + f32(dt * 2)));
    // Draw.cs:1155-1159 clamps zoomT but deliberately retains cameraUnpause.
  }

  /** Call only when a native-equivalent CamOffset/QuickAnimCamOff/Reset applies. */
  clearCameraUnpause(): void {
    this.cameraUnpause = false;
    // Native clears neither the pending skip nor last rendered Y here.
  }

  /** Ordinary desktop Draw.cs:1905-1928; special camera branches return null. */
  sample(options: PauseCameraSampleOptions): PauseCameraSample | null {
    if (options.overrideCamera || options.quickAnim || options.cameraMode === "perpetualZoomOut" ||
      !(options.paused || (this.cameraUnpause && (options.playing ?? true)))) return null;
    const weight = pauseCameraWeight(this.zoomT, this.cameraUnpause);
    this.cameraUnpauseLastY = weight;
    const focus = lerp32(options.normalFocusFraction ?? f32(0.82), getPauseFocusFraction(options.width, options.height), weight);
    const size = f32(f32(Math.min(options.width, options.height)) * focus) * f32(options.camZoomFactor ?? 1);
    const offset = options.paused ? lerp32(0, f32(f32(-options.height) * 0.25), quadInOut32(this.controlsZoomT)) : 0;
    return {
      pauseWeight: weight, focusFraction: focus, size,
      centerX: Math.trunc(options.width / 2) + offset,
      centerY: Math.trunc(options.height / 2), controlsOffset: offset,
    };
  }
}
