import { originalDrawRect } from "./wallRendering";

/** Native DrawControl snaps SetDrawRect endpoints before shifting for the icon. */
export function controlCaptionRect(
  x: number, y: number, minimum: number, iconSize: number, resolution: number,
): {x: number; y: number; width: number; height: number} {
  const rect = originalDrawRect({x: x - minimum / 2, y: y - minimum / 2, width: minimum, height: minimum}, resolution);
  rect.y += iconSize * .25;
  return rect;
}

export interface ControlTutorialState {
  readonly emptySave: boolean;
  readonly fromIntro: boolean;
  readonly fadeT: number;
  readonly secondPuzzleWon: boolean;
}

export interface TutorialAction {
  readonly texture: "arrowKeys" | "wasd" | "undoKey" | "redoKey" | "restartKey" | "pauseKey" | "mouseZoom" | null;
  readonly label: string;
  readonly y: number;
  readonly alpha: number;
}

export function controlTutorial(
  levelName: string, width: number, height: number,
  board: { x: number; y: number; width: number; height: number },
  state?: ControlTutorialState,
): { x: number; fontSize: number; actions: TutorialAction[] } {
  const minimum = Math.min(width, height);
  const narrow = width / height < 1.51;
  const unit = narrow ? height * 0.1 : board.height * 0.14;
  const spacing = unit * 1.5;
  const y = narrow ? Math.trunc(height / 2) : board.y + board.height / 2;
  const x = narrow ? (width - minimum * 0.82) / 4 : board.x - unit * 2;
  // Draw.GetFocusFractPause shrinks desktop UI as aspect approaches1:1.
  const pauseT = Math.max(0, Math.min(1, (Math.fround(1.7777778) - width / height) / (Math.fround(1.7777778) - 1)));
  const pauseFraction = Math.fround(0.6) + (Math.fround(0.335) - Math.fround(0.6)) * pauseT;
  const fontSize = Math.trunc(minimum * pauseFraction * Math.fround(0.075) * Math.fround(0.64));
  const actions: TutorialAction[] = [];
  if (levelName === "first_puzzle" || levelName === "hub" && state?.emptySave) {
    actions.push(
      { texture: "arrowKeys", label: "", y: y - spacing * 0.4, alpha: 1 },
      { texture: "wasd", label: "Move", y: y + spacing * 0.4, alpha: 1 },
    );
  } else if (levelName !== "hub" && levelName !== "custom_level" && state?.fromIntro) {
    const fade = levelName === "second_puzzle" && !state.secondPuzzleWon;
    const textures = ["undoKey", "redoKey", "restartKey", "pauseKey", null] as const;
    const labels = ["Undo", "Redo", "Reset puzzle", "Menu", "Note: You can undo a reset"];
    for (let index = 0; index < textures.length; index++) {
      actions.push({ texture: textures[index]!, label: labels[index]!, y: y + spacing * (index - 2),
        alpha: fade ? Math.max(0, Math.min(1, state.fadeT - 1 - 2.5 * index)) : 1 });
    }
  } else if (["squash_inside_3", "eat_4_sides", "eat_long_line"].includes(levelName)) {
    actions.push({ texture: "mouseZoom", label: "Zoom in/out", y, alpha: 1 });
  }
  return { x, fontSize, actions };
}
