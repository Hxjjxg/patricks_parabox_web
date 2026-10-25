import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Sprite,
  Texture, Rectangle,
  type Shader,
} from "pixi.js";
import type { Block, Floor, HsvColor, Level, WorldModel } from "../core/model";
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

import { autotileIndex, createWallShader, originalDrawRect, wallTint } from "./wallRendering";
import { drawBlockBorder, drawInfZoneFrame, guiHsvColor, isInfinityBorder } from "./borderRendering";
import { controlCaptionRect, controlTutorial, type ControlTutorialState } from "./controlRendering";
import { nativeMoveCaptionQuads } from "./nativeFontRendering";
import { nativeFocusRect, pixelResolution, quickAnimFocusRect } from "./focusGeometry";
import { clipShadow, shadowRect, wallShadowCull } from "./shadowRendering";
import { largeWallQuads } from "./wallBigRendering";
import { faceQuads } from "./faceRendering";
import { phantomGeometry, shouldDrawPhantom } from "./phantomRendering";
import {alternateLevels,gridBoards,tuiLayout,tuiGlyphs,useAlternateDrawStyle,type AlternateStyleContext,type TuiGlyph} from "./alternateStyles";
import {nativeTuiGlyphQuad} from "./nativeTuiFont";
import {meetsNativeDrawSize,nativeDrawPolicy} from "./drawPolicy";
import { infinityGlyphQuads } from "./infinityRendering";
import { flipShineQuad } from "./flipShineRendering";
import { goalCellRect, goalStrips, goalTint } from "./goalRendering";
import { cameraTransitionPhase, cloneAncestor, cloneFocus, cloneFocusEligible, cloneIntensity, cloneTransitionOpacity } from "./cloneFocusRendering";
import { previewClip, shouldSimpleSlide, simpleSlideRect, stackClip, type InfExitPreview, type SceneTicket } from "./renderContext";

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
  readonly alternateStyle?: AlternateStyleContext;
  readonly controls?: ControlTutorialState;
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

