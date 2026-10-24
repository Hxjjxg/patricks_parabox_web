import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import type { Block, HsvColor, Level, WorldModel } from "../core/model";
import { DrawStyle, FloorType } from "../core/model";
import { AnimType, lerp } from "../core/animation";
import { demoEndFade, demoEndText } from "../core/demoEnd";
import { localizeEnglish } from "../core/localization";
import type {
  SpecialModeName,
  SpecialModeSnapshot,
} from "../core/specialModes";
import type { SessionMenuSnapshot } from "../core/sessionMenu";
import {
  loadOriginalTextures,
  type OriginalTextures,
} from "./originalTextures";

export type RendererMode =
  | SpecialModeName
  | "fast-travel"
  | "credits"
  | "paused"
  | "title";

export interface RendererUiState {
  readonly mode: RendererMode;
  readonly special: SpecialModeSnapshot;
  readonly fastTravel: {
    readonly selectedIndex: number;
    readonly total: number;
    readonly areaName: string;
  } | null;
  readonly session: SessionMenuSnapshot;
  readonly preferences: {
    readonly grid: boolean;
    readonly leftHanded: boolean;
    readonly disableParticles: boolean;
  };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InspectionBoard {
  readonly rect: Rect;
  readonly viewBlock: Block;
  readonly flipH: boolean;
}

export interface InspectionHit {
  readonly inside: boolean;
  readonly block: Block | null;
}

interface VoidSquare {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
}

const COLORS = {
  void: 0x000000,
  levelInterior: 0x494949,
  levelInteriorLight: 0x515151,
  outline: 0x202020,
  shadow: 0x000000,
  button: 0xbfc0c0,
  buttonDark: 0x3a3a3a,
  control: 0xffffff,
};

function hsvToRgb({ h, s, v }: HsvColor): number {
  const hue = ((h % 1) + 1) % 1;
  const saturation = Math.max(0, Math.min(1, s));
  const value = Math.max(0, Math.min(1, v));
  const sector = hue * 6;
  const index = Math.floor(sector);
  const fraction = sector - index;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  const options: Array<[number, number, number]> = [
    [value, t, p],
    [q, value, p],
    [p, value, t],
    [p, q, value],
    [t, p, value],
    [value, p, q],
  ];
  const [r, g, b] = options[index % 6] ?? options[0]!;
  return (
    (Math.round(r * 255) << 16) |
    (Math.round(g * 255) << 8) |
    Math.round(b * 255)
  );
}

function isCloneRepresentation(block: Block): boolean {
  return Boolean(
    block.subLevel && block.subLevel.getExitBlock() !== block,
  );
}

function scaleBrightness(fractionOfScreen: number): number {
  return (
    -0.25 *
      (Math.log(fractionOfScreen + 0.005) / Math.log(20)) +
    0.5
  );
}

function computeBlockColor(block: Block, fractionOfScreen: number): number {
  let saturation = block.color.s;
  let value =
    block.color.v * scaleBrightness(fractionOfScreen) * 0.9;
  if (block.isSomeInfExitBlock) {
    value *= 0.55;
  } else if (isCloneRepresentation(block)) {
    value += 0.42;
    saturation *= 0.76;
  }
  return hsvToRgb({ h: block.color.h, s: saturation, v: value });
}

function computeWallColor(block: Block, fractionOfScreen: number): number {
  let saturation = block.color.s;
  let value =
    scaleBrightness(fractionOfScreen) * block.color.v * 2;
  if (block.isSomeInfExitBlock) {
    value *= 0.55;
  } else if (isCloneRepresentation(block)) {
    value += 0.4;
    saturation *= 0.82;
  }
  return hsvToRgb({ h: block.color.h, s: saturation, v: value });
}

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(channel(color, 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(channel(color, 8) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(channel(color, 0) * factor)));
  return (r << 16) | (g << 8) | b;
}

function seededSquares(count: number): VoidSquare[] {
  let state = 0x5f3759df;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.018 + random() * 0.022,
    speed: 0.003 + random() * 0.009,
    phase: random() * Math.PI * 2,
  }));
}

function isSolid(level: Level, x: number, y: number): boolean {
  if (!level.inBounds(x, y)) return true;
  const block = level.getBlock(x, y);
  return Boolean(block && !block.subLevel);
}

