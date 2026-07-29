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
  const image = new Image();
  image.decoding = "async";
  image.src = urlFor(filename);
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error(`Could not normalize original wall ${filename}`);
  context.drawImage(image, 0, 0);

  // Unity's Graphics.DrawTexture path renders these neutral 0xC1 wall pixels
  // as the full tint colour. AssetRipper preserves that neutral multiplier in
  // the PNG, so normalize it before Pixi applies its own tint multiplication.
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const neutral = 0xc1;
  for (let index = 0; index < pixels.data.length; index += 4) {
    pixels.data[index] = Math.min(
      255,
      Math.round((pixels.data[index]! * 255) / neutral),
    );
    pixels.data[index + 1] = Math.min(
      255,
      Math.round((pixels.data[index + 1]! * 255) / neutral),
    );
    pixels.data[index + 2] = Math.min(
      255,
      Math.round((pixels.data[index + 2]! * 255) / neutral),
    );
  }
  context.putImageData(pixels, 0, 0);
  return Texture.from(canvas);
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
