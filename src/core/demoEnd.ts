import { FloorType, type Floor } from "./model";

export const demoEndText = {
  thankYou: "DemoEnd_ThankYou",
  fullGame: "DemoEnd_FullGame",
  follow: "DemoEnd_Follow",
  store: "DemoEnd_Store",
} as const;

export function isDemoEndFloor(floor: Floor | null): boolean {
  return floor?.type === FloorType.DemoEnd;
}

export function escapeActionForFloor(
  floor: Floor | null,
): "undo" | "pause" {
  return isDemoEndFloor(floor) ? "undo" : "pause";
}

/** Match DrawDemoEnd's 0.65 second smooth fade-in. */
export function demoEndFade(animationT: number): number {
  const normalized = Math.max(0, Math.min(1, animationT / 0.65));
  return normalized * normalized * (3 - 2 * normalized);
}