function autotileIndex(level: Level, block: Block): number {
  const up = isSolid(level, block.x, block.y + 1);
  const down = isSolid(level, block.x, block.y - 1);
  const right = isSolid(level, block.x + 1, block.y);
  const left = isSolid(level, block.x - 1, block.y);
  const topRight = up && right && isSolid(level, block.x + 1, block.y + 1);
  const topLeft = up && left && isSolid(level, block.x - 1, block.y + 1);
  const bottomRight =
    down && right && isSolid(level, block.x + 1, block.y - 1);
  const bottomLeft = down && left && isSolid(level, block.x - 1, block.y - 1);
  const mask =
    Number(topLeft) |
    (Number(up) * 2) |
    (Number(topRight) * 4) |
    (Number(left) * 8) |
    (Number(right) * 16) |
    (Number(bottomLeft) * 32) |
    (Number(down) * 64) |
    (Number(bottomRight) * 128);
  const thresholds: ReadonlyArray<readonly [number, number]> = [
    [0, 47],
    [2, 1],
    [8, 2],
    [10, 3],
    [11, 4],
    [16, 5],
    [18, 6],
    [22, 7],
    [24, 8],
    [26, 9],
    [27, 10],
    [30, 11],
    [31, 12],
    [64, 13],
    [66, 14],
    [72, 15],
    [74, 16],
    [75, 17],
    [80, 18],
    [82, 19],
    [86, 20],
    [88, 21],
    [90, 22],
    [91, 23],
    [94, 24],
    [95, 25],
    [104, 26],
    [106, 27],
    [107, 28],
    [120, 29],
    [122, 30],
    [123, 31],
    [126, 32],
    [127, 33],
    [208, 34],
    [210, 35],
    [214, 36],
    [216, 37],
    [218, 38],
    [219, 39],
    [222, 40],
    [223, 41],
    [248, 42],
    [250, 43],
    [251, 44],
    [254, 45],
    [255, 46],
  ];
  let result = 47;
  for (const [minimum, index] of thresholds) {
    if (mask >= minimum) result = index;
  }
  return result;
}

