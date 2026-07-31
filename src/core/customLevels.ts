import { parseLevel } from "./levelParser";
import type { WorldModel } from "./model";

export const customLevelSceneName = "custom_level";
export const customLevelStorageKey = "parabox-web-custom-levels-v1";

export interface CustomLevelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CustomLevelEntry {
  readonly id: string;
  readonly filename: string;
  readonly displayName: string;
  readonly source: string;
}

export interface CustomLevelImportResult {
  readonly entry: CustomLevelEntry;
  readonly replaced: boolean;
}

interface StoredCustomLevelEntry {
  readonly id: string;
  readonly filename: string;
  readonly source: string;
}

interface StoredCustomLevels {
  readonly version: 1;
  readonly entries: StoredCustomLevelEntry[];
  readonly lastLoadedId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function filenameKey(filename: string): string {
  return filename.toLowerCase();
}

function normalizeFilename(filename: string): string {
  const normalized = filename.replaceAll("\\", "/");
  const basename = normalized
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.trim();
  if (!basename) throw new Error("Custom level filename is empty");
  return basename;
}

function displayName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]*$/, "");
  return withoutExtension || filename;
}

function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function stableIdFor(
  filename: string,
  entries: readonly StoredCustomLevelEntry[],
): string {
  const base = `custom-${hashKey(filenameKey(filename))}`;
  let id = base;
  let suffix = 2;
  const used = new Set(entries.map((entry) => entry.id));
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }
  return id;
}

function publicEntry(entry: StoredCustomLevelEntry): CustomLevelEntry {
  return {
    ...entry,
    displayName: displayName(entry.filename),
  };
}

function emptyState(): StoredCustomLevels {
  return {
    version: 1,
    entries: [],
    lastLoadedId: null,
  };
}

function normalizeState(value: unknown): StoredCustomLevels {
  if (!isRecord(value) || !Array.isArray(value.entries)) return emptyState();

  const entries: StoredCustomLevelEntry[] = [];
  const indexByFilename = new Map<string, number>();
  for (const candidate of value.entries) {
    if (!isRecord(candidate)) continue;
    if (
      typeof candidate.filename !== "string" ||
      typeof candidate.source !== "string" ||
      candidate.source.length === 0
    ) {
      continue;
    }

    let filename: string;
    try {
      filename = normalizeFilename(candidate.filename);
    } catch {
      continue;
    }
    const key = filenameKey(filename);
    const existingIndex = indexByFilename.get(key);
    if (existingIndex !== undefined) {
      const existing = entries[existingIndex];
      if (!existing) continue;
      entries[existingIndex] = {
        ...existing,
        filename,
        source: candidate.source,
      };
      continue;
    }

    const requestedId =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : "";
    const id =
      requestedId && !entries.some((entry) => entry.id === requestedId)
        ? requestedId
        : stableIdFor(filename, entries);
    indexByFilename.set(key, entries.length);
    entries.push({ id, filename, source: candidate.source });
  }

  const requestedLastLoadedId =
    typeof value.lastLoadedId === "string" ? value.lastLoadedId : null;
  const lastLoadedId = entries.some(
    (entry) => entry.id === requestedLastLoadedId,
  )
    ? requestedLastLoadedId
    : null;
  return { version: 1, entries, lastLoadedId };
}

export function parseCustomLevel(source: string): WorldModel {
  return parseLevel(source, customLevelSceneName);
}

/** Browser-independent equivalent of the original custom_levels directory. */
export class CustomLevelStore {
  private readonly storage: CustomLevelStorage;
  private state: StoredCustomLevels;

  constructor(storage: CustomLevelStorage) {
    this.storage = storage;
    this.state = this.readState();
  }

  list(): CustomLevelEntry[] {
    return this.state.entries
      .map(publicEntry)
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }

  find(id: string): CustomLevelEntry | null {
    const entry = this.state.entries.find((candidate) => candidate.id === id);
    return entry ? publicEntry(entry) : null;
  }

  lastLoaded(): CustomLevelEntry | null {
    return this.state.lastLoadedId
      ? this.find(this.state.lastLoadedId)
      : null;
  }

  importLevel(filenameInput: string, source: string): CustomLevelImportResult {
    const filename = normalizeFilename(filenameInput);
    if (source.length === 0) throw new Error("Custom level source is empty");
    const key = filenameKey(filename);
    const existingIndex = this.state.entries.findIndex(
      (entry) => filenameKey(entry.filename) === key,
    );
    const entries = [...this.state.entries];
    let stored: StoredCustomLevelEntry;
    if (existingIndex >= 0) {
      const existing = entries[existingIndex];
      if (!existing) throw new Error("Missing custom level entry");
      stored = { ...existing, filename, source };
      entries[existingIndex] = stored;
    } else {
      stored = {
        id: stableIdFor(filename, entries),
        filename,
        source,
      };
      entries.push(stored);
    }
    this.state = { ...this.state, entries };
    this.writeState();
    return {
      entry: publicEntry(stored),
      replaced: existingIndex >= 0,
    };
  }

  markLoaded(id: string): boolean {
    if (!this.state.entries.some((entry) => entry.id === id)) return false;
    if (this.state.lastLoadedId === id) return false;
    this.state = { ...this.state, lastLoadedId: id };
    this.writeState();
    return true;
  }

  private readState(): StoredCustomLevels {
    try {
      const stored = this.storage.getItem(customLevelStorageKey);
      if (stored) return normalizeState(JSON.parse(stored));
    } catch {
      // Keep an in-memory empty directory when storage is unavailable.
    }
    return emptyState();
  }

  private writeState(): void {
    try {
      this.storage.setItem(customLevelStorageKey, JSON.stringify(this.state));
    } catch {
      // Imported levels remain available for the current browser session.
    }
  }
}
