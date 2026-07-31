export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SettingsSnapshot {
  readonly version: 1;
  readonly musicVolume: number;
  readonly soundVolume: number;
  readonly grid: boolean;
  readonly leftHanded: boolean;
  readonly enterSpeedIndex: number;
  /** 501 is the original UI's "Off" value. */
  readonly moveDelay: number;
  readonly allowSkippingAnimation: boolean;
  readonly instantZoom: boolean;
  readonly disableParticles: boolean;
  readonly fullscreen: boolean;
  readonly vsync: boolean;
  readonly language: string;
}

export const settingsStorageKey = "parabox-web-settings-v1";

export const enterSpeedNames = ["1x", "1.5x", "2x", "0.66x"] as const;

/** The original menu orders the underlying indices as 0.66x, 1x, 1.5x, 2x. */
export const enterSpeedUiOptions = [3, 0, 1, 2] as const;

export const defaultSettings: SettingsSnapshot = {
  version: 1,
  musicVolume: 85,
  soundVolume: 85,
  grid: false,
  leftHanded: false,
  enterSpeedIndex: 0,
  moveDelay: 70,
  allowSkippingAnimation: false,
  instantZoom: false,
  disableParticles: false,
  fullscreen: true,
  vsync: true,
  language: "Default",
};

type MutableSettings = {
  -readonly [Key in keyof SettingsSnapshot]: SettingsSnapshot[Key];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampInt(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSettings(value: unknown): SettingsSnapshot {
  const source = isRecord(value) ? value : {};
  const language =
    typeof source.language === "string" && source.language.length > 0
      ? source.language
      : defaultSettings.language;
  return {
    version: 1,
    musicVolume: clampInt(
      source.musicVolume,
      0,
      100,
      defaultSettings.musicVolume,
    ),
    soundVolume: clampInt(
      source.soundVolume,
      0,
      100,
      defaultSettings.soundVolume,
    ),
    grid: bool(source.grid, defaultSettings.grid),
    leftHanded: bool(source.leftHanded, defaultSettings.leftHanded),
    enterSpeedIndex: clampInt(
      source.enterSpeedIndex,
      0,
      enterSpeedNames.length - 1,
      defaultSettings.enterSpeedIndex,
    ),
    moveDelay: clampInt(
      source.moveDelay,
      0,
      501,
      defaultSettings.moveDelay,
    ),
    allowSkippingAnimation: bool(
      source.allowSkippingAnimation,
      defaultSettings.allowSkippingAnimation,
    ),
    instantZoom: bool(source.instantZoom, defaultSettings.instantZoom),
    disableParticles: bool(
      source.disableParticles,
      defaultSettings.disableParticles,
    ),
    fullscreen: bool(source.fullscreen, defaultSettings.fullscreen),
    vsync: bool(source.vsync, defaultSettings.vsync),
    language,
  };
}

export function nextMoveDelay(current: number, delta: -1 | 1): number {
  let amount = delta * 10;
  if (
    (delta === 1 && current >= 200) ||
    (delta === -1 && current >= 250)
  ) {
    amount = delta * 50;
  }
  if (delta === 1 && current === 500) amount = 1;
  if (delta === -1 && current > 500) amount = 500 - current;
  return Math.max(0, Math.min(501, current + amount));
}

export function nextEnterSpeedIndex(
  current: number,
  delta: -1 | 1,
): number {
  const currentUiIndex = Math.max(
    0,
    enterSpeedUiOptions.indexOf(
      current as (typeof enterSpeedUiOptions)[number],
    ),
  );
  const nextUiIndex = Math.max(
    0,
    Math.min(enterSpeedUiOptions.length - 1, currentUiIndex + delta),
  );
  return enterSpeedUiOptions[nextUiIndex] ?? 0;
}

export function formatMoveDelay(moveDelay: number): string {
  return moveDelay > 500 ? "Off" : `${Math.max(0, Math.trunc(moveDelay))} ms`;
}

export function enterSpeedName(index: number): string {
  return enterSpeedNames[
    Math.max(0, Math.min(enterSpeedNames.length - 1, Math.trunc(index)))
  ] ?? enterSpeedNames[0];
}

/**
 * Browser-independent preference state. The controller owns when a setting
 * is applied to rendering or input; this class only normalizes and persists
 * the values exactly once per mutation.
 */
export class SettingsModel {
  private readonly storage: SettingsStorage;
  private state: SettingsSnapshot;

  constructor(storage: SettingsStorage) {
    this.storage = storage;
    this.state = this.readState();
  }

  snapshot(): SettingsSnapshot {
    return { ...this.state };
  }

  replace(snapshot: SettingsSnapshot): boolean {
    const next = normalizeSettings(snapshot);
    if (JSON.stringify(next) === JSON.stringify(this.state)) return false;
    this.state = next;
    this.writeState();
    return true;
  }

  reset(): void {
    this.state = { ...defaultSettings };
    this.writeState();
  }

  setMusicVolume(value: number): boolean {
    return this.update({
      musicVolume: clampInt(value, 0, 100, this.state.musicVolume),
    });
  }

  setSoundVolume(value: number): boolean {
    return this.update({
      soundVolume: clampInt(value, 0, 100, this.state.soundVolume),
    });
  }

  adjustVolume(kind: "musicVolume" | "soundVolume", delta: -1 | 1): boolean {
    const current = this.state[kind];
    return this.update({
      [kind]: Math.max(0, Math.min(100, current + delta * 5)),
    });
  }

  toggle(
    kind:
      | "grid"
      | "leftHanded"
      | "allowSkippingAnimation"
      | "instantZoom"
      | "disableParticles"
      | "fullscreen"
      | "vsync",
  ): boolean {
    return this.update({ [kind]: !this.state[kind] });
  }

  cycleEnterSpeed(delta: -1 | 1): boolean {
    return this.update({
      enterSpeedIndex: nextEnterSpeedIndex(
        this.state.enterSpeedIndex,
        delta,
      ),
    });
  }

  cycleMoveDelay(delta: -1 | 1): boolean {
    return this.update({
      moveDelay: nextMoveDelay(this.state.moveDelay, delta),
    });
  }

  setLanguage(language: string): boolean {
    if (!language.trim()) return false;
    return this.update({ language });
  }

  setFullscreen(value: boolean): boolean {
    return this.update({ fullscreen: value });
  }

  private update(changes: Partial<MutableSettings>): boolean {
    const next = normalizeSettings({ ...this.state, ...changes });
    if (JSON.stringify(next) === JSON.stringify(this.state)) return false;
    this.state = next;
    this.writeState();
    return true;
  }

  private readState(): SettingsSnapshot {
    try {
      const raw = this.storage.getItem(settingsStorageKey);
      if (raw) return normalizeSettings(JSON.parse(raw));
    } catch {
      // Keep defaults when browser storage is unavailable or corrupt.
    }
    return { ...defaultSettings };
  }

  private writeState(): void {
    try {
      this.storage.setItem(settingsStorageKey, JSON.stringify(this.state));
    } catch {
      // The in-memory state remains usable when storage is disabled.
    }
  }
}