export class GameRenderer {
  readonly app = new Application();
  private readonly scene = new Graphics();
  private readonly controls = new Container();
  private readonly controlGraphics = new Graphics();
  private readonly controlLabels: Text[] = [];
  private readonly modeOverlay = new Graphics();
  private readonly modeText = new Text({
    text: "",
    style: new TextStyle({
      fill: 0xffffff,
      fontFamily: "Jost",
      fontSize: 24,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 720,
    }),
  });
  private readonly winText = new Text({
    text: "",
    style: new TextStyle({
      fill: 0xffffff,
      fontFamily: "Jost",
      fontSize: 30,
      fontWeight: "600",
      letterSpacing: 1,
    }),
  });
  private readonly voidSquares = seededSquares(55);
  private textures!: OriginalTextures;
  private world: WorldModel | null = null;
  private elapsed = 0;
  private uiState: RendererUiState | null = null;
  private inspectionBlock: Block | null = null;
  private inspectionFlipH = false;
  private inspectionBoard: InspectionBoard | null = null;

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  async init(host: HTMLElement): Promise<void> {
    await Promise.all([
      document.fonts.load("600 23px Jost"),
      document.fonts.load("600 18px Inconsolata"),
    ]);
    this.textures = await loadOriginalTextures();
    await this.app.init({
      resizeTo: window,
      antialias: true,
      autoDensity: true,
      background: COLORS.void,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    this.app.canvas.id = "game-canvas";
    this.app.canvas.setAttribute("aria-label", "Patrick's Parabox play field");
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.scene);
    this.controls.addChild(this.controlGraphics);
    this.app.stage.addChild(this.controls);
    this.winText.anchor.set(0.5);
    this.winText.style = new TextStyle({
      fill: 0xffffff,
      fontFamily: "Jost",
      fontSize: 30,
      fontWeight: "600",
      letterSpacing: 1,
    });
    this.app.stage.addChild(this.winText);
    this.app.stage.addChild(this.modeOverlay);
    this.modeText.anchor.set(0.5);
    this.app.stage.addChild(this.modeText);
    this.buildControlLabels();
    this.app.ticker.add((ticker) => {
      this.elapsed += ticker.deltaMS / 1000;
      this.draw();
    });
  }

  setWorld(world: WorldModel): void {
    this.world = world;
    this.draw();
  }

  setInspection(block: Block | null, flipH: boolean): void {
    this.inspectionBlock = block;
    this.inspectionFlipH = flipH;
    this.draw();
  }

  setUiState(uiState: RendererUiState): void {
    this.uiState = uiState;
    this.draw();
  }

  private buildControlLabels(): void {
    const move = new Text({
      text: "Move",
      style: new TextStyle({
        fill: COLORS.control,
        fontFamily: "Jost",
        fontSize: 23,
        fontWeight: "600",
      }),
    });
    move.anchor.set(0.5);
    this.controls.addChild(move);
    this.controlLabels.push(move);
  }

  private draw(): void {
    const world = this.world;
    if (!world) return;
    this.inspectionBoard = null;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.scene.clear();
    this.scene.rect(0, 0, width, height).fill(COLORS.void);
    this.drawVoid(this.scene, width, height);

    const player = world.findPlayerBlock();
    const viewBlock =
      this.inspectionBlock ?? world.getDefaultFocusBlock();
    const focusLevel = viewBlock.subLevel;
    if (!focusLevel) return;

    // Original camera (`Draw.DrawBlocks`): the focus block always measures
    // `focusFractNormal` of the short screen edge; enter/exit transitions
    // scale that base rect between 1 and the level's camZoomFactor.
    const minimum = Math.min(width, height);
    const base = minimum * 0.82;
    const camT = world.newCamT;
    const camZoom = focusLevel.camZoomFactor;
    const camXS = 1 / lerp(1 / world.newXS, 1 / camZoom, camT);
    const camYS = 1 / lerp(1 / world.newYS, 1 / camZoom, camT);
    const viewFlipH = world.inputFlipH() !== this.inspectionFlipH;
    const unflippedX = lerp(world.newX, 0, camT);
    const camY = lerp(world.newY, 0, camT);
    const camX = viewFlipH ? -unflippedX : unflippedX;
    const boardWidth = base * camXS;
    const boardHeight = base * camYS;
    const boardX = width / 2 + camX * boardWidth - boardWidth / 2;
    const boardY = height / 2 + camY * boardHeight - boardHeight / 2;
    world.usedXS = camXS / Math.max(camZoom, 1e-6);
    world.usedYS = camYS / Math.max(camZoom, 1e-6);
    world.usedX = unflippedX * camZoom;
    world.usedY = camY * camZoom;

    this.inspectionBoard = {
      rect: {
        x: boardX,
        y: boardY,
        width: boardWidth,
        height: boardHeight,
      },
      viewBlock,
      flipH: viewFlipH,
    };

    // Draw the containing levels so enter/exit zooms show the surrounding
    // world the way the original does.
    let startBlock = viewBlock;
    let startRect: Rect = {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
    };
    let startFlipH = viewFlipH;
    if (!this.inspectionBlock) {
      for (let level = 0; level < 3; level++) {
        const parent = this.goOutOneLevel(startBlock, startRect, startFlipH);
        if (!parent) break;
        startBlock = parent.block;
        startRect = parent.rect;
        startFlipH = parent.flipH;
      }
    }
    const startLevel = startBlock.subLevel;
    if (startLevel) {
      this.drawLevel(
        this.scene,
        startLevel,
        startBlock,
        startRect,
        0,
        new Set(),
        startFlipH,
      );
    }

    this.drawControls(
      boardX,
      boardY,
      boardWidth,
      boardHeight,
      world.moveCount,
      width,
    );
    this.winText.text = world.winning ? "Solved" : "";
    this.winText.alpha = world.winning
      ? 0.72 + Math.sin(this.elapsed * 4) * 0.18
      : 0;
    this.winText.position.set(width / 2, Math.max(32, boardY - 34));
    this.drawModeOverlay(width, height, player);
  }

  inspectionHitAt(clientX: number, clientY: number): InspectionHit {
    const board = this.inspectionBoard;
    if (!board) return { inside: false, block: null };
    const canvasBounds = this.app.canvas.getBoundingClientRect();
    if (canvasBounds.width <= 0 || canvasBounds.height <= 0) {
      return { inside: false, block: null };
    }
    const x =
      ((clientX - canvasBounds.left) / canvasBounds.width) *
      this.app.screen.width;
    const y =
      ((clientY - canvasBounds.top) / canvasBounds.height) *
      this.app.screen.height;
    const rect = board.rect;
    if (
      x < rect.x ||
      x >= rect.x + rect.width ||
      y < rect.y ||
      y >= rect.y + rect.height
    ) {
      return { inside: false, block: null };
    }

    const level = board.viewBlock.subLevel;
    if (!level) return { inside: true, block: null };
    let gridX = Math.floor(((x - rect.x) / rect.width) * level.width);
    if (board.flipH) gridX = level.width - 1 - gridX;
    const gridY =
      level.height -
      1 -
      Math.floor(((y - rect.y) / rect.height) * level.height);
    const block = level.getBlock(gridX, gridY);
    if (!block?.subLevel || block.subLevel.filledWithWalls) {
      return { inside: true, block: null };
    }
    return { inside: true, block };
  }

  private drawVoid(graphics: Graphics, width: number, height: number): void {
    if (this.uiState?.preferences.disableParticles) return;
    const minimum = Math.min(width, height);
    for (const square of this.voidSquares) {
      const drift = (this.elapsed * square.speed + square.phase) % 1;
      const x = (square.x + Math.sin(drift * Math.PI * 2) * 0.015) * width;
      const y = ((square.y + drift * 0.06) % 1) * height;
      const alpha =
        0.305 + 0.075 * Math.sin(this.elapsed * 0.7 + square.phase);
      graphics
        .rect(
          Math.round(x),
          Math.round(y),
          square.size * minimum,
          square.size * minimum,
        )
        .fill({ color: 0xffffff, alpha });
    }
  }

  private drawControls(
    boardX: number,
    boardY: number,
    boardWidth: number,
    boardHeight: number,
    moveCount: number,
    viewportWidth: number,
  ): void {
    const visible =
      viewportWidth >= 900 &&
      (this.uiState?.mode ?? "playing") === "playing";
    this.controls.visible = visible;
    if (!visible) return;
    this.controls.alpha = moveCount === 0 ? 1 : Math.max(0, 1 - moveCount * 0.25);
    const minimum = Math.min(this.app.screen.width, this.app.screen.height);
    const iconSize = minimum * 0.13;
    const fontSize = minimum * 0.0288;
    const focusX = boardX + boardWidth / 2;
    const focusY = boardY + boardHeight / 2;
    const controlUnit = boardHeight * 0.14;
    const spacing = controlUnit * 1.5;
    const firstActionY = focusY - spacing * 0.4;
    const secondActionY = firstActionY + spacing * 0.8;
    const controlsOnRight = this.uiState?.preferences.leftHanded ?? false;
    const xCenter = controlsOnRight
      ? focusX + boardWidth / 2 + controlUnit * 2
      : focusX - boardWidth / 2 - controlUnit * 2;
    this.controls.position.set(xCenter, 0);
    const g = this.controlGraphics;
    g.clear();
    g.rect(
      -iconSize / 2,
      firstActionY - iconSize * 0.75,
      iconSize,
      iconSize,
    ).fill({
      texture: this.textures.arrowKeys,
      textureSpace: "local",
      color: 0xffffff,
    });
    g.rect(
      -iconSize / 2,
      secondActionY - iconSize * 0.75,
      iconSize,
      iconSize,
    ).fill({
      texture: this.textures.wasd,
      textureSpace: "local",
      color: 0xffffff,
    });
    const move = this.controlLabels[0];
    if (move) {
      move.style.fontSize = fontSize;
      move.position.set(
        0,
        secondActionY + iconSize * 0.25 + fontSize * 0.7,
      );
    }
  }

  private drawModeOverlay(
    width: number,
    height: number,
    player: Block,
  ): void {
    const uiState = this.uiState;
    const graphics = this.modeOverlay;
    const text = this.modeText;
    graphics.clear();
    text.visible = false;
    text.alpha = 1;
    if (!uiState) return;

    text.style.fontSize = Math.max(18, Math.min(30, height * 0.035));
    text.style.wordWrapWidth = Math.min(width * 0.72, 760);
    text.position.set(width / 2, height / 2);

    if (uiState.mode === "playing") {
      const floor =
        player.outerLevel?.getFloor(player.x, player.y) ?? null;
      if (floor?.type === FloorType.DemoEnd && floor.animationT > 0) {
        const fade = demoEndFade(floor.animationT);
        graphics.rect(0, 0, width, height).fill({
          color: 0x000000,
          alpha: fade * 0.5,
        });
        text.text = [
          localizeEnglish(demoEndText.thankYou),
          "",
          "",
          "",
          "",
          localizeEnglish(demoEndText.fullGame),
          "",
          localizeEnglish(demoEndText.follow),
        ].join("\n");
        text.style.wordWrapWidth = Math.min(width * 0.7, 760);
        text.alpha = fade;
        text.visible = true;
        return;
      }
      if (floor?.type !== FloorType.Info || !floor.info) return;
      const panelWidth = Math.min(width * 0.72, 760);
      const panelHeight = Math.min(150, height * 0.22);
      graphics
        .roundRect(
          (width - panelWidth) / 2,
          height - panelHeight - 28,
          panelWidth,
          panelHeight,
          12,
        )
        .fill({ color: 0x000000, alpha: 0.78 })
        .stroke({ color: 0xffffff, alpha: 0.22, width: 1 });
      text.text = floor.info;
      text.position.set(width / 2, height - panelHeight / 2 - 28);
      text.visible = true;
      return;
    }

    if (uiState.mode === "fast-travel") {
      const travel = uiState.fastTravel;
      const panelWidth = Math.min(width * 0.56, 560);
      graphics
        .roundRect(
          (width - panelWidth) / 2,
          24,
          panelWidth,
          92,
          12,
        )
        .fill({ color: 0x000000, alpha: 0.78 })
        .stroke({ color: 0xffffff, alpha: 0.25, width: 1 });
      text.text = travel
        ? `Fast travel\n${travel.areaName.replace("Area_", "")}  ${travel.selectedIndex + 1}/${travel.total}`
        : "Fast travel";
      text.position.set(width / 2, 70);
      text.visible = true;
      return;
    }

    if (uiState.mode === "credits") {
      graphics.rect(0, 0, width, height).fill({
        color: 0x000000,
        alpha: 0.94,
      });
      text.text =
        "Patrick's Parabox\n\nCredits\n\nPress Enter to return";
      text.visible = true;
      return;
    }

    if (uiState.mode === "title") {
      graphics.rect(0, 0, width, height).fill({
        color: 0x000000,
        alpha: 0.72,
      });
      text.text = `${uiState.session.title}\n\nPress Enter`;
      text.visible = true;
      return;
    }

    if (uiState.mode === "paused") {
      graphics.rect(0, 0, width, height).fill({
        color: 0x000000,
        alpha: 0.8,
      });
      text.style.wordWrapWidth = Math.min(width * 0.92, 760);
      const tip = uiState.session.tip;
      let optionStart = 0;
      let optionEnd = uiState.session.options.length;
      if (uiState.session.mode === "custom-levels") {
        const subtitleLines = uiState.session.subtitle.split("\n").length;
        const visibleCount = Math.max(
          3,
          Math.min(
            10,
            Math.floor((height - 150 - subtitleLines * 28) / 32),
          ),
        );
        optionStart = Math.min(
          Math.max(
            0,
            uiState.session.selectedIndex - Math.floor(visibleCount / 2),
          ),
          Math.max(0, uiState.session.options.length - visibleCount),
        );
        optionEnd = Math.min(
          uiState.session.options.length,
          optionStart + visibleCount,
        );
      }
      text.text = tip
        ? [
            uiState.session.title,
            "",
            uiState.session.subtitle,
            "",
            `${uiState.session.selectedIndex === 0 ? "›" : " "} ${
              tip.canMoveLeft ? "‹" : " "
            } ${tip.index + 1}/${tip.total} ${
              tip.canMoveRight ? "›" : " "
            }`,
            tip.text,
            "",
            `${uiState.session.selectedIndex === 1 ? "›" : " "} Back`,
          ].join("\n")
        : [
            uiState.session.title,
            "",
            ...(uiState.session.subtitle
              ? [uiState.session.subtitle, ""]
              : []),
            ...uiState.session.options
              .slice(optionStart, optionEnd)
              .map((option, visibleIndex) => {
                const index = optionStart + visibleIndex;
                const marker =
                  index === uiState.session.selectedIndex ? "›" : " ";
                const value = uiState.session.values[index];
                return `${marker} ${option}${value ? `  ${value}` : ""}`;
              }),
          ].join("\n");
      text.visible = true;
      return;
    }

    const special = uiState.special;
    const fade = Math.max(0, Math.min(1, special.transition * 2));
    graphics.rect(0, 0, width, height).fill({
      color: 0x000000,
      alpha: 0.88 * fade,
    });

    if (special.mode === "gallery" && special.gallery) {
      text.text = [
        `Gallery  ${special.gallery.index + 1}/${13}`,
        "",
        special.gallery.image.description,
        "",
        "↑ ↓  Browse     Z / Esc  Leave",
      ].join("\n");
    } else if (special.mode === "show" && special.show) {
      text.text = [
        "Show",
        "",
        special.show.phase.replaceAll("-", " "),
        "",
        "Hold X to accelerate     Esc for menu",
      ].join("\n");
    } else if (special.mode === "break" && special.break) {
      const size = Math.min(width, height) * 0.11;
      graphics
        .rect(
          width / 2 - size / 2,
          height / 2 - size / 2,
          size,
          size,
        )
        .fill({ color: 0xd8d8d8, alpha: fade });
      graphics
        .circle(width / 2 - size * 0.2, height / 2, size * 0.08)
        .circle(width / 2 + size * 0.2, height / 2, size * 0.08)
        .fill({ color: 0x000000, alpha: fade });
      text.text = "Break\n\nMove freely with arrows / WASD\nEsc for menu";
      text.position.set(width / 2, height * 0.72);
    }

    if (special.menu) {
      text.text = [
        special.menu.title,
        "",
        ...special.menu.options.map((option, index) =>
          `${index === special.menu?.selectedIndex ? "›" : " "} ${option}`,
        ),
      ].join("\n");
      text.position.set(width / 2, height / 2);
    }
    text.alpha = fade;
    text.visible = true;
  }

  private drawLevel(
    graphics: Graphics,
    level: Level,
    viewBlock: Block,
    rect: Rect,
    depth: number,
    ancestors: Set<Level>,
    flipH: boolean,
  ): void {
    if (!this.onScreen(rect)) return;
    if (rect.width <= 0.5 || rect.height <= 0.5) return;
    const fractionOfScreen =
      ((rect.width + rect.height) / 2) / Math.max(1, this.app.screen.height);
    const interiorColor = computeBlockColor(viewBlock, fractionOfScreen);
    graphics.rect(rect.x, rect.y, rect.width, rect.height).fill(interiorColor);
    graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({
      texture: this.textures.centerGradient,
      textureSpace: "local",
      color: 0xffffff,
      alpha: 0.08,
    });

    for (const floor of level.floorList) {
      const cellRect = this.cellRect(level, floor.x, floor.y, rect, flipH);
      if (!this.onScreen(cellRect)) continue;
      this.drawFloor(graphics, floor.type, cellRect, level);
    }

    // `Draw.ProcessTicket` draws level particles between floors and blocks.
    if (
      !this.uiState?.preferences.disableParticles &&
      this.world?.drawStyle !== DrawStyle.QuickAnim
    ) {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const showCelebration = this.world?.levelName === "hub";
      for (const particle of level.particles) {
        if (particle.celebration && !showCelebration) continue;
        const width = Math.abs(rect.width * particle.size);
        const height = Math.abs(rect.height * particle.size);
        if (width < 0.6 || height < 0.6) continue;
        let offsetX = rect.width * particle.x;
        if (flipH) offsetX *= -1;
        const offsetY = rect.height * particle.y;
        graphics
          .rect(
            centerX + offsetX - width / 2,
            centerY + offsetY - height / 2,
            width,
            height,
          )
          .fill({
            color: hsvToRgb({
              h: particle.hue,
              s: particle.sat,
              v: particle.val,
            }),
            alpha: particle.alpha,
          });
      }
    }

    const wallColor = computeWallColor(viewBlock, fractionOfScreen);
    for (const block of level.blockList) {
      if (block.subLevel) continue;
      const wallRect = this.animatedCellRect(level, block, rect, flipH);
      if (!this.onScreen(wallRect)) continue;
      this.drawWall(graphics, level, block, wallRect, wallColor);
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(level);
    const containers = level.blockList.filter((block) => block.subLevel);
    // Mirrors the original draw queues (still, bump, moving): moving boxes
    // must land on top of the frame they are sliding across.
    const ordered = [
      ...containers.filter((block) => !block.moving),
      ...containers.filter(
        (block) => block.moving && block.anim === AnimType.Bump,
      ),
      ...containers.filter(
        (block) => block.moving && block.anim !== AnimType.Bump,
      ),
    ];
    for (const block of ordered) {
      const blockRect = this.animatedCellRect(level, block, rect, flipH);
      if (!this.onScreen(blockRect)) continue;
      this.drawBlock(
        graphics,
        block,
        blockRect,
        depth,
        nextAncestors,
        flipH,
      );
    }

    for (const phantom of level.phantoms) {
      if (phantom.exitedFrom && phantom.exitedFrom === level.blocksWithThisAsTheirSubLevel[0]) {
        continue;
      }
      const cell = this.cellRect(
        level,
        phantom.xpos,
        phantom.ypos,
        rect,
        flipH,
      );
      const width = cell.width * phantom.xScale;
      const height = cell.height * phantom.yScale;
      const offsetX = (flipH ? -1 : 1) * phantom.x * cell.width;
      const phantomRect: Rect = {
        x: cell.x + offsetX + (cell.width - width) / 2,
        y: cell.y + phantom.y * cell.height + (cell.height - height) / 2,
        width,
        height,
      };
      if (!this.onScreen(phantomRect)) continue;
      if (phantom.face || !phantom.block.subLevel) {
        this.drawFace(graphics, phantom.block, phantomRect, true);
      } else {
        this.drawBlock(
          graphics,
          phantom.block,
          phantomRect,
          depth + 1,
          nextAncestors,
          flipH !== phantom.block.flipH,
        );
      }
    }

    if (
      this.uiState?.preferences.grid &&
      depth <= 3 &&
      Math.min(
        rect.width / Math.max(level.width, 1),
        rect.height / Math.max(level.height, 1),
      ) >= 6
    ) {
      for (let x = 1; x < level.width; x++) {
        const lineX = rect.x + (rect.width * x) / level.width;
        graphics
          .moveTo(lineX, rect.y)
          .lineTo(lineX, rect.y + rect.height);
      }
      for (let y = 1; y < level.height; y++) {
        const lineY = rect.y + (rect.height * y) / level.height;
        graphics.moveTo(rect.x, lineY).lineTo(rect.x + rect.width, lineY);
      }
      graphics.stroke({ color: 0xffffff, alpha: 0.16, width: 1 });
    }
  }

  private onScreen(rect: Rect): boolean {
    return !(
      rect.x > this.app.screen.width ||
      rect.y > this.app.screen.height ||
      rect.x + rect.width < 0 ||
      rect.y + rect.height < 0
    );
  }

  /** `Draw.GoOutOneLevel`: the parent level rect that contains `block`. */
  private goOutOneLevel(
    block: Block,
    rect: Rect,
    flipH: boolean,
  ): { block: Block; rect: Rect; flipH: boolean } | null {
    const outer = block.outerLevel;
    const exitBlock = outer?.blocksWithThisAsTheirSubLevel[0];
    if (!outer || !exitBlock) return null;
    const width = rect.width / (block.drawXScale || 1);
    const height = rect.height / (block.drawYScale || 1);
    let gridX = block.x;
    let offsetX = block.drawXOffset;
    const nextFlipH = flipH !== block.flipH;
    if (nextFlipH) {
      gridX = outer.width - 1 - gridX;
      offsetX *= -1;
    }
    // `GoOutOneLevel` works in block centers; our rects are top-left based.
    const parentWidth = width * outer.width;
    const parentHeight = height * outer.height;
    const centerX =
      rect.x +
      rect.width / 2 -
      (gridX - (outer.width - 1) / 2 + offsetX) * width;
    const centerY =
      rect.y +
      rect.height / 2 +
      (block.y - (outer.height - 1) / 2 - block.drawYOffset) * height;
    return {
      block: exitBlock,
      rect: {
        x: centerX - parentWidth / 2,
        y: centerY - parentHeight / 2,
        width: parentWidth,
        height: parentHeight,
      },
      flipH: nextFlipH,
    };
  }

  /** Cell rect after `Block.DrawXOffset/DrawXScale` (enter/exit/bump/nudge). */
  private animatedCellRect(
    level: Level,
    block: Block,
    rect: Rect,
    flipH: boolean,
  ): Rect {
    const cell = this.cellRect(level, block.x, block.y, rect, flipH);
    const width = cell.width * block.drawXScale;
    const height = cell.height * block.drawYScale;
    const offsetX = (flipH ? -1 : 1) * block.drawXOffset * cell.width;
    const offsetY = block.drawYOffset * cell.height;
    return {
      x: cell.x + offsetX + (cell.width - width) / 2,
      y: cell.y + offsetY + (cell.height - height) / 2,
      width,
      height,
    };
  }

  private cellRect(
    level: Level,
    x: number,
    y: number,
    rect: Rect,
    flipH: boolean,
  ): Rect {
    const width = rect.width / level.width;
    const height = rect.height / level.height;
    const screenX = flipH ? level.width - 1 - x : x;
    return {
      x: rect.x + screenX * width,
      y: rect.y + (level.height - 1 - y) * height,
      width,
      height,
    };
  }

  private drawFloor(
    graphics: Graphics,
    type: FloorType,
    rect: Rect,
    level: Level,
  ): void {
    const size = Math.min(rect.width, rect.height);
    const inset = size * 0.08;
    const x = rect.x + inset;
    const y = rect.y + inset;
    const width = rect.width - inset * 2;
    const height = rect.height - inset * 2;

    if (type === FloorType.Button || type === FloorType.PlayerButton) {
      const active =
        type === FloorType.Button
          ? this.world?.finishesSatisfied
          : this.world?.buttonsSatisfied;
      const border = active ? 0xffffff : COLORS.button;
      graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({
        texture:
          type === FloorType.PlayerButton
            ? this.textures.playerButton
            : this.textures.button,
        textureSpace: "local",
        color: border,
      });
      return;
    }

    if (type === FloorType.LevelPortal) {
      graphics
        .roundRect(x, y, width, height, size * 0.12)
        .fill({ color: 0x242424, alpha: 0.7 })
        .stroke({ color: hsvToRgb(level.getExitBlock().color), width: size * 0.06 });
      return;
    }

    if (type === FloorType.Info) {
      graphics
        .circle(rect.x + rect.width / 2, rect.y + rect.height / 2, size * 0.28)
        .stroke({ color: 0xffffff, width: Math.max(2, size * 0.05) });
      return;
    }

    if (type === FloorType.DemoEnd) {
      graphics
        .circle(rect.x + rect.width / 2, rect.y + rect.height / 2, size * 0.28)
        .fill({ color: 0x000000, alpha: 0.45 })
        .stroke({ color: 0xffffff, width: Math.max(2, size * 0.05) });
    }
  }

  private drawWall(
    graphics: Graphics,
    level: Level,
    block: Block,
    rect: Rect,
    color: number,
  ): void {
    const texture = this.textures.walls[autotileIndex(level, block)];
    if (!texture) return;
    graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({
      texture,
      textureSpace: "local",
      color,
    });
  }

  private drawBlock(
    graphics: Graphics,
    block: Block,
    rect: Rect,
    depth: number,
    ancestors: Set<Level>,
    flipH: boolean,
  ): void {
    const size = Math.min(rect.width, rect.height);
    const fractionOfScreen =
      ((rect.width + rect.height) / 2) /
      Math.max(1, this.app.screen.height);
    const backingColor = computeBlockColor(block, fractionOfScreen);
    const filledBlockColor = hsvToRgb(block.color);
    const shadowOffset = Math.max(1, size * 0.07);
    const outlineWidth = Math.max(1.2, size * 0.035);
    const subLevel = block.subLevel;
    const terminal =
      !subLevel ||
      subLevel.filledWithWalls ||
      depth >= 7 ||
      size < 11;

    if (!terminal && subLevel) {
      graphics
        .rect(
          rect.x + shadowOffset,
          rect.y + shadowOffset,
          rect.width,
          rect.height,
        )
        .fill({ color: COLORS.shadow, alpha: 0.3 });
    }

    if (terminal) {
      graphics
        .rect(rect.x, rect.y, rect.width, rect.height)
        .fill({
          texture: this.textures.walls[46]!,
          textureSpace: "local",
          color: filledBlockColor,
        })
        .stroke({ color: shade(filledBlockColor, 0.2), width: outlineWidth });
    } else if (subLevel) {
      graphics
        .rect(rect.x, rect.y, rect.width, rect.height)
        .fill(backingColor)
        .stroke({ color: shade(backingColor, 0.35), width: outlineWidth });
      graphics.rect(rect.x, rect.y, rect.width, rect.height).fill({
        texture: this.textures.centerGradient,
        textureSpace: "local",
        color: 0xffffff,
        alpha: 0.08,
      });
      if (ancestors.has(subLevel)) {
        this.drawRecursiveVoid(graphics, rect, backingColor, depth);
      } else {
        this.drawLevel(
          graphics,
          subLevel,
          block,
          rect,
          depth + 1,
          ancestors,
          flipH !== block.flipH,
        );
      }
    }

    if (block.isPlayer || block.possessable) {
      if (block.drawIsPlayer) {
        this.drawFace(graphics, block, rect);
      } else {
        this.drawPossessableFace(
          graphics,
          rect,
          terminal ? filledBlockColor : backingColor,
        );
      }
    }
    if (block.flipH || block.fadeFlipH) this.drawFlipMark(graphics, rect);
  }

  private drawFace(
    graphics: Graphics,
    block: Block,
    rect: Rect,
    facePhantom = false,
  ): void {
    if (!block.drawIsPlayer && !facePhantom) return;
    const width = rect.width;
    const height = rect.height;
    const fractionOfScreen =
      ((width + height) / 2) / Math.max(1, this.app.screen.height);
    let alpha = -Math.log10(fractionOfScreen + 15) + 1.5;
    if (block.subLevel && !block.subLevel.filledWithWalls) {
      alpha = -Math.log10(fractionOfScreen + 1.5) + 0.5;
    }
    if (!block.drawIsPlayer && block.moving && block.anim === AnimType.Still) {
      const t = block.animT / block.animLength;
      alpha *= block.isPlayer ? 1 - t : t;
    }
    if (alpha < 0) return;

    const blinking =
      Math.floor(block.faceAnimT * 7.12) % 26 === 0 && block.drawIsPlayer;
    let eyeWidth = Math.max(2.5, width * 0.2);
    let eyeHeight = Math.max(2.5, height * 0.2);
    if (blinking) {
      eyeWidth *= 1.05;
      eyeHeight *= 0.95;
    }
    const texture = blinking
      ? this.textures.eyeSmall
      : width * 0.2 < 50
        ? this.textures.eyeSmall
        : this.textures.eye;

    // Draw.DrawFace places the eye centers at -0.25/+0.25 width around the
    // block center and -0.05 height, biased by the look offset.
    let leftX = -0.25;
    let rightX = 0.25;
    let eyeY = -0.05;
    if (block.drawIsPlayer || facePhantom) {
      if (block.eyeXOffset > 0) leftX += block.eyeXOffset * 1.5;
      else leftX += block.eyeXOffset;
      if (block.eyeXOffset < 0) rightX += block.eyeXOffset * 1.5;
      else rightX += block.eyeXOffset;
      eyeY += block.eyeYOffset * 1.5;
    }
    const direction = block.flipH ? -1 : 1;
    leftX *= direction;
    rightX *= direction;
    const centerY = rect.y + height * (0.5 + eyeY);
    const drawHeight = blinking ? Math.max(1.2, eyeHeight * 0.18) : eyeHeight;
    graphics
      .rect(
        rect.x + width * (0.5 + leftX) - eyeWidth / 2,
        centerY - drawHeight / 2,
        eyeWidth,
        drawHeight,
      )
      .fill({
        texture,
        textureSpace: "local",
        color: 0x000000,
        alpha,
      });
    graphics
      .rect(
        rect.x + width * (0.5 + rightX) - eyeWidth / 2,
        centerY - drawHeight / 2,
        eyeWidth,
        drawHeight,
      )
      .fill({
        texture,
        textureSpace: "local",
        color: 0x000000,
        alpha,
      });
  }

  private drawPossessableFace(graphics: Graphics, rect: Rect, color: number): void {
    const size = Math.min(rect.width, rect.height);
    const eyeSize = Math.max(2.5, size * 0.2);
    const texture =
      size < 50 ? this.textures.possessEyeSmall : this.textures.possessEye;
    const eyeColor = shade(color, 0.35);
    graphics
      .rect(
        rect.x + rect.width * 0.25 - eyeSize / 2,
        rect.y + rect.height * 0.5 - eyeSize / 2,
        eyeSize,
        eyeSize,
      )
      .fill({ texture, textureSpace: "local", color: eyeColor });
    graphics
      .rect(
        rect.x + rect.width * 0.75 - eyeSize / 2,
        rect.y + rect.height * 0.5 - eyeSize / 2,
        eyeSize,
        eyeSize,
      )
      .fill({ texture, textureSpace: "local", color: eyeColor });
  }

  private drawFlipMark(graphics: Graphics, rect: Rect): void {
    const inset = Math.min(rect.width, rect.height) * 0.1;
    graphics
      .moveTo(rect.x + inset, rect.y + rect.height - inset)
      .lineTo(rect.x + rect.width - inset, rect.y + inset)
      .stroke({
        color: 0xffffff,
        width: Math.max(1, inset * 0.22),
        alpha: 0.4,
      });
  }

  private drawRecursiveVoid(
    graphics: Graphics,
    rect: Rect,
    color: number,
    depth: number,
  ): void {
    graphics.rect(rect.x, rect.y, rect.width, rect.height).fill(COLORS.void);
    const rings = Math.min(5, 2 + depth);
    for (let i = 0; i < rings; i++) {
      const inset = ((i + 1) / (rings + 2)) * Math.min(rect.width, rect.height) * 0.5;
      graphics
        .rect(
          rect.x + inset,
          rect.y + inset,
          Math.max(0, rect.width - inset * 2),
          Math.max(0, rect.height - inset * 2),
        )
        .stroke({
          color,
          width: Math.max(0.5, Math.min(rect.width, rect.height) * 0.025),
          alpha: 0.6 - i * 0.08,
        });
    }
  }
}
