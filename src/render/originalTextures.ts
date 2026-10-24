import { Assets, Texture } from "pixi.js";

export interface OriginalTextures {
  walls: Texture[];
  wallsFlip: Texture[];
  arrowKeys: Texture;
  wasd: Texture;
  button: Texture;
  playerButton: Texture;
  eye: Texture;
  eyeSmall: Texture;
  possessEye: Texture;
  possessEyeSmall: Texture;
  centerGradient: Texture;
}

const urls = import.meta.glob<string>("../assets/textures/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});

function urlFor(filename: string): string {
  const entry = Object.entries(urls).find(([path]) => path.endsWith(`/${filename}`));
  if (!entry) throw new Error(`Missing original texture ${filename}`);
  return entry[1];
}

async function load(filename: string): Promise<Texture> {
  return Assets.load<Texture>(urlFor(filename));
}

async function loadWall(filename: string): Promise<Texture> {
  const texture = await load(filename);
  // Preserve the original neutral, bevel and white highlight values. The wall
  // shader applies the (possibly >1) tint before framebuffer clamping.
  texture.source.style.addressMode = "clamp-to-edge";
  texture.source.style.scaleMode = "linear";
  return texture;
}

export async function loadOriginalTextures(): Promise<OriginalTextures> {
  const [
    walls,
    wallsFlip,
    arrowKeys,
    wasd,
    button,
    playerButton,
    eye,
    eyeSmall,
    possessEye,
    possessEyeSmall,
    centerGradient,
  ] = await Promise.all([
    Promise.all(
      Array.from({ length: 48 }, (_, index) =>
        loadWall(`wall_main_${index}.png`),
      ),
    ),
    Promise.all(
      Array.from({ length: 48 }, (_, index) =>
        loadWall(`wall_flip_${index}.png`),
      ),
    ),
    load("keys_arrow_keys.png"),
    load("keys_wasd.png"),
    load("button_2.png"),
    load("button_player_x.png"),
    load("eye1.png"),
    load("eye1_small.png"),
    load("possess_eye_1.png"),
    load("possess_eye_1_small.png"),
    load("center_gradient.png"),
  ]);

  return {
    walls,
    wallsFlip,
    arrowKeys,
    wasd,
    button,
    playerButton,
    eye,
    eyeSmall,
    possessEye,
    possessEyeSmall,
    centerGradient,
  };
}
