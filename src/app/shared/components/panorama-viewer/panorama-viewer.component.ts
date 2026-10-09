import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

const VERT = `#version 300 es
in vec2 p;
out vec2 v;
void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }`;

/** Chaque pixel de l'écran lance un rayon, tourné selon (yaw, pitch), converti en coordonnées équirectangulaires. */
const FRAG = `#version 300 es
precision highp float;
in vec2 v;
out vec4 o;
uniform sampler2D t;
uniform vec2 res;
uniform float yaw;
uniform float pitch;
uniform float fov;
const float PI = 3.14159265359;
void main() {
  float tf = tan(fov * 0.5);
  vec3 d = normalize(vec3(v.x * (res.x / res.y) * tf, v.y * tf, -1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  o = vec4(texture(t, vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI)).rgb, 1.0);
}`;

const FOV_MIN = (30 * Math.PI) / 180;
const FOV_MAX = (100 * Math.PI) / 180;
const PITCH_MAX = (85 * Math.PI) / 180;
const TEXTURE_MAX_SIDE = 8192;

/**
 * Visionneuse de photo panoramique équirectangulaire (360° x 180°) :
 * glisser pour regarder autour, molette ou pincement pour zoomer, flèches du clavier.
 * Sans WebGL 2, l'image est affichée à plat.
 */
