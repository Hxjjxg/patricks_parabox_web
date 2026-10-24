/**
 * Pure decision for what to do with a directional request.
 *
 * The controller used to apply every accepted command immediately, which let
 * a direction pressed mid-slide move the model a second tile while the visual
 * was still sliding (the "teleport" bug). The original instead keeps one
 * pending move (`World.multiPlayerQueued`) and runs it when the animation
 * lands. This module is that rule set, kept free of DOM/world side effects so
 * it can be tested exhaustively.
 */
export type DirectionRequestDecision =
  | "apply"
  | "queue"
  | "skip-and-apply"
  | "ignore";

export interface DirectionRequestState {
  /** True for held-key auto-repeat, false for a fresh press. */
  readonly repeated: boolean;
  /** Nothing may start while a block is animating (unless skipping is on). */
  readonly animating: boolean;
  /** A move is already waiting for the animation to land. */
  readonly alreadyQueued: boolean;
  /** `Movement.WaitForMoveDirChange`: last move was blocked. */
  readonly waitingForDirectionChange: boolean;
  readonly allowSkippingAnimation: boolean;
}

export function decideDirectionRequest(
  state: DirectionRequestState,
): DirectionRequestDecision {
  // The original accepts at most one queued move at a time.
  if (state.alreadyQueued) return "ignore";
  if (state.repeated) {
    if (state.waitingForDirectionChange) return "ignore";
    if (!state.animating) return "apply";
    return state.allowSkippingAnimation ? "skip-and-apply" : "ignore";
  }
  if (!state.animating) return "apply";
  return state.allowSkippingAnimation ? "skip-and-apply" : "queue";
}