interface EffectTicket {
  block: Block; rect: Rect; depth: number; flipH: boolean; clip: Rect | null; cloneFade?:boolean; facePhantom?:boolean;
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

function scaleBrightness(fractionOfScreen: number): number {
  return (
    -0.25 *
      (Math.log(fractionOfScreen + 0.005) / Math.log(20)) +
    0.5
  );
}

function computeBlockColor(block: Block, fractionOfScreen: number, cloneFade=false,phase=1): number {
  let saturation = block.color.s;
  let value =
    block.color.v * scaleBrightness(fractionOfScreen) * 0.9;
  if (block.isSomeInfExitBlock) {
    value *= 0.55;
  } else {
    const intensity=cloneIntensity(block,cloneFade,phase);
    value += 0.42*intensity;
    saturation *= 1-0.24*intensity;
  }
  return guiHsvColor({ h: block.color.h, s: saturation, v: value });
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

export class GameRenderer {
  readonly app = new Application();
  private readonly scene = new Container();
  private readonly transitionScene = new Container();
  private activePassRoot:Container|null=null;
  private readonly sceneLayers: Graphics[] = [];
  private readonly wallShaders = new WeakMap<Graphics, Shader>();
  private sceneLayerCount = 0;
  private activeSceneContainer: Container | null = null;
  private readonly maskPasses: Array<{container: Container; mask: Graphics}> = [];
  private maskPassCount = 0;
  private pendingTickets: SceneTicket[] | null = null;
  private currentTicket: SceneTicket | null = null;
  private effectTickets: EffectTicket[] = [];
  private readonly tuiLabels: Text[] = [];
  private tuiLabelCount = 0;
  private readonly tuiGlyphTextures=new Map<string,Texture>();
  private readonly tuiNativeSprites:Sprite[]=[];
  private tuiNativeSpriteCount=0;
  private readonly controls = new Container();
  private readonly controlGraphics = new Graphics();
  private readonly controlLabels: Text[] = [];
  private readonly controlGlyphTextures = new Map<string, Texture>();
  private readonly controlGlyphs: Sprite[] = [];
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
  private readonly shadowTextures: Texture[] = [];
  private shadowTextureCount = 0;
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
      autoStart: false,
      resizeTo: window,
      antialias: true,
      autoDensity: true,
      background: COLORS.void,
      resolution: Math.min(pixelResolution(window.devicePixelRatio), 2),
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
    this.app.stage.addChild(this.transitionScene);
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

  /** Present only after the controller advances this frame's model/camera. */
  renderFrame(timestamp: number): void {
    this.app.ticker.update(timestamp);
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
    for (let index = 0; index < 5; index++) {
      const label = new Text({
        text: "",
        style: new TextStyle({
          fill: COLORS.control,
          fontFamily: "Jost",
          fontSize: 23,
          // The bundled file is already SemiBold; native FontStyle is Normal.
          fontWeight: "normal",
        }),
      });
      label.anchor.set(0.5);
      this.controls.addChild(label);
      this.controlLabels.push(label);
    }
  }

  private nextSceneLayer(): Graphics {
    const index = this.sceneLayerCount++;
    let graphics = this.sceneLayers[index];
    if (!graphics) {
      graphics = new Graphics();
      this.sceneLayers.push(graphics);
      this.scene.addChild(graphics);
    }
    (this.activeSceneContainer ?? this.scene).addChild(graphics);
    graphics.visible = true;
    graphics.clear();
    graphics.setFillStyle({ color: 0xffffff, alpha: 1 });
    delete graphics.context.customShader;
    return graphics;
  }

  private nextWallLayer(tint: Float32Array): Graphics {
    const graphics = this.nextSceneLayer();
    let shader = this.wallShaders.get(graphics);
    if (!shader) {
      shader = createWallShader(this.app.renderer.limits.maxBatchableTextures);
      this.wallShaders.set(graphics, shader);
    }
    shader.resources.localUniforms.uniforms.uWallTint = tint;
    graphics.context.customShader = shader;
    return graphics;
  }

  private draw(): void {
    const world = this.world;
    if (!world) return;
    this.inspectionBoard = null;
    if(this.transitionScene)this.transitionScene.visible=false;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.sceneLayerCount = 0;
    this.shadowTextureCount = 0;
    this.maskPassCount = 0;
    this.activeSceneContainer = this.scene;
    for (const pass of this.maskPasses) pass.container.visible = false;
    for (const layer of this.sceneLayers) layer.visible = false;
    for (const label of this.tuiLabels ?? []) label.visible = false;
    for (const sprite of this.tuiNativeSprites ?? []) sprite.visible=false;
    this.tuiNativeSpriteCount=0;
    this.tuiLabelCount=0;
    const graphics = this.nextSceneLayer();
    graphics.rect(0, 0, width, height).fill(COLORS.void);
    const alternateContext=this.uiState?.alternateStyle ?? {};
    const alternateMode=this.uiState?.mode ?? "playing";
    if(useAlternateDrawStyle(world.drawStyle,alternateMode,alternateContext)){
      this.drawAlternateStyle(width,height,alternateContext);
      this.drawModeOverlay(width,height,world.findPlayerBlock());
      return;
    }
    this.drawVoid(graphics, width, height);

    const player = world.findPlayerBlock();
    const instantZoom=this.uiState?.session?.settings?.instantZoom ?? false;
    const renderMode=this.uiState?.mode ?? "playing";
    const focusChoice=cloneFocus(world,this.inspectionBlock,renderMode,instantZoom);
    const viewBlock = focusChoice.block;
    const transitionPhase=cameraTransitionPhase(world);
    const focusLevel = viewBlock.subLevel;
    if (!focusLevel) return;

    // Original camera (`Draw.DrawBlocks`): the focus block always measures
    // `focusFractNormal` of the short screen edge; enter/exit transitions
    // scale that base rect between 1 and the level's camZoomFactor.
    const quick=world.drawStyle===DrawStyle.QuickAnim;
    const camT = instantZoom?1:quick?0:world.newCamT;
    const camZoom = focusLevel.camZoomFactor;
    const camXS = 1 / lerp(1 / world.newXS, 1 / camZoom, camT);
    const camYS = 1 / lerp(1 / world.newYS, 1 / camZoom, camT);
    const viewFlipH = world.inputFlipH() !== this.inspectionFlipH;
    const unflippedX = lerp(world.newX, 0, camT);
    const camY = lerp(world.newY, 0, camT);
    const cameraFlipH=quick?world.inputFlipH():viewFlipH;
    const camX = cameraFlipH ? -unflippedX : unflippedX;
    const focusRect = quick
      ?quickAnimFocusRect(width,height,camXS,camYS,camX,camY,viewBlock.drawXScale,viewBlock.drawYScale,this.app.renderer?.resolution ?? 1)
      :nativeFocusRect(width, height, camXS, camYS, camX, camY, .82, this.app.renderer?.resolution ?? 1);
    const boardWidth = focusRect.width;
    const boardHeight = focusRect.height;
    const boardX = focusRect.x;
    const boardY = focusRect.y;
    world.usedXS = camXS / Math.max(camZoom, 1e-6);
    world.usedYS = camYS / Math.max(camZoom, 1e-6);
    world.usedX = (quick?camX:unflippedX) * camZoom;
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
    let startDepth = 0;
    let cloneTicket: {block:Block;rect:Rect;depth:number;flipH:boolean}|null=focusChoice.clone
      ? {block:focusChoice.clone,rect:{...focusRect},depth:0,flipH:viewFlipH}:null;
    const ancestorPath:Block[]=[];
    // Native DrawBlocks walks enclosing levels even when InspectBlock is set.
    for (let level = 0; level < 3; level++) {
      const outer=startBlock.outerLevel;
      const parent = this.goOutOneLevel(startBlock, startRect, startFlipH);
      if (!parent||!outer) break;
      ancestorPath.push(startBlock);
      const representation=cloneAncestor(ancestorPath,player,outer,level,transitionPhase<.5,cloneFocusEligible(world,instantZoom));
      startBlock = representation?.block ?? parent.block;
      startRect = parent.rect;
      startFlipH = parent.flipH;
      startDepth--;
      if(!cloneTicket&&representation)cloneTicket={block:representation.clone,rect:{...startRect},depth:startDepth,flipH:startFlipH};
    }
    const cloneOverlay=cloneTicket!==null && world.anyBlockMoving && renderMode==="playing" && !instantZoom;
    const overlayPhase=world.cameraMoving?transitionPhase:0;
    if (world.drawStyle !== DrawStyle.QuickAnim && renderMode === "playing" && (!cloneOverlay||overlayPhase>=.5)) {
      const previews = (world as WorldModel & {infExitPreviews?: InfExitPreview[]}).infExitPreviews ?? [];
      for (const preview of previews) {
        let block = preview.exitBlocks[0];
        if (!block) continue;
        let rect = {...focusRect}, flipH = viewFlipH, depth = 0;
        for (let i=0;i<3;i++) {
          const parent = this.goOutOneLevel(block,rect,flipH);
          if (!parent) break;
          block = preview.exitBlocks[i+1] ?? parent.block;
          rect=parent.rect;flipH=parent.flipH;depth--;
        }
        const clip = previewClip(preview,startRect,viewFlipH,width,height,this.app.renderer.resolution);
        if (clip.width<=0 || clip.height<=0) continue;
        this.drawScenePass(block,rect,depth,flipH,clip);
        this.activeSceneContainer=this.maskedScene(clip);
        this.nextSceneLayer().rect(clip.x,clip.y,clip.width,clip.height).fill({color:0x000000,alpha:0.4});
      }
    }
    this.drawScenePass(startBlock,startRect,startDepth,startFlipH,null);
    this.activeSceneContainer=this.scene;

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
    if(cloneOverlay&&cloneTicket){
      const overlayRoot=this.transitionScene??this.scene;
      overlayRoot.visible=true;
      this.activeSceneContainer=overlayRoot;
      this.nextSceneLayer().rect(0,0,width,height).fill({color:0x000000,alpha:cloneTransitionOpacity(overlayPhase)});
      this.drawScenePass(cloneTicket.block,cloneTicket.rect,cloneTicket.depth,cloneTicket.flipH,null,true,overlayRoot);
      this.activeSceneContainer=this.scene;
    }
    if(quick&&renderMode==="paused")this.nextSceneLayer().rect(0,0,width,height).fill({color:0,alpha:.64});
    this.drawModeOverlay(width, height, player);
  }

  /** Native alternate modes bypass normal focus/camera/void/tutorial branches. */
  private drawAlternateStyle(width:number,height:number,context:AlternateStyleContext):void{
    const world=this.world!;
    const levels=alternateLevels(world,context),resolution=this.app.renderer?.resolution ?? 1;
    if(this.controls)this.controls.visible=false;
    this.winText.text="";this.winText.alpha=0;
    if(world.drawStyle===DrawStyle.Grid){
      for(const board of gridBoards(levels,width,height,resolution)){
        this.drawScenePass(board.level.getExitBlock(),board.rect,0,false,board.rect);
      }
    }else{
      if(world.winning){
        const alpha=Math.max(0,Math.min(1,context.winPhase??0))*.14;
        this.nextSceneLayer().rect(0,0,width,height).fill({color:0xffffff,alpha});
      }
      const layout=tuiLayout(levels,width,height,world.levelName==="hub",resolution);
      for(const glyph of tuiGlyphs(world,levels,layout,this.elapsed??0,context))this.drawTuiGlyph(glyph);
    }
    this.activeSceneContainer=this.scene;
    if(this.uiState?.mode==="paused")this.nextSceneLayer().rect(0,0,width,height).fill({color:0,alpha:.64});
  }

  /** Native fixed-width Inconsolata; exact GUI label rectangle comes from TUI. */
  private drawTuiGlyph(glyph:TuiGlyph):void{
    if(glyph.background!==null){
      this.nextSceneLayer().rect(glyph.cell.x,glyph.cell.y,glyph.cell.width,glyph.cell.height).fill(glyph.background);
    }
    const quad=nativeTuiGlyphQuad(glyph);
    if(quad){
      const key=quad.frame.join(",");let texture=this.tuiGlyphTextures.get(key);
      if(!texture){
        texture=new Texture({source:this.textures.nativeTuiAtlas.source,frame:new Rectangle(quad.frame[0]!,quad.frame[1]!,quad.frame[2]!,quad.frame[3]!)});
        texture.source.style.scaleMode="linear";texture.source.style.addressMode="clamp-to-edge";this.tuiGlyphTextures.set(key,texture);
      }
      const index=this.tuiNativeSpriteCount++;let sprite=this.tuiNativeSprites[index];
      if(!sprite){sprite=new Sprite({texture});this.tuiNativeSprites.push(sprite);}
      sprite.texture=texture;sprite.visible=true;sprite.tint=glyph.color;
      sprite.position.set(quad.x,quad.y);sprite.width=quad.width;sprite.height=quad.height;
      this.scene.addChild(sprite);
      return;
    }
    const index=this.tuiLabelCount++;let label=this.tuiLabels[index];
    if(!label){
      label=new Text({text:"",style:{fontFamily:"Inconsolata",fontWeight:"normal",fontSize:glyph.fontSize,fill:glyph.color,padding:0}});
      label.anchor.set(.5,1);this.tuiLabels.push(label);
    }
    label.visible=true;label.text=glyph.text;label.style.fontSize=glyph.fontSize;label.style.fill=glyph.color;
    label.position.set(glyph.labelRect.x+glyph.labelRect.width/2,glyph.labelRect.y+glyph.labelRect.height-3/(this.app.renderer?.resolution??1));
    this.scene.addChild(label);
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
    if (!block?.subLevel || block.subLevel.filledWithWalls || block.moving) {
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
    _moveCount: number,
    _viewportWidth: number,
  ): void {
    const tutorial = controlTutorial(this.world?.levelName ?? "", this.app.screen.width, this.app.screen.height,
      { x: boardX, y: boardY, width: boardWidth, height: boardHeight }, this.uiState?.controls);
    const visible = tutorial.actions.length > 0 && (this.uiState?.mode ?? "playing") === "playing";
    this.controls.visible = visible;
    if (!visible) return;
    this.controls.alpha = 1;
    const minimum = Math.min(this.app.screen.width, this.app.screen.height);
    this.controls.position.set(tutorial.x, 0);
    const g = this.controlGraphics;
    g.clear();
    for (const label of this.controlLabels) label.visible = false;
    for (const glyph of this.controlGlyphs) glyph.visible = false;
    let glyphIndex = 0;
    for (let index = 0; index < tutorial.actions.length; index++) {
      const action = tutorial.actions[index]!;
      const bigIcon = action.texture === "arrowKeys" || action.texture === "wasd" || action.texture === "mouseZoom";
      const iconSize = minimum * (bigIcon ? 0.13 : 0.09);
      if (action.texture) {
        const icon = originalDrawRect({ x: tutorial.x - iconSize / 2, y: action.y - iconSize * 0.75, width: iconSize, height: iconSize }, this.app.renderer?.resolution ?? 1);
        g.rect(icon.x - tutorial.x, icon.y, icon.width, icon.height).fill({
          texture: this.textures[action.texture], textureSpace: "local", color: 0xffffff, alpha: action.alpha,
        });
      }
      const caption = action.texture ? "\n" + action.label : action.label;
      const captionRect = controlCaptionRect(tutorial.x, action.y, minimum, action.texture ? iconSize : 0, this.app.renderer?.resolution ?? 1);
      const quads = nativeMoveCaptionQuads(caption, tutorial.fontSize, captionRect);
      if (quads && this.textures.nativeJostAtlas) {
        for (const quad of quads) {
          const key = quad.frame.join(",");
          let texture = this.controlGlyphTextures.get(key);
          if (!texture) {
            const [x, y, width, height] = quad.frame;
            texture = new Texture({source: this.textures.nativeJostAtlas.source, frame: new Rectangle(x!, y!, width!, height!)});
            this.controlGlyphTextures.set(key, texture);
          }
          let sprite = this.controlGlyphs[glyphIndex++];
          if (!sprite) {
            sprite = new Sprite(texture);
            this.controlGlyphs.push(sprite);
            this.controls.addChild(sprite);
          }
          sprite.texture = texture;
          sprite.position.set(quad.x - tutorial.x, quad.y);
          sprite.alpha = action.alpha;
          sprite.visible = true;
        }
        continue;
      }
      const label = this.controlLabels[index];
      if (!label || !action.label) continue;
      label.visible = true;
      label.text = action.texture ? "\n" + action.label : action.label;
      label.alpha = action.alpha;
      label.style.fontSize = tutorial.fontSize;
      // Jost's hhea ascent1070/descent-375, unitsPerEm1000.
      label.style.lineHeight = tutorial.fontSize * 1.445;
      label.style.wordWrap = !action.texture;
      label.style.wordWrapWidth = minimum * (this.app.screen.width / this.app.screen.height < 1.51 ? 0.15 : 0.22);
      const labelCenterX = Math.trunc(tutorial.x - minimum / 2) + minimum / 2;
      const labelCenterY = Math.trunc(action.y - minimum / 2) + minimum / 2;
      label.position.set(labelCenterX - tutorial.x, action.texture ? labelCenterY + iconSize * 0.25 : action.y);
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

  private maskedScene(clip: Rect | null): Container {
    if (!clip) return this.activePassRoot??this.scene;
    const index=this.maskPassCount++;
    let pass=this.maskPasses[index];
    if (!pass) {
      const container=new Container(),mask=new Graphics();
      container.addChild(mask);container.mask=mask;
      pass={container,mask};this.maskPasses.push(pass);
    }
    pass.container.visible=true;
    pass.mask.clear().rect(clip.x,clip.y,clip.width,clip.height).fill(0xffffff);
    (this.activePassRoot??this.scene).addChild(pass.container);
    return pass.container;
  }

  /** Native queues exhaust still/bump/moving geometry before all eye/glyph passes. */
  private drawScenePass(block: Block, rect: Rect, depth: number, flipH: boolean, clip: Rect | null,cloneFade=false,targetRoot?:Container): void {
    const previousRoot=this.activePassRoot;
    this.activePassRoot=targetRoot??this.scene;
    this.pendingTickets=[{block,rect,staticRect:rect,depth,flipH,parents:[],clip,priority:0,cloneFade}];
    this.effectTickets=[];
    while (this.pendingTickets.length) {
      let index=0;
      for (let i=1;i<this.pendingTickets.length;i++) if (this.pendingTickets[i]!.priority<this.pendingTickets[index]!.priority) index=i;
      const ticket=this.pendingTickets.splice(index,1)[0]!;
      if (!ticket.block.subLevel || ticket.depth>=15 || ticket.clip && (ticket.clip.width<=0 || ticket.clip.height<=0)) continue;
      this.currentTicket=ticket;
      this.activeSceneContainer=this.maskedScene(ticket.clip);
      this.drawLevel(this.nextSceneLayer(),ticket.block.subLevel,ticket.block,ticket.rect,ticket.depth,new Set(),ticket.flipH,ticket.staticRect,ticket.parents);
    }
    this.currentTicket=null;
    const effects=this.effectTickets;
    for (const player of [false,true]) for (const ticket of effects) {
      if (!ticket.facePhantom && !ticket.block.isPlayer && !ticket.block.possessable) continue;
      if ((ticket.facePhantom || ticket.block.drawIsPlayer)!==player) continue;
      this.activeSceneContainer=this.maskedScene(ticket.clip);
      this.drawFace(this.nextSceneLayer(),ticket.block,ticket.rect,!!ticket.facePhantom,
        ticket.facePhantom?ticket.flipH:ticket.flipH!==ticket.block.flipH,ticket.cloneFade);
    }
    for (const ticket of effects) {
      if (ticket.facePhantom) continue;
      if (!ticket.block.isSomeInfEnterBlock && !ticket.block.isSomeInfExitBlock) continue;
      this.activeSceneContainer=this.maskedScene(ticket.clip);
      this.drawInfEffect(this.nextSceneLayer(),ticket.block,ticket.rect,ticket.cloneFade);
    }
    for (const ticket of effects) {
      if (ticket.facePhantom) continue;
      if (!ticket.block.flipH && !ticket.block.fadeFlipH && ticket.block.specialEffect!==2 && ticket.block.specialEffect!==3 && !ticket.cloneFade) continue;
      this.activeSceneContainer=this.maskedScene(ticket.clip);
      this.drawFlipShine(this.nextSceneLayer(),ticket.block,ticket.rect,ticket.flipH,ticket.depth,ticket.cloneFade);
    }
    this.pendingTickets=null;this.effectTickets=[];this.activePassRoot=previousRoot;this.activeSceneContainer=this.scene;
  }

  private drawLevel(
    graphics: Graphics,
    level: Level,
    viewBlock: Block,
    rect: Rect,
    depth: number,
    ancestors: Set<Level>,
    flipH: boolean,
    staticRect: Rect = rect,
    parents: Block[] = [],
  ): Graphics {
    if (depth >= 15) return graphics;
    if (!this.onScreen(rect)) return graphics;
    const policy=nativeDrawPolicy(this.world?.levelName??"",this.app.screen.width,this.app.screen.height,this.app.renderer?.resolution??1);
    const cellWidth=rect.width/level.width,cellHeight=rect.height/level.height;
    const suppressMoving=policy.maxDepthMovingBlocks!==-1&&depth>policy.maxDepthMovingBlocks;
    const suppressSpecial=policy.suppressIiiEffects&&depth>=1&&viewBlock.specialEffect===13;
    const fractionOfScreen =
      ((rect.width + rect.height) / 2) / Math.max(1, this.app.screen.height);
    const cloneFade=this.currentTicket?.cloneFade ?? false;
    const phase=this.world?cameraTransitionPhase(this.world):1;
    const interiorColor = computeBlockColor(viewBlock, fractionOfScreen,cloneFade,phase);
    // Native snaps each backing/gradient draw quad, while retaining the unrounded ticket for children.
    const backingRect = originalDrawRect(rect, this.app.renderer?.resolution ?? 1);
    const quick=this.world?.drawStyle===DrawStyle.QuickAnim;
    if (!level.infZone) graphics.rect(backingRect.x, backingRect.y, backingRect.width, backingRect.height).fill(quick
      ?{texture:this.textures.quickBlock,textureSpace:"local",color:interiorColor}:interiorColor);
    if(!quick)graphics.rect(backingRect.x, backingRect.y, backingRect.width, backingRect.height).fill({
      texture: this.textures.centerGradient,
      textureSpace: "local",
      color: 0xffffff,
      // Native blockGradientColor.a=0.08 bypasses HSVToRGBGUI's /2 and
      // receives the default GUI shader's x2 multiplier.
      alpha: 0.16,
    });

    drawInfZoneFrame(graphics, viewBlock, rect, staticRect,
      this.app.screen.width, this.app.screen.height, this.app.renderer?.resolution ?? 1);

    for (const floor of level.floorList) {
      if(!meetsNativeDrawSize(cellWidth,cellHeight,policy.minDrawSize))continue;
      const cellRect = this.cellRect(level, floor.x, floor.y, rect, flipH);
      if (!this.onScreen(cellRect)) continue;
      this.drawFloor(graphics, floor.type, cellRect, level, floor);
    }

    // `Draw.ProcessTicket` draws level particles between floors and blocks.
    if (
      !this.uiState?.preferences.disableParticles &&
      !suppressMoving&&!suppressSpecial&&
      this.world?.drawStyle !== DrawStyle.QuickAnim
    ) {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const showCelebration = this.world?.levelName === "hub";
      for (const particle of level.particles) {
        if (particle.celebration && !showCelebration) continue;
        const width = Math.abs(rect.width * particle.size);
        const height = Math.abs(rect.height * particle.size);
        if (!meetsNativeDrawSize(width,height,policy.minParticleSize)) continue;
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

    // Native ProcessTicket submits every child shadow before walls or boxes.
    if (this.world?.drawStyle !== DrawStyle.QuickAnim&&!suppressMoving&&!suppressSpecial) {
      const resolution = this.app.renderer?.resolution ?? 1;
      for (const block of level.blockList) {
        if(!meetsNativeDrawSize(cellWidth*block.drawXScale,cellHeight*block.drawYScale,policy.minDrawSize))continue;
        if (!block.subLevel && wallShadowCull(level, block)) continue;
        const blockRect = this.animatedCellRect(level, block, rect, flipH);
        const staticCell = this.cellRect(level, block.x, block.y, rect, flipH);
        const shadow = shadowRect(block, blockRect, staticCell, flipH, this.app.screen.width, this.app.screen.height, resolution);
        if (!shadow) continue;
        const clipped = clipShadow(shadow, rect, resolution);
        if (!clipped) continue;
        if (block.subLevel) {
          graphics.rect(clipped.rect.x, clipped.rect.y, clipped.rect.width, clipped.rect.height).fill({ color: 0x000000, alpha: 0.3 });
        } else {
          const family = flipH ? this.textures.wallsFlip : this.textures.walls;
          let texture = family[autotileIndex(level, block, flipH)];
          if (!texture) continue;
          const uv = clipped.uv;
          if (uv.x !== 0 || uv.y !== 0 || uv.width !== 1 || uv.height !== 1) texture = this.shadowTexture(texture, uv);
          texture.source.style.addressMode = "clamp-to-edge";
          graphics.setFillStyle({ color: 0x000000, alpha: 0.3 });
          graphics.texture(texture, 0x000000, clipped.rect.x, clipped.rect.y, clipped.rect.width, clipped.rect.height);
          graphics.setFillStyle({ color: 0xffffff, alpha: 1 });
        }
      }
    }

    const cellFractionOfScreen =
      (rect.width / level.width + rect.height / level.height) / 2 /
      Math.max(1, this.app.screen.height);
    const tint=wallTint(viewBlock, cellFractionOfScreen,cloneFade?1-phase:undefined);
    if(quick)for(let i=0;i<3;i++)tint[i]=tint[i]!*Math.fround(.8);
    const wallGraphics = this.nextWallLayer(tint);
    for (const block of level.blockList) {
      if (block.subLevel) continue;
      if(suppressMoving&&block.moving)continue;
      if(!meetsNativeDrawSize(cellWidth*block.drawXScale,cellHeight*block.drawYScale,policy.minDrawSize))continue;
      const wallRect = this.animatedCellRect(level, block, rect, flipH);
      if (!this.onScreen(wallRect)) continue;
      this.drawWall(wallGraphics, level, block, wallRect, 0xffffff, flipH);
    }

    graphics = this.nextSceneLayer();
    if (this.world?.drawStyle !== DrawStyle.QuickAnim || isInfinityBorder(viewBlock)) {
      drawBlockBorder(graphics, viewBlock, rect, staticRect, flipH,
        this.app.screen.width, this.app.screen.height, this.app.renderer?.resolution ?? 1, this.elapsed ?? 0);
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(level);
    const containers = level.blockList.filter((block) => block.subLevel&&(!suppressMoving||!block.moving));
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
      if(!meetsNativeDrawSize(cellWidth*block.drawXScale,cellHeight*block.drawYScale,policy.minDrawSize))continue;
      const blockRect = this.animatedCellRect(level, block, rect, flipH);
      if (!this.onScreen(blockRect)) continue;
      if (this.pendingTickets) {
        const simple=shouldSimpleSlide({block:viewBlock,parents,depth},block,this.world?.drawStyle ?? DrawStyle.Normal);
        const clip=simple?stackClip(this.currentTicket?.clip ?? null,rect):this.currentTicket?.clip ?? null;
        this.pendingTickets.push({block,rect:blockRect,staticRect:this.cellRect(level,block.x,block.y,rect,flipH),
          depth:depth+1,flipH:flipH!==block.flipH,parents:[viewBlock,...parents],clip,
          priority:!block.moving?0:block.anim===AnimType.Bump?1:block.drawXScaleStart<1?5:4});
        continue;
      }
      graphics = this.drawBlock(
        graphics,
        block,
        blockRect,
        depth,
        nextAncestors,
        flipH,
        this.cellRect(level, block.x, block.y, rect, flipH),
      );
    }

    for (const phantom of level.phantoms) {
      if(suppressMoving)break;
      if(!meetsNativeDrawSize(cellWidth*phantom.xScale,cellHeight*phantom.yScale,policy.minDrawSize))continue;
      if (!shouldDrawPhantom(phantom,viewBlock,this.world?.drawStyle ?? DrawStyle.Normal)) {
        continue;
      }
      const cell = this.cellRect(
        level,
        phantom.xpos,
        phantom.ypos,
        rect,
        flipH,
      );
      const geometry=phantomGeometry(phantom,cell,rect,viewBlock,flipH,phase,this.currentTicket?.clip ?? null);
      const phantomRect=geometry.rect;
      if (!this.onScreen(phantomRect)) continue;
      if (phantom.face && this.pendingTickets) {
        this.effectTickets.push({block:phantom.block,rect:phantomRect,depth:depth+1,flipH,
          clip:geometry.clip,facePhantom:true});
      } else if (phantom.face || !phantom.block.subLevel) {
        this.drawFace(graphics, phantom.block, phantomRect, true, flipH);
      } else if (this.pendingTickets) {
        this.pendingTickets.push({block:phantom.block,rect:phantomRect,staticRect:cell,depth:depth+1,
          flipH:flipH!==(phantom.block.flipH!==phantom.block.fadeFlipH),parents:[viewBlock,...parents],
          clip:geometry.clip,priority:2});
      } else {
        graphics = this.drawBlock(
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
    if (this.pendingTickets && (this.world?.drawStyle!==DrawStyle.Grid||depth!==0||this.uiState?.mode==="fast-travel")) {
      this.effectTickets.push({block:viewBlock,rect,depth,flipH,clip:this.currentTicket?.clip ?? null,cloneFade});
    }
    else this.drawInfEffect(graphics, viewBlock, rect);
    return graphics;
  }

  private onScreen(rect: Rect): boolean {
    return !(
      rect.x > this.app.screen.width ||
      rect.y > this.app.screen.height ||
      rect.x + rect.width < 0 ||
      rect.y + rect.height < 0
    );
  }

  private shadowTexture(original: Texture, uv: Rect): Texture {
    const index = this.shadowTextureCount++;
    const frame = new Rectangle(original.frame.x + uv.x * original.frame.width, original.frame.y + uv.y * original.frame.height,
      uv.width * original.frame.width, uv.height * original.frame.height);
    let texture = this.shadowTextures[index];
    if (!texture) {
      texture = new Texture({ source: original.source, frame });
      this.shadowTextures.push(texture);
    } else {
      texture.source = original.source;
      texture.frame.copyFrom(frame);
      texture.updateUvs();
    }
    return texture;
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
    if (this.currentTicket && shouldSimpleSlide(this.currentTicket,block,this.world?.drawStyle ?? DrawStyle.Normal)) {
      const player=this.world!.findPlayerBlock();
      return simpleSlideRect(block,cell,flipH,player.animLength?player.animT/player.animLength:1);
    }
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
    const screenY = level.height - 1 - y;
    const left = rect.x + screenX * width;
    const top = rect.y + screenY * height;
    // Compute each grid boundary from its common origin. Adding a separately
    // rounded cell width can fall just below an integer and lose a whole pixel
    // when Draw.SetDrawRect truncates it (e.g. the third puzzle at 800x600).
    return {
      x: left,
      y: top,
      width: rect.x + (screenX + 1) * width - left,
      height: rect.y + (screenY + 1) * height - top,
    };
  }

  private drawFloor(
    graphics: Graphics,
    type: FloorType,
    rect: Rect,
    level: Level,
    floor?: Floor,
  ): void {
    const size = Math.min(rect.width, rect.height);

    if (type === FloorType.Button || type === FloorType.PlayerButton) {
      const resolution = this.app.renderer.resolution;
      const player = type === FloorType.PlayerButton;
      const cell = goalCellRect(rect, resolution);
      if (this.world?.drawStyle === DrawStyle.QuickAnim) {
        graphics.rect(cell.x, cell.y, cell.width, cell.height).fill({
          texture: player ? this.textures.quickPlayerButton : this.textures.quickButton,
          textureSpace: "local", color: 0xffffff,
        });
        return;
      }
      const active = Boolean(player ? this.world?.buttonsSatisfied : this.world?.finishesSatisfied);
      const fraction = Math.fround(Math.fround(Math.fround(rect.width * resolution) * level.width) + Math.fround(Math.fround(rect.height * resolution) * level.height)) / 2 / (this.app.screen.height * resolution);
      const tint = goalTint(level.getExitBlock().color, active, floor?.animationT ?? 0,
        player && this.world?.levelName === "hub" && !this.world.buttonsSatisfied, fraction, this.world?.delayFinishGlow);
      for (const strip of goalStrips(rect, resolution)) {
        if (strip.width > 0 && strip.height > 0) graphics.rect(strip.x, strip.y, strip.width, strip.height).fill(tint);
      }
      if (player) graphics.rect(cell.x, cell.y, cell.width, cell.height).fill({
        ...tint, texture: rect.width * resolution > 200 ? this.textures.playerButtonEyes : this.textures.playerButtonEyesSmall,
        textureSpace: "local",
      });
      return;
    }

    if (type === FloorType.LevelPortal) {
      graphics.setFillStyle({ color: 0xffffff, alpha: 1 });
      const cell = originalDrawRect(rect, this.app.renderer.resolution);
      const texture = this.textures.portalThumbnails[floor?.sceneName ?? ''] ?? Texture.WHITE;
      if (floor?.hard) {
        graphics.texture(Texture.WHITE, guiHsvColor(floor.hard === 2
          ? { h: .53, s: 1, v: 1 } : { h: 0, s: .9, v: .8 }),
          cell.x, cell.y, cell.width, cell.height);
      }
      const inner = floor?.hard ? originalDrawRect({
        x: rect.x + rect.width * .1, y: rect.y + rect.height * .1,
        width: rect.width * .8, height: rect.height * .8,
      }, this.app.renderer.resolution) : cell;
      graphics.texture(texture, floor && !floor.won && !floor.unlocked ? 0x292929 : 0xffffff,
        inner.x, inner.y, inner.width, inner.height);
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
    flipH: boolean,
  ): void {
    if(this.world?.drawStyle===DrawStyle.QuickAnim){
      const snapped=originalDrawRect(rect,this.app.renderer.resolution);
      if(snapped.width<=0||snapped.height<=0)return;
      const texture=level.filledWithWalls?this.textures.quickBlock:Texture.WHITE;
      texture.source.style.addressMode="clamp-to-edge";
      graphics.texture(texture,color,snapped.x,snapped.y,snapped.width,snapped.height);
      return;
    }
    const textures = flipH ? this.textures.wallsFlip : this.textures.walls;
    const index = autotileIndex(level, block, flipH);
    const large = largeWallQuads(index, rect, this.app.renderer.resolution);
    if (large) {
      const family = flipH ? this.textures.wallsBigFlip : this.textures.wallsBig;
      for (const quad of large) {
        const texture = family[quad.textureIndex];
        if (!texture || quad.rect.width <= 0 || quad.rect.height <= 0) continue;
        texture.source.style.addressMode = "clamp-to-edge";
        graphics.texture(texture, color, quad.rect.x, quad.rect.y, quad.rect.width, quad.rect.height);
      }
      return;
    }
    const texture = textures[index];
    if (!texture) return;
    const snapped = originalDrawRect(rect, this.app.renderer.resolution);
    if (snapped.width <= 0 || snapped.height <= 0) return;
    // Graphics texture fills force repeat addressing, which bleeds the opposite
    // edge under bilinear sampling. A direct quad retains Unity's clamp rule.
    texture.source.style.addressMode = "clamp-to-edge";
    graphics.texture(texture, color, snapped.x, snapped.y, snapped.width, snapped.height);
  }

  private drawBlock(
    graphics: Graphics,
    block: Block,
    rect: Rect,
    depth: number,
    ancestors: Set<Level>,
    flipH: boolean,
    staticRect: Rect = rect,
  ): Graphics {
    // ProcessTicket refuses the entire child backing/face ticket at depth15.
    if (depth + 1 >= 15) return graphics;
    const filledBlockColor = hsvToRgb(block.color);
    const subLevel = block.subLevel;
    const terminal = !subLevel;

    if (terminal) {
      graphics
        .rect(rect.x, rect.y, rect.width, rect.height)
        .fill(filledBlockColor);
      if (this.world?.drawStyle !== DrawStyle.QuickAnim || isInfinityBorder(block)) {
        drawBlockBorder(graphics, block, rect, staticRect, flipH !== block.flipH,
          this.app.screen.width, this.app.screen.height, this.app.renderer?.resolution ?? 1, this.elapsed ?? 0);
      }
    } else if (subLevel) {
      graphics = this.drawLevel(
        graphics, subLevel, block, rect, depth + 1, ancestors, flipH !== block.flipH, staticRect,
      );
    }

    if (block.isPlayer || block.possessable) this.drawFace(graphics, block, rect, false, flipH);
    if (block.flipH || block.fadeFlipH || block.specialEffect===2 || block.specialEffect===3) this.drawFlipShine(graphics,block,rect,flipH!==block.flipH,depth+1);
    return graphics;
  }

  private drawInfEffect(graphics: Graphics, block: Block, rect: Rect,cloneFade=false): void {
    for (const glyph of infinityGlyphQuads(block, rect, this.app.screen.height, this.app.renderer?.resolution ?? 1,cloneFade,this.world?cameraTransitionPhase(this.world):1)) {
      if (glyph.rect.width <= 0 || glyph.rect.height <= 0 || glyph.alpha <= 0) continue;
      graphics.rect(glyph.rect.x, glyph.rect.y, glyph.rect.width, glyph.rect.height).fill({
        texture: this.textures[glyph.texture], textureSpace: "local", color: 0xffffff, alpha: glyph.alpha,
      });
    }
  }

  private drawFace(
    graphics: Graphics, block: Block, rect: Rect, facePhantom = false, flipH = false,cloneFade=false,
  ): void {
    if (this.world?.drawStyle === DrawStyle.QuickAnim) return;
    for (const eye of faceQuads(block, rect, this.app.screen.height, flipH, this.app.renderer?.resolution ?? 1, facePhantom,cloneFade,this.world?cameraTransitionPhase(this.world):1)) {
      if (eye.rect.width <= 0 || eye.rect.height <= 0) continue;
      graphics.rect(eye.rect.x, eye.rect.y, eye.rect.width, eye.rect.height).fill({
        texture: this.textures[eye.texture], textureSpace: "local", color: 0x000000, alpha: eye.alpha,
      });
    }
  }

  private drawFlipShine(graphics:Graphics,block:Block,rect:Rect,flipH:boolean,depth:number,cloneFade=false):void {
    const band=flipShineQuad(block,rect,this.app.screen.height,flipH,depth,this.world?.drawStyle ?? DrawStyle.Normal,this.app.renderer?.resolution ?? 1,cloneFade,this.world?cameraTransitionPhase(this.world):1);
    if (band) graphics.rect(band.rect.x,band.rect.y,band.rect.width,band.rect.height).fill({color:0xffffff,alpha:band.alpha});
  }

}