@Component({
  selector: 'app-panorama-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="relative w-full h-full bg-[#0F1A2B] rounded-xl overflow-hidden select-none">
      @if (state() === 'flat') {
        <img [src]="src()" [alt]="titre() || 'Photo panoramique'" class="w-full h-full object-contain" />
        <p class="absolute left-3 bottom-3 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px]">
          Affichage 360° indisponible sur cet appareil : image à plat.
        </p>
      } @else {
        <canvas
          #canvas
          class="w-full h-full block touch-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          tabindex="0"
          role="img"
          [attr.aria-label]="'Panorama 360° ' + (titre() || '') + ' : glissez ou utilisez les flèches du clavier pour regarder autour'"
          (keydown)="onKey($event)"
        ></canvas>
      }

      @if (state() === 'loading') {
        <div class="absolute inset-0 flex items-center justify-center text-xs text-white/80 bg-[#0F1A2B]">Chargement du panorama…</div>
      }
      @if (state() === 'error') {
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-xs text-white/85 bg-[#0F1A2B]" role="alert">
          <span>{{ errorMessage() }}</span>
          <a [href]="src()" target="_blank" rel="noopener noreferrer" class="underline text-[#F2B27A]">Ouvrir l'image dans un onglet</a>
        </div>
      }

      @if (state() === 'ready') {
        <div class="absolute right-3 top-3 flex flex-col gap-1.5">
          <button type="button" (click)="zoom(-1)" class="w-8 h-8 rounded-lg bg-black/55 hover:bg-black/75 text-white text-base cursor-pointer" aria-label="Zoom avant">+</button>
          <button type="button" (click)="zoom(1)" class="w-8 h-8 rounded-lg bg-black/55 hover:bg-black/75 text-white text-base cursor-pointer" aria-label="Zoom arrière">−</button>
          <button type="button" (click)="toggleAuto()" [attr.aria-pressed]="autoRotate()"
                  class="w-8 h-8 rounded-lg text-white text-xs cursor-pointer"
                  [class]="autoRotate() ? 'bg-brand-primary' : 'bg-black/55 hover:bg-black/75'"
                  aria-label="Rotation automatique" title="Rotation automatique">↻</button>
          <button type="button" (click)="reset()" class="w-8 h-8 rounded-lg bg-black/55 hover:bg-black/75 text-white text-xs cursor-pointer" aria-label="Recentrer la vue" title="Recentrer">⌖</button>
          <button type="button" (click)="fullscreen()" class="w-8 h-8 rounded-lg bg-black/55 hover:bg-black/75 text-white text-xs cursor-pointer" aria-label="Plein écran" title="Plein écran">⛶</button>
        </div>
        <p class="absolute left-3 bottom-3 px-2.5 py-1 rounded-lg bg-black/55 text-white text-[11px] pointer-events-none">
          Glissez pour regarder autour · molette pour zoomer
        </p>
      }
    </div>
  `,
})
export class PanoramaViewerComponent implements AfterViewInit, OnDestroy {
  readonly src = input.required<string>();
  readonly titre = input<string>('');

  readonly state = signal<'loading' | 'ready' | 'error' | 'flat'>('loading');
  readonly errorMessage = signal<string>('');
  readonly autoRotate = signal<boolean>(false);

  private readonly zone = inject(NgZone);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly viewReady = signal(false);

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private yaw = 0;
  private pitch = 0;
  private fov = (75 * Math.PI) / 180;
  private vYaw = 0;
  private vPitch = 0;
  private raf = 0;
  private dirty = true;
  private resizeObserver?: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private loadToken = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor() {
    effect(() => {
      const url = this.src();
      if (!this.viewReady()) return;
      untracked(() => this.charger(url));
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ------------------------------------------------------------------ Chargement

  private charger(url: string): void {
    const token = ++this.loadToken;
    this.state.set('loading');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (token !== this.loadToken) return;
      this.afficher(image);
    };
    image.onerror = () => {
      if (token !== this.loadToken) return;
      this.errorMessage.set("Impossible de charger l'image du panorama.");
      this.state.set('error');
    };
    image.src = url;
  }

  private afficher(image: HTMLImageElement): void {
    // Le canvas n'existe dans le DOM que hors du mode « image à plat » : on tente WebGL 2 d'abord.
    if (!this.gl && !this.initGL()) {
      this.state.set('flat');
      return;
    }
    const gl = this.gl!;
    const maxSide = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, TEXTURE_MAX_SIDE);
    let source: TexImageSource = image;
    if (image.naturalWidth > maxSide || image.naturalHeight > maxSide) {
      const ratio = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight);
      const reduit = document.createElement('canvas');
      reduit.width = Math.max(1, Math.floor(image.naturalWidth * ratio));
      reduit.height = Math.max(1, Math.floor(image.naturalHeight * ratio));
      reduit.getContext('2d')!.drawImage(image, 0, 0, reduit.width, reduit.height);
      source = reduit;
    }
    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.reset();
    this.state.set('ready');
    this.demanderRendu();
  }

  private initGL(): boolean {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return false;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false }) as WebGL2RenderingContext | null;
    if (!gl) return false;

    const compile = (type: number, code: string): WebGLShader | null => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const name of ['t', 'res', 'yaw', 'pitch', 'fov']) this.uniforms[name] = gl.getUniformLocation(program, name);
    this.gl = gl;
    this.program = program;
    this.brancherInteractions(canvas);
    return true;
  }

  // ------------------------------------------------------------------ Interactions

  private brancherInteractions(canvas: HTMLCanvasElement): void {
    this.zone.runOutsideAngular(() => {
      const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
        canvas.addEventListener(type, fn as EventListener, options);
        this.cleanups.push(() => canvas.removeEventListener(type, fn as EventListener));
      };

      on('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.vYaw = this.vPitch = 0;
        this.arreterAuto();
        if (this.pointers.size === 2) this.pinchDistance = this.distanceDoigts();
      });
      on('pointermove', (e) => {
        const prev = this.pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size === 1) {
          const k = this.fov / canvas.clientHeight;
          this.vYaw = -dx * k;
          this.vPitch = dy * k;
          this.deplacer(this.vYaw, this.vPitch);
        } else if (this.pointers.size === 2) {
          const d = this.distanceDoigts();
          if (this.pinchDistance > 0 && d > 0) this.fov = this.borner(this.fov * (this.pinchDistance / d), FOV_MIN, FOV_MAX);
          this.pinchDistance = d;
          this.demanderRendu();
        }
      });
      const fin = (e: PointerEvent) => {
        this.pointers.delete(e.pointerId);
        this.pinchDistance = 0;
        if (this.pointers.size === 0) this.demanderRendu(); // lance l'inertie
      };
      on('pointerup', fin);
      on('pointercancel', fin);
      on('wheel', (e) => {
        e.preventDefault();
        this.arreterAuto();
        this.fov = this.borner(this.fov * (1 + e.deltaY * 0.001), FOV_MIN, FOV_MAX);
        this.demanderRendu();
      }, { passive: false });

      this.resizeObserver = new ResizeObserver(() => {
        this.ajusterTaille();
        this.demanderRendu();
      });
      this.resizeObserver.observe(this.host().nativeElement);
      this.ajusterTaille();
    });
  }

  onKey(e: KeyboardEvent): void {
    const pas = this.fov * 0.1;
    switch (e.key) {
      case 'ArrowLeft': this.deplacer(-pas, 0); break;
      case 'ArrowRight': this.deplacer(pas, 0); break;
      case 'ArrowUp': this.deplacer(0, pas); break;
      case 'ArrowDown': this.deplacer(0, -pas); break;
      case '+': case '=': this.zoom(-1); break;
      case '-': this.zoom(1); break;
      default: return;
    }
    e.preventDefault();
    this.arreterAuto();
  }

  // ------------------------------------------------------------------ Commandes (boutons)

  zoom(sens: number): void {
    this.fov = this.borner(this.fov * (sens > 0 ? 1.15 : 1 / 1.15), FOV_MIN, FOV_MAX);
    this.demanderRendu();
  }

  toggleAuto(): void {
    this.autoRotate.update((v) => !v);
    this.demanderRendu();
  }

  reset(): void {
    this.yaw = 0;
    this.pitch = 0;
    this.fov = (75 * Math.PI) / 180;
    this.vYaw = this.vPitch = 0;
    this.demanderRendu();
  }

  fullscreen(): void {
    const el = this.host().nativeElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  // ------------------------------------------------------------------ Rendu

  private deplacer(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = this.borner(this.pitch + dPitch, -PITCH_MAX, PITCH_MAX);
    this.demanderRendu();
  }

  private arreterAuto(): void {
    if (this.autoRotate()) this.zone.run(() => this.autoRotate.set(false));
  }

  private demanderRendu(): void {
    this.dirty = true;
    if (this.raf || !this.gl) return;
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(() => this.boucle());
    });
  }

  private boucle(): void {
    this.raf = 0;
    const gl = this.gl;
    if (!gl || !this.program || this.state() !== 'ready' && this.state() !== 'loading') return;

    // Inertie après un glisser, rotation automatique sinon.
    const libre = this.pointers.size === 0;
    if (libre && (Math.abs(this.vYaw) > 0.00005 || Math.abs(this.vPitch) > 0.00005)) {
      this.vYaw *= 0.92;
      this.vPitch *= 0.92;
      this.yaw += this.vYaw;
      this.pitch = this.borner(this.pitch + this.vPitch, -PITCH_MAX, PITCH_MAX);
      this.dirty = true;
    } else if (libre && this.autoRotate()) {
      this.yaw += 0.003;
      this.dirty = true;
    }

    if (this.dirty && this.texture) {
      this.dirty = false;
      const canvas = gl.canvas as HTMLCanvasElement;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.uniforms['t'], 0);
      gl.uniform2f(this.uniforms['res'], canvas.width, canvas.height);
      gl.uniform1f(this.uniforms['yaw'], this.yaw);
      gl.uniform1f(this.uniforms['pitch'], this.pitch);
      gl.uniform1f(this.uniforms['fov'], this.fov);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const continuer = this.dirty || (libre && (this.autoRotate() || Math.abs(this.vYaw) > 0.00005 || Math.abs(this.vPitch) > 0.00005));
    if (continuer) this.demanderRendu();
  }

  private ajusterTaille(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private distanceDoigts(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private borner(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
  }
}
