import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../app/theme';
import { tabIndex, type Route } from './route';

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT, uZoom, uIn, uTheme, uBase, uAmp, uBulge, uSweep, uSweepAt, uDim, uGlow, uRib;
uniform vec3 uPtr;

// Where the line runs at height y, in screen heights from its base.
float line(float y) {
  float t = uT;
  float w = y + .07 * sin(y * 2.3 + t * .11 + 1.7) + .04 * sin(y * 4.1 - t * .09);
  float c = .085 * sin(w * 2.6 + t * .16 + .6)
          + .050 * sin(w * 4.7 - t * .21 + 2.2)
          + .024 * sin(w * 8.3 + t * .27 + 4.1 + 1.4 * sin(t * .07))
          + .012 * sin(w * 13.1 - t * .33 + .4);
  c *= uAmp;
  float b = y - .46;
  c += uBulge * exp(-b * b * 14.);
  c -= uSweep * smoothstep(uSweepAt, uSweepAt + .9, y);
  float q = y - uPtr.y;
  c += uPtr.x * uPtr.z * .035 * exp(-q * q * 18.);
  return c;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes.y;
  uv.y = 1. - uv.y;

  // Fluted glass in front of the light: thin vertical ribs that bend it a little.
  float rib = fract(uv.x * uRib);
  // The pull-back is centred on the line itself, otherwise it flies in from the side.
  vec2 focus = vec2(uBase * aspect + line(.46), .46);
  vec2 p = (uv - focus) / uZoom + focus;
  p.x += (rib - .5) * .0016;

  float e = .004;
  float slope = (line(p.y + e) - line(p.y - e)) / (2. * e);
  float d = (p.x - uBase * aspect - line(p.y)) / sqrt(1. + slope * slope);

  float width = .042 * (1. + .26 * sin(p.y * 3.3 + uT * .19) + .16 * sin(p.y * 7. - uT * .13));
  float core = exp(-d * d / (width * width));
  float side = d > 0. ? exp(-d / .125) : exp(d / .05);
  float breath = .97 + .03 * sin(uT * .4);
  float v = (1. - (1. - core) * (1. - .62 * side)) * breath * (1. + uGlow * .25);
  v *= 1. - uDim * .34;

  float left = pow(clamp(1. - uv.x / aspect, 0., 1.), 3.);
  float top = pow(clamp(1. - uv.y, 0., 1.), 2.);

  vec3 dark = vec3(.006, .012, .026) + vec3(.012, .05, .105) * left * (.45 + .55 * top);
  dark = mix(dark, vec3(.025, .115, .27), smoothstep(.0, .24, v));
  dark = mix(dark, vec3(.12, .40, .80), smoothstep(.2, .5, v));
  dark = mix(dark, vec3(.62, .84, 1.), smoothstep(.44, .72, v));
  dark = mix(dark, vec3(1.), smoothstep(.72, .95, v));
  dark *= 1. + .02 * sin(rib * 6.2832) * (1. - v);

  vec3 light = vec3(.925, .953, .99) + vec3(-.05, -.025, 0.) * left * (.5 + .5 * top);
  light = mix(light, vec3(.70, .84, 1.), smoothstep(.0, .24, v));
  light = mix(light, vec3(.24, .56, 1.), smoothstep(.18, .5, v));
  light = mix(light, vec3(.05, .31, .95), smoothstep(.45, .76, v));
  light = mix(light, vec3(.20, .72, 1.), smoothstep(.8, .98, v));
  light *= 1. + .008 * sin(rib * 6.2832) * (1. - v);

  vec3 col = mix(dark, light, uTheme);
  vec3 bg = mix(vec3(.006, .012, .026), vec3(.925, .953, .99), uTheme);
  col = mix(bg, col, uIn);
  // A hair of grain, otherwise the long dark gradients break into bands.
  col += (hash(gl_FragCoord.xy + fract(uT)) - .5) / 170.;
  gl_FragColor = vec4(col, 1.);
}`;

/** Portrait: the line comes down from the top right and leaves through the left side, above the card. */
const PORTRAIT = '(max-aspect-ratio: 21/20)';
const DESKTOP_X = [0.44, 0.27, 0.66, 0.16, 0.8];
const PHONE_X = [0.66, 0.34, 0.82, 0.2, 0.5];

/** Length of the opening pull-back, seconds, and how close to the line it starts. */
const ENTRY = 2.2;
const ENTRY_ZOOM = 6;

let glow = 0;
/** A short brightening of the line, for moments worth marking. */
export const pulseWave = () => {
  glow = 1;
};

function shader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

/** The living line behind everything: one fragment shader, no images, no libraries. */
export function Wave({ route }: { route: Route }) {
  const { theme } = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ theme, route });
  live.current = { theme, route };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) {
      setFailed(true);
      return;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(program, 0, 'a');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(program, n);
    const at = {
      res: u('uRes'), t: u('uT'), zoom: u('uZoom'), in: u('uIn'), theme: u('uTheme'), base: u('uBase'), amp: u('uAmp'), bulge: u('uBulge'),
      sweep: u('uSweep'), sweepAt: u('uSweepAt'), dim: u('uDim'), glow: u('uGlow'), rib: u('uRib'), ptr: u('uPtr'),
    };

    const portrait = matchMedia(PORTRAIT);
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const scale = Math.min(devicePixelRatio || 1, 1.25);
      el.width = Math.round(innerWidth * scale);
      el.height = Math.round(innerHeight * scale);
      gl.viewport(0, 0, el.width, el.height);
      // Ribs stay about 15 CSS pixels wide on any screen.
      gl.uniform1f(at.rib, innerHeight / 15);
    };
    resize();
    addEventListener('resize', resize);

    const ptr = { x: 0, y: 0.5, k: 0, tx: 0, ty: 0.5, tk: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      ptr.tx = e.clientX / innerWidth - 0.5;
      ptr.ty = e.clientY / innerHeight;
      ptr.tk = 1;
    };
    addEventListener('pointermove', onMove);

    let raf = 0;
    let start = 0;
    let last = 0;
    let base = -1;
    let dim = live.current.route === 'home' ? 0 : 1;

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      if (!start) start = last = ms;
      const age = (ms - start) / 1000;
      const dt = Math.min((ms - last) / 1000, 0.05);
      last = ms;

      const tall = portrait.matches;
      const i = tabIndex(live.current.route);
      const target = (tall ? PHONE_X : DESKTOP_X)[i];
      base = base < 0 ? target : base + (target - base) * (1 - Math.exp(-dt * 2.4));
      dim += ((live.current.route === 'home' ? 0 : 1) - dim) * (1 - Math.exp(-dt * 2.4));
      glow *= Math.exp(-dt * 2.2);
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt * 1.6));
      ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt * 1.6));
      ptr.k += (ptr.tk - ptr.k) * (1 - Math.exp(-dt * 1.2));

      const still = calm.matches;
      const pull = still ? 1 : 1 - Math.pow(2, (-9 * age) / ENTRY);
      gl.uniform2f(at.res, el.width, el.height);
      gl.uniform1f(at.t, (still ? 40 : 40 + age));
      gl.uniform1f(at.zoom, 1 + (ENTRY_ZOOM - 1) * (1 - pull));
      gl.uniform1f(at.in, Math.min(1, age / 0.3));
      gl.uniform1f(at.theme, live.current.theme === 'light' ? 1 : 0);
      gl.uniform1f(at.base, base);
      gl.uniform1f(at.amp, tall ? 0.55 : 1);
      gl.uniform1f(at.bulge, tall ? 0.05 : 0.1);
      gl.uniform1f(at.sweep, tall ? 0.95 : 0.26);
      gl.uniform1f(at.sweepAt, tall ? 0.04 : 0.62);
      gl.uniform1f(at.dim, dim);
      gl.uniform1f(at.glow, glow);
      gl.uniform3f(at.ptr, ptr.x, ptr.y, ptr.k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
    };
  }, []);

  return failed ? <div className="wave wave--flat" aria-hidden="true" /> : <canvas ref={canvas} className="wave" aria-hidden="true" />;
}
