import type { ProgressSnapshot } from "./progression";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressSlotSummary {
  readonly slot: number;
  readonly empty: boolean;
  readonly wonCount: number;
  readonly nexusUnlocked: boolean;
  readonly allWon: boolean;
  readonly playtimeSeconds: number;
}

interface StoredProgressSlots {
  readonly version: 1;
  readonly activeSlot: number;
  readonly slots: Array<ProgressSnapshot | null>;
}

const slotStorageKey = "parabox-web-save-slots-v1";
const legacyProgressStorageKey = "parabox-web-progress-v1";
const slotCount = 4;

export function formatPlaytime(playtimeSeconds: number): string {
  const totalMinutes = Math.floor(
    Math.max(
      0,
      Number.isFinite(playtimeSeconds) ? playtimeSeconds : 0,
    ) / 60,
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string",
  );
}

function normalizeSnapshot(value: unknown): ProgressSnapshot | null {
  if (!isRecord(value)) return null;
  const wonLevels = stringArray(value.wonLevels);
  const attemptedLevels = stringArray(value.attemptedLevels);
  const recentArea =
    typeof value.recentArea === "string" ? value.recentArea : null;
  const nexusUnlocked =
    typeof value.nexusUnlocked === "boolean"
      ? value.nexusUnlocked
      : wonLevels.includes("iii");
  const rawPlaytime =
    typeof value.playtimeSeconds === "number"
      ? value.playtimeSeconds
      : typeof value.playtime === "number"
        ? value.playtime
        : 0;
  return {
    version: 3,
    wonLevels: [...new Set(wonLevels)].sort(),
    attemptedLevels: [...new Set(attemptedLevels)].sort(),
    recentArea,
    nexusUnlocked,
    playtimeSeconds:
      Number.isFinite(rawPlaytime) && rawPlaytime > 0
        ? rawPlaytime
        : 0,
  };
}

function clampSlot(index: number): number {
  return Math.max(0, Math.min(slotCount - 1, Math.trunc(index)));
}

function emptyState(): StoredProgressSlots {
  return {
    version: 1,
    activeSlot: 0,
    slots: Array<ProgressSnapshot | null>(slotCount).fill(null),
  };
}

function snapshotIsEmpty(snapshot: ProgressSnapshot | null): boolean {
  return (
    snapshot === null ||
    (snapshot.wonLevels.length === 0 && !snapshot.nexusUnlocked)
  );
}

export class ProgressSlotStore {
  private readonly storage: KeyValueStorage;
  private state: StoredProgressSlots;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
    this.state = this.readState();
  }

  get activeSlot(): number {
    return this.state.activeSlot;
  }

  activeSnapshot(): ProgressSnapshot | null {
    return this.snapshotAt(this.activeSlot);
  }

  snapshotAt(index: number): ProgressSnapshot | null {
    return this.state.slots[clampSlot(index)] ?? null;
  }

  saveActive(snapshot: ProgressSnapshot): void {
    const slots = [...this.state.slots];
    const normalized = normalizeSnapshot(snapshot);
    // Original SaveFile.Save does not create a file until the player has
    // either completed a puzzle or unlocked the Nexus.
    slots[this.activeSlot] = snapshotIsEmpty(normalized)
      ? null
      : normalized;
    this.state = {
      ...this.state,
      slots,
    };
    this.writeState();
  }

  switchSlot(index: number): ProgressSnapshot | null {
    this.state = {
      ...this.state,
      activeSlot: clampSlot(index),
    };
    this.writeState();
    return this.activeSnapshot();
  }

  eraseSlot(index: number): boolean {
    const slot = clampSlot(index);
    if (this.state.slots[slot] === null) return false;
    const slots = [...this.state.slots];
    slots[slot] = null;
    this.state = {
      ...this.state,
      slots,
    };
    this.writeState();
    return true;
  }

  summaries(
    allLevels: number | ReadonlySet<string>,
  ): ProgressSlotSummary[] {
    return this.state.slots.map((snapshot, slot) => {
      const wonLevels = new Set(snapshot?.wonLevels ?? []);
      const wonCount =
        typeof allLevels === "number"
          ? wonLevels.size
          : [...allLevels].filter((name) => wonLevels.has(name)).length;
      const allWon =
        snapshot !== null &&
        (typeof allLevels === "number"
          ? wonCount >= allLevels
          : [...allLevels].every((name) => wonLevels.has(name)));
      return {
        slot,
        empty: snapshotIsEmpty(snapshot),
        wonCount,
        nexusUnlocked: snapshot?.nexusUnlocked ?? false,
        allWon,
        playtimeSeconds: snapshot?.playtimeSeconds ?? 0,
      };
    });
  }

  private readState(): StoredProgressSlots {
    try {
      const stored = this.storage.getItem(slotStorageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isRecord(parsed) && Array.isArray(parsed.slots)) {
          const storedSlots = parsed.slots;
          const slots = Array.from(
            { length: slotCount },
            (_, index) => normalizeSnapshot(storedSlots[index]),
          );
          return {
            version: 1,
            activeSlot:
              typeof parsed.activeSlot === "number"
                ? clampSlot(parsed.activeSlot)
                : 0,
            slots,
          };
        }
      }

      const legacy = this.storage.getItem(legacyProgressStorageKey);
      if (legacy) {
        const migrated = normalizeSnapshot(JSON.parse(legacy));
        if (migrated && !snapshotIsEmpty(migrated)) {
          const state = emptyState();
          state.slots[0] = migrated;
          this.state = state;
          this.writeState();
          return state;
        }
      }
    } catch {
      // Keep an in-memory empty store if browser storage is unavailable.
    }
    return emptyState();
  }

  private writeState(): void {
    try {
      this.storage.setItem(slotStorageKey, JSON.stringify(this.state));
    } catch {
      // The current in-memory slots stay usable when storage is disabled.
    }
  }
}
