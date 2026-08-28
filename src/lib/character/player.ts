/**
 * Plays one character. Knows nothing about the page.
 *
 * The atlas ships as an alpha mask, so the ink color is whatever
 * `currentColor` resolves to on the host element. One file works on the white
 * pages and the dark ones. See docs/character-pipeline.md, decision 02.
 *
 * Everything inside the character is drawn at the manifest's own pixel scale
 * and the whole thing is scaled once with a transform, so a frame change is
 * four style writes and never any arithmetic on a hot path.
 */

export type ClipKind = "locomotion" | "ambient" | "oneshot";

export interface Frame {
  /** Rect in the atlas: x, y, w, h. */
  r: [number, number, number, number];
  /** Where the trimmed art sat inside the untrimmed frame box. */
  o: [number, number];
  /** Face anchor in box coordinates, when the drawing carried a mark. */
  head?: [number, number];
  headAngle?: number;
}

export interface Clip {
  kind: ClipKind;
  loop: boolean;
  fps?: number;
  hold?: number;
  /** Distance covered by one full cycle. Locomotion clips only. */
  stride?: number;
  next?: string;
  face?: boolean;
  /** The untrimmed frame size. Every other coordinate lives in this space. */
  box: [number, number];
  /** Where the soles sit inside box. Placement aligns this to a surface. */
  groundY: number;
  frames: Frame[];
}

