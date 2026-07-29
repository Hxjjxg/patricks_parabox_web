import "./style.css";
import { GameController, type DebugApi } from "./GameController";
import { GameRenderer } from "./render/GameRenderer";

declare global {
  interface Window {
    __PARABOX__: DebugApi;
  }
}

async function main(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#app");
  if (!host) throw new Error("Missing #app host");
  const renderer = new GameRenderer();
  await renderer.init(host);
  const controller = new GameController(renderer);
  controller.start();
  window.__PARABOX__ = controller.getDebugApi();
}

void main().catch((error: unknown) => {
  console.error("Failed to initialize Patrick's Parabox", error);
});
