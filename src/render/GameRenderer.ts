import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import type { Block, HsvColor, Level, WorldModel } from "../core/model";
import { FloorType } from "../core/model";
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
    const reservedWidth = width >= 900 ? width * 0.72 : width * 0.94;
    const cell = Math.min(
      reservedWidth / focusLevel.width,
      (height * 0.82) / focusLevel.height,
    );
    const boardWidth = cell * focusLevel.width;
    const boardHeight = cell * focusLevel.height;
    const boardX = (width - boardWidth) / 2;
    const boardY = height * 0.5 - boardHeight / 2;
    const viewFlipH =
      world.inputFlipH() !== this.inspectionFlipH;
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
    this.drawLevel(
      this.scene,
      focusLevel,
      viewBlock,
      { x: boardX, y: boardY, width: boardWidth, height: boardHeight },
      0,
      new Set(),
      viewFlipH,
    );

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
    const xCenter = focusX - boardWidth / 2 - controlUnit * 2;
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
      const tip = uiState.session.tip;
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
            ...uiState.session.options.map((option, index) =>
              `${index === uiState.session.selectedIndex ? "›" : " "} ${option}`,
            ),
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
      this.drawFloor(graphics, floor.type, cellRect, level);
    }

    const wallColor = computeWallColor(viewBlock, fractionOfScreen);
    for (const block of level.blockList) {
      if (block.subLevel) continue;
      const wallRect = this.cellRect(level, block.x, block.y, rect, flipH);
      this.drawWall(graphics, level, block, wallRect, wallColor);
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(level);
    for (const block of level.blockList) {
      if (!block.subLevel) continue;
      const blockRect = this.cellRect(
        level,
        block.x,
        block.y,
        rect,
        flipH,
      );
      this.drawBlock(
        graphics,
        block,
        blockRect,
        depth,
        nextAncestors,
        flipH,
      );
    }
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
    graphics
      .rect(
        rect.x + shadowOffset,
        rect.y + shadowOffset,
        rect.width,
        rect.height,
      )
      .fill({ color: COLORS.shadow, alpha: 0.3 });

    const subLevel = block.subLevel;
    if (!subLevel) return;
    const terminal =
      subLevel.filledWithWalls ||
      depth >= 7 ||
      Math.min(rect.width, rect.height) < 11;

    if (terminal) {
      graphics
        .rect(rect.x, rect.y, rect.width, rect.height)
        .fill({
          texture: this.textures.walls[46]!,
          textureSpace: "local",
          color: filledBlockColor,
        })
        .stroke({ color: shade(filledBlockColor, 0.2), width: outlineWidth });
    } else {
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
      const padding = Math.max(1.5, size * 0.11);
      const inner = {
        x: rect.x + padding,
        y: rect.y + padding,
        width: rect.width - padding * 2,
        height: rect.height - padding * 2,
      };
      if (ancestors.has(subLevel)) {
        this.drawRecursiveVoid(graphics, inner, backingColor, depth);
      } else {
        this.drawLevel(
          graphics,
          subLevel,
          block,
          inner,
          depth + 1,
          ancestors,
          flipH !== block.flipH,
        );
      }
    }

    if (block.isPlayer) this.drawFace(graphics, block, rect);
    else if (block.possessable) {
      this.drawPossessableFace(
        graphics,
        rect,
        terminal ? filledBlockColor : backingColor,
      );
    }
    if (block.flipH) this.drawFlipMark(graphics, rect);
    if (depth === 0 && terminal) {
      this.drawBlockMotes(graphics, block, rect, filledBlockColor);
    }
  }

  private drawFace(
    graphics: Graphics,
    block: Block,
    rect: Rect,
  ): void {
    const size = Math.min(rect.width, rect.height);
    const eyeWidth = Math.max(2.5, size * 0.2);
    const eyeHeight = Math.max(2.5, size * 0.2);
    const direction = block.flipH ? -1 : 1;
    const centerY = rect.y + rect.height * 0.45;
    const offset = direction * size * 0.018;
    const eyeColor = 0x000000;
    const fractionOfScreen = size / Math.max(1, this.app.screen.height);
    const eyeAlpha = Math.max(
      0,
      Math.min(1, (-Math.log10(fractionOfScreen + 15) + 1.5) * 2),
    );
    const eyeTexture = size < 50 ? this.textures.eyeSmall : this.textures.eye;
    graphics
      .rect(
        rect.x + rect.width * 0.25 + offset - eyeWidth / 2,
        centerY - eyeHeight / 2,
        eyeWidth,
        eyeHeight,
      )
      .fill({
        texture: eyeTexture,
        textureSpace: "local",
        color: eyeColor,
        alpha: eyeAlpha,
      });
    graphics
      .rect(
        rect.x + rect.width * 0.75 + offset - eyeWidth / 2,
        centerY - eyeHeight / 2,
        eyeWidth,
        eyeHeight,
      )
      .fill({
        texture: eyeTexture,
        textureSpace: "local",
        color: eyeColor,
        alpha: eyeAlpha,
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

  private drawBlockMotes(
    graphics: Graphics,
    block: Block,
    rect: Rect,
    color: number,
  ): void {
    const size = Math.min(rect.width, rect.height);
    const mote = Math.max(2, size * 0.12);
    const phase = this.elapsed * 0.8 + block.id * 1.73;
    const offsets = [
      [-0.1, 0.28],
      [0.98, 0.72],
      [0.5, -0.1],
      [0.72, 1.02],
    ] as const;
    for (let index = 0; index < offsets.length; index++) {
      const [ox, oy] = offsets[index]!;
      const pulse = 0.55 + 0.25 * Math.sin(phase + index * 1.9);
      graphics
        .rect(
          rect.x + rect.width * ox,
          rect.y + rect.height * oy,
          mote,
          mote,
        )
        .fill({ color, alpha: pulse });
    }
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
