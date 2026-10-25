import { Assets, Texture } from "pixi.js";
import nativeTuiAtlasUrl from "../assets/fonts/native-inconsolata-atlas.png?url";
import nativeJostAtlasUrl from "../assets/fonts/native-jost-atlas.png?url";

export interface OriginalTextures {
  portalThumbnails: Record<string, Texture>;
  nativeJostAtlas: Texture;
  walls: Texture[];
  wallsFlip: Texture[];
  wallsBig: Texture[];
  wallsBigFlip: Texture[];
  arrowKeys: Texture;
  wasd: Texture;
  undoKey: Texture;
  redoKey: Texture;
  restartKey: Texture;
  pauseKey: Texture;
  mouseZoom: Texture;
  button: Texture;
  playerButton: Texture;
  playerButtonEyes: Texture;
  playerButtonEyesSmall: Texture;
  quickButton: Texture;
  quickPlayerButton: Texture;
  quickBlock: Texture;
  nativeTuiAtlas: Texture;
  eye: Texture;
  eyeSmall: Texture;
  eyeClosed: Texture;
  eyeClosedSmall: Texture;
  possessEye: Texture;
  possessEyeSmall: Texture;
  centerGradient: Texture;
  infParticle: Texture;
  infParticleOutline: Texture;
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
  const thumbnailUrls = import.meta.glob<string>('../assets/level-thumbnails/*.png', {
    eager: true, import: 'default', query: '?url',
  });
  const portalThumbnails = Object.fromEntries(await Promise.all(Object.entries(thumbnailUrls).map(async ([path, url]) => {
    const texture = await Assets.load<Texture>(url);
    texture.source.style.addressMode = 'clamp-to-edge';
    texture.source.style.scaleMode = 'linear';
    return [path.slice(path.lastIndexOf('/') + 1, -4), texture] as const;
  })));
  const nativeJostAtlas = await Assets.load<Texture>(nativeJostAtlasUrl);
  nativeJostAtlas.source.style.addressMode = "clamp-to-edge";
  nativeJostAtlas.source.style.scaleMode = "linear";
  const [
    walls,
    wallsFlip,
    wallsBig, wallsBigFlip,
    arrowKeys,
    wasd,
    undoKey, redoKey, restartKey, pauseKey, mouseZoom,
    button,
    playerButton,
    playerButtonEyes, playerButtonEyesSmall, quickButton, quickPlayerButton, quickBlock, nativeTuiAtlas,
    eye,
    eyeSmall,
    eyeClosed, eyeClosedSmall,
    possessEye,
    possessEyeSmall,
    centerGradient,
    infParticle, infParticleOutline,
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
    Promise.all(Array.from({ length: 13 }, (_, index) => loadWall(`wall_big_main_${index}.png`))),
    Promise.all(Array.from({ length: 13 }, (_, index) => loadWall(`wall_big_flip_${index}.png`))),
    load("keys_arrow_keys.png"),
    load("keys_wasd.png"),
    load("key_z.png"), load("key_x.png"), load("key_r.png"), load("key_esc.png"), load("mouse_left_click_scroll.png"),
    load("button_2.png"),
    load("button_player_x.png"),
    load("button_player_x_only_eyes.png"), load("button_player_x_only_eyes_small.png"),
    load("quick_anim_goal.png"), load("quick_anim_goal_player.png"),
    loadWall("quick_anim_block.png"), Assets.load<Texture>(nativeTuiAtlasUrl),
    load("eye1.png"),
    load("eye1_small.png"),
    load("eye2.png"), load("eye2_small.png"),
    load("possess_eye_1.png"),
    load("possess_eye_1_small.png"),
    load("center_gradient.png"),
    load("infinity_particle.png"), load("infinity_particle_outline.png"),
  ]);

  return {
    portalThumbnails,
    nativeJostAtlas,
    walls,
    wallsFlip,
    wallsBig, wallsBigFlip,
    arrowKeys,
    wasd,
    undoKey, redoKey, restartKey, pauseKey, mouseZoom,
    button,
    playerButton,
    playerButtonEyes, playerButtonEyesSmall, quickButton, quickPlayerButton, quickBlock, nativeTuiAtlas,
    eye,
    eyeSmall,
    eyeClosed, eyeClosedSmall,
    possessEye,
    possessEyeSmall,
    centerGradient,
    infParticle, infParticleOutline,
  };
}