export interface Manifest {
  version: number;
  atlas: string;
  atlasSize: [number, number];
  mask: boolean;
  clips: Record<string, Clip>;
}

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Character {
  readonly manifest: Manifest;

  private root: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  private clipName = "";
  private clip: Clip | null = null;
  private frameIndex = -1;

  private distance = 0;
  private elapsed = 0;
  private scale = 1;
  private facing = 1;
  private tilt = 0;

  private constructor(manifest: Manifest) {
    this.manifest = manifest;
  }

  static async load(url: string): Promise<Character> {
    const manifest: Manifest = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`character manifest ${r.status}`);
      return r.json();
    });

    if (manifest.version !== 1)
      throw new Error(`character manifest version ${manifest.version} unsupported`);

    // Decode before anything is shown, or the first frame arrives late and pops.
    const img = new Image();
    img.src = manifest.atlas;
    await img.decode().catch(() => {
      /* A missing atlas leaves the character empty. Nothing else breaks. */
    });

    return new Character(manifest);
  }

  mount(host: HTMLElement) {
    // Only ever remove our own root. The host is somebody else's element and
    // will usually have content in it already, which he stands on top of.
    this.root?.remove();
    host.style.position = host.style.position || "relative";

    const root = document.createElement("div");
    root.style.cssText =
      "position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none";

    const body = document.createElement("i");
    const atlas = `url("${this.manifest.atlas}")`;
    const [aw, ah] = this.manifest.atlasSize;
    body.style.cssText = [
      "position:absolute",
      "display:block",
      `-webkit-mask-image:${atlas}`,
      `mask-image:${atlas}`,
      `-webkit-mask-size:${aw}px ${ah}px`,
      `mask-size:${aw}px ${ah}px`,
      "-webkit-mask-repeat:no-repeat",
      "mask-repeat:no-repeat",
      "background-color:currentColor",
    ].join(";");

    root.append(body);
    host.append(root);
    this.root = root;
    this.body = body;
    if (this.clip) this.draw(0, true);
  }

  /** Display scale. 1 means the manifest's own pixels. */
  setScale(s: number) {
    this.scale = s;
    this.applyTransform();
  }

  /** Which way he looks. -1 mirrors him about his own feet. */
  setFacing(dir: number) {
    const f = dir < 0 ? -1 : 1;
    if (f === this.facing) return;
    this.facing = f;
    this.applyTransform();
  }

  /** Lean him to match the surface he is standing on, in degrees. */
  setTilt(deg: number) {
    if (deg === this.tilt) return;
    this.tilt = deg;
    this.applyTransform();
  }

  /**
   * Show the drawing at `p` of the way through the clip, 0 to 1.
   *
   * `advance` and `tick` accumulate; this does not. A scrubbed animation has
   * to be a pure function of where the reader is on the page, or scrolling
   * back up replays a different sequence than scrolling down did.
   */
  setPhase(p: number) {
    this.draw(((p % 1) + 1) % 1);
  }

  get displayHeight() {
    return this.clip ? this.clip.box[1] * this.scale : 0;
  }

  /** The clip's frame box, in its own pixels. */
  get box(): [number, number] {
    return this.clip ? this.clip.box : [0, 0];
  }

  /** Where his soles sit inside that box. */
  get soleY() {
    return this.clip?.groundY ?? 0;
  }

  play(name: string) {
    const clip = this.manifest.clips[name];
    if (!clip) throw new Error(`no clip "${name}"`);
    if (name === this.clipName) return;

    this.clipName = name;
    this.clip = clip;
    this.distance = 0;
    this.elapsed = 0;
    this.frameIndex = -1;
    if (this.root) {
      this.root.style.width = `${clip.box[0]}px`;
      this.root.style.height = `${clip.box[1]}px`;
    }
    this.draw(0, true);
  }

  /**
   * Feed a locomotion clip the distance the body has covered. The cycle is a
   * function of distance, never of time, which is the whole reason feet hold
   * the ground. See docs/character-pipeline.md, decision 05.
   */
  advance(px: number) {
    this.distance += px;
    this.draw(this.phase());
  }

  /** Feed a time driven clip milliseconds. */
  tick(dtMs: number) {
    this.elapsed += dtMs;
    this.draw(this.phase());
  }

  /** Hold one specific drawing. For checking registration frame against frame. */
  showFrame(i: number) {
    if (!this.clip) return;
    const n = this.clip.frames.length;
    this.draw((((i % n) + n) % n + 0.5) / n, true);
  }

  get frameCount() {
    return this.clip?.frames.length ?? 0;
  }

  private phase(): number {
    const c = this.clip;
    if (!c) return 0;
    if (REDUCED) return 0;

    if (c.kind === "locomotion") {
      const stride = c.stride || c.box[0];
      const p = (this.distance / stride) % 1;
      return p < 0 ? p + 1 : p;
    }

    const fps = c.fps ?? 24 / (c.hold ?? 2);
    const raw = (this.elapsed / 1000) * fps / c.frames.length;
    if (!c.loop && raw >= 1) return 1 - 1e-9;
    return ((raw % 1) + 1) % 1;
  }

  /** Position him so his soles land on `groundY`, with `x` at his box origin. */
  place(x: number, groundY: number) {
    this.x = x;
    this.y = groundY - (this.clip?.groundY ?? 0) * this.scale;
    this.applyTransform();
  }

  /**
   * Position him by the point between his feet rather than by his box corner.
   * That point is the only one that stays put through a flip or a lean, so it
   * is the one a path should be written against.
   */
  placeFeet(x: number, groundY: number) {
    this.place(x - (this.clip ? (this.clip.box[0] / 2) * this.scale : 0), groundY);
  }

  private x = 0;
  private y = 0;

  private applyTransform() {
    if (!this.root) return;
    // Flip and lean happen inside the scaled box, about the point between his
    // feet, so neither of them moves him off the surface he is standing on.
    const px = this.clip ? this.clip.box[0] / 2 : 0;
    const py = this.clip ? this.clip.groundY : 0;
    this.root.style.transform =
      `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})` +
      ` translate(${px}px, ${py}px)` +
      ` rotate(${this.tilt}deg) scaleX(${this.facing})` +
      ` translate(${-px}px, ${-py}px)`;
  }

  private draw(phase: number, force = false) {
    const c = this.clip;
    if (!c || !this.body) return;

    const i = Math.min(c.frames.length - 1, Math.floor(phase * c.frames.length));
    if (i === this.frameIndex && !force) return;
    this.frameIndex = i;

    const f = c.frames[i];
    const [rx, ry, rw, rh] = f.r;
    const s = this.body.style;
    s.left = `${f.o[0]}px`;
    s.top = `${f.o[1]}px`;
    s.width = `${rw}px`;
    s.height = `${rh}px`;
    s.webkitMaskPosition = `${-rx}px ${-ry}px`;
    s.maskPosition = `${-rx}px ${-ry}px`;
  }
}
