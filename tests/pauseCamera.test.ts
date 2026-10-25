import { describe, expect, it } from "vitest";
import { PauseCamera, getPauseFocusFraction, pauseCameraWeight } from "../src/core/pauseCamera";
import {WorldModel} from '../src/core/model';
import {resetCameraOffset, setCameraOffset} from '../src/core/animation';
import native from "../docs/parity/evidence/original/hub-leave-controls-camera-native-derived.json";

const view = { width: 800, height: 600, paused: true };
const resume = { cameraMoving: false, quickAnim: false, cameraMode: "synced" as const };
const playing = { ...view, paused: false };

describe("source-derived desktop pause camera", () => {
  it('clears unpause only for a nonidentity ordinary offset or applicable reset', () => {
    const world = new WorldModel('first_puzzle');
    const camera = world.pauseCamera; camera.enterPause(1); camera.sample(view);
    camera.startUnpause(resume);
    setCameraOffset(world, 0, 0, 1, 1, .1, false);
    expect(camera.snapshot().cameraUnpause).toBe(true);
    setCameraOffset(world, 1, 0, 1, 1, .1, false);
    expect(camera.snapshot().cameraUnpause).toBe(false);
    camera.startUnpause(resume); resetCameraOffset(world);
    expect(camera.snapshot().cameraUnpause).toBe(false);
    camera.startUnpause(resume); world.cameraTitle = true; resetCameraOffset(world);
    expect(camera.snapshot().cameraUnpause).toBe(true);
  });
  it("retains all float32 QuadOut stages rather than replacing them with a fitted curve", () => {
    expect(pauseCameraWeight(0)).toBe(0);
    expect(pauseCameraWeight(0.0166667)).toBe(0.12580972909927368);
    expect(pauseCameraWeight(0.1)).toBe(0.5695328116416931);
    expect(pauseCameraWeight(0.25)).toBe(0.8998870849609375);
    expect(pauseCameraWeight(0.5)).toBe(0.99609375);
    expect(pauseCameraWeight(0.75, true)).toBe(0.0000152587890625);
    expect(pauseCameraWeight(1, true)).toBe(0);
  });

  it("uses source aspect endpoints, clamps and float32 interpolation", () => {
    expect(getPauseFocusFraction(1280, 720)).toBe(0.6000000238418579);
    expect(getPauseFocusFraction(1920, 600)).toBe(0.6000000238418579);
    expect(getPauseFocusFraction(800, 600)).toBe(0.44857144355773926);
    expect(getPauseFocusFraction(1001, 733)).toBe(0.4595721960067749);
    expect(getPauseFocusFraction(600, 600)).toBe(0.33500000834465027);
    expect(getPauseFocusFraction(400, 800)).toBe(0.33500000834465027);
  });

  it("increments once on entry, once per paused update, and clamps long frames", () => {
    const camera = new PauseCamera();
    expect(camera.snapshot()).toEqual({ zoomT: 0, controlsZoomT: 0, cameraUnpause: false, cameraUnpauseIgnoreOneDelta: false, cameraUnpauseLastY: 0 });
    camera.enterPause(0.1);
    expect(camera.snapshot().zoomT).toBe(0.10000000149011612);
    camera.tick(0.1, { paused: true });
    expect(camera.snapshot().zoomT).toBe(0.20000000298023224);
    camera.tick(3, { paused: true });
    expect(camera.snapshot().zoomT).toBe(1);
    const sample = camera.sample(view)!;
    expect(sample).toEqual({ pauseWeight: 1, focusFraction: 0.44857144355773926, size: 269.1428527832031, centerX: 400, centerY: 300, controlsOffset: 0 });
    expect(camera.snapshot().cameraUnpauseLastY).toBe(1);
  });

  it("reverses from last rendered Y even when an update has since advanced zoomT", () => {
    const camera = new PauseCamera();
    camera.enterPause(0.25);
    const paused = camera.sample(view)!;
    camera.tick(0.1, { paused: true }); // No draw: native lastY is still the prior render.
    expect(camera.startUnpause(resume)).toBe(true);
    expect(camera.snapshot().zoomT).toBe(0.013099193572998047);
    expect(camera.sample(playing)!.pauseWeight).toBe(paused.pauseWeight);
    camera.tick(0.1, { paused: false });
    expect(camera.snapshot().zoomT).toBe(0.21309919655323029);
    expect(camera.sample(playing)!.pauseWeight).toBe(0.14701443910598755);
    camera.enterPause(0.0166667);
    expect(camera.snapshot().zoomT).toBe(0.03634702041745186);
    expect(camera.snapshot().cameraUnpause).toBe(false);
  });

  it("Leave consumes one eligible unpaused camera delta, including a long one", () => {
    const camera = new PauseCamera();
    camera.enterPause(1); camera.sample(view);
    camera.startUnpause({ ...resume, leavingPuzzle: true });
    camera.tick(10, { paused: false, updateCamera: false });
    expect(camera.snapshot().cameraUnpauseIgnoreOneDelta).toBe(true);
    camera.tick(10, { paused: false });
    expect(camera.snapshot().zoomT).toBe(0);
    expect(camera.snapshot().cameraUnpauseIgnoreOneDelta).toBe(false);
    camera.tick(0.25, { paused: false });
    expect(camera.snapshot().zoomT).toBe(0.5);
    expect(camera.sample(playing)!.pauseWeight).toBe(0.00390625);
    camera.tick(10, { paused: false });
    expect(camera.snapshot().zoomT).toBe(1);
    expect(camera.snapshot().cameraUnpause).toBe(true);
    expect(camera.sample(playing)!.size).toBe(492);
  });

  it("Resume immediately advances by 2dt at the next eligible camera update", () => {
    const camera = new PauseCamera();
    camera.enterPause(1); camera.sample(view); camera.startUnpause(resume);
    camera.tick(0.125, { paused: false });
    expect(camera.snapshot().zoomT).toBe(0.25);
    expect(camera.sample(playing)!.pauseWeight).toBe(0.1001129150390625);
  });

  it("retains exact start guards and allows interruption while cameraMoving", () => {
    const camera = new PauseCamera();
    const initial = camera.snapshot();
    for (const options of [{ ...resume, cameraMoving: true }, { ...resume, quickAnim: true }, { ...resume, cameraMode: "title" as const }]) {
      expect(camera.startUnpause(options)).toBe(false);
      expect(camera.snapshot()).toEqual(initial);
    }
    camera.enterPause(1); camera.sample(view); camera.startUnpause(resume);
    expect(camera.startUnpause({ ...resume, cameraMoving: true })).toBe(true);
    // SetCameraUnpause excludes Title but not PerpetualZoomOut. Rendering is separate.
    expect(camera.startUnpause({ ...resume, cameraMode: "perpetualZoomOut" })).toBe(true);
    const beforeDraw = camera.snapshot();
    expect(camera.sample({ ...playing, cameraMode: "perpetualZoomOut" })).toBeNull();
    expect(camera.sample({ ...playing, quickAnim: true })).toBeNull();
    expect(camera.sample({ ...playing, overrideCamera: true })).toBeNull();
    expect(camera.sample({ ...playing, playing: false })).toBeNull();
    expect(camera.snapshot()).toEqual(beforeDraw);
  });

  it("clears only the native unpause flag on an applied camera offset/reset", () => {
    const camera = new PauseCamera();
    camera.enterPause(1); camera.sample(view);
    camera.startUnpause({ ...resume, leavingPuzzle: true });
    camera.clearCameraUnpause();
    expect(camera.snapshot()).toEqual({ zoomT: 0, controlsZoomT: 0, cameraUnpause: false, cameraUnpauseIgnoreOneDelta: true, cameraUnpauseLastY: 1 });
    expect(camera.sample(playing)).toBeNull();
    camera.tick(5, { paused: false });
    expect(camera.snapshot().cameraUnpauseIgnoreOneDelta).toBe(true);
    camera.startUnpause(resume); camera.tick(5, { paused: false });
    expect(camera.snapshot().zoomT).toBe(0);
    expect(camera.snapshot().cameraUnpauseIgnoreOneDelta).toBe(false);
  });

  it("animates desktop controls offset at 2dt and clears its visible offset on Resume", () => {
    const camera = new PauseCamera();
    camera.enterPause(1);
    camera.tick(0.125, { paused: true, controlsExpanded: true });
    expect(camera.snapshot().controlsZoomT).toBe(0.25);
    expect(camera.sample(view)!.controlsOffset).toBe(-18.75);
    expect(camera.sample(view)!.centerX).toBe(381.25);
    camera.tick(0.125, { paused: true, controlsExpanded: true });
    expect(camera.sample(view)!.controlsOffset).toBe(-75);
    camera.startUnpause(resume);
    expect(camera.sample(playing)!.controlsOffset).toBe(0);
    camera.enterPause(0);
    expect(camera.snapshot().controlsZoomT).toBe(0);
    camera.tick(10, { paused: true, controlsExpanded: true });
    expect(camera.sample(view)!.controlsOffset).toBe(-150);
    camera.tick(10, { paused: true, controlsExpanded: false });
    expect(camera.snapshot().controlsZoomT).toBe(0);
  });

  it("uses integer screen center and double CamZoomFactor composition", () => {
    const camera = new PauseCamera(); camera.enterPause(1);
    const odd = camera.sample({ ...view, width: 1001, height: 733 })!;
    expect([odd.centerX, odd.centerY, odd.size]).toEqual([500, 366, 336.8664245605469]);
    expect(camera.sample({ ...view, camZoomFactor: 0.9 })!.size).toBe(269.1428527832031 * Math.fround(0.9));
    expect(camera.sample({ ...view, normalFocusFraction: 0.6 })!.focusFraction).toBe(0.44857144355773926);
  });

  it("corroborates Leave's equal first raster then growth without fitting private flags", () => {
    expect(native.captures).toHaveLength(3);
    for (const capture of native.captures) {
      const [load, first, next] = capture.cameraRaster;
      expect(load!.bluePixelBounds).toEqual([268, 168, 531, 431]);
      expect(first!.bluePixelBounds).toEqual(load!.bluePixelBounds);
      expect(next!.bluePixelWidth).toBeGreaterThan(first!.bluePixelWidth);
      const camera = new PauseCamera();
      camera.enterPause(1); camera.sample(view);
      camera.startUnpause({ ...resume, leavingPuzzle: true });
      const before = camera.sample(playing)!.size;
      camera.tick(first!.nativeDeltaMs / 1000, { paused: false });
      expect(camera.sample(playing)!.size).toBe(before);
      camera.tick(next!.nativeDeltaMs / 1000, { paused: false });
      expect(camera.sample(playing)!.size).toBeGreaterThan(before);
      // Ink263 is not native blockWidth; no equality or pixel tolerance is asserted.
    }
  });

  it("returns detached snapshots and rejects invalid caller deltas", () => {
    const camera = new PauseCamera(); const initial = camera.snapshot();
    camera.enterPause(0.1);
    expect(initial.zoomT).toBe(0);
    for (const delta of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => camera.tick(delta, { paused: false })).toThrow(RangeError);
      expect(() => camera.enterPause(delta)).toThrow(RangeError);
    }
  });
});
