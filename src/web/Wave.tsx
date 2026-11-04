import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../app/theme';
import { tabIndex, type Route } from './route';

/**
 * Irregular but unbroken: sines bent by other sines, about -0.85 to 0.85. Hash-based noise is not
 * safe here: on some GPUs its cells disagree by a rounding error at the border, and the line tears.
 */
const NOISE = `
float noise(vec2 p) {
  p *= 3.;
  float a = sin(p.x + p.y + 1.4 * sin(.61 * p.x + .43 * p.y));
  float b = sin(1.37 * p.x - .83 * p.y + 1.9 + 1.1 * sin(.47 * p.x - .71 * p.y + 2.1));
  return (a + b) * .42;
}`;

/**
 * The line depends on height alone, so it is worked out per row of a mesh and only interpolated
 * across the screen. That leaves the fragment shader little to do, which phones are grateful for.
 */
const VERT = `
precision highp float;
attribute vec2 a;
uniform vec2 uRes;
uniform float uT, uZoom, uBase, uAmp, uBulge, uSweep, uSweepAt, uThick;
uniform vec3 uPtr;
varying float vCenter, vSlope, vWidth, vOffset, vWidth2, vLobe, vFocus, vY;
${NOISE}

// Where the ribbon runs at height y, in screen heights from its base.
float line(float y) {
  float t = uT * .7;
  float w = y + .06 * noise(vec2(y * 2.1, t * .2));
  float c = .100 * noise(vec2(w * 1.5, t * .15 + 3.))
          + .050 * noise(vec2(w * 3.1 + 7., t * .25))
          + .012 * noise(vec2(w * 4.8 + 2., t * .34));
  // A fold now and then: a rounded absolute value leaves soft creases in the edge.
  float n = noise(vec2(w * 2.2 + 4., t * .2));
  c += .045 * (sqrt(n * n + .012) - .35);
  c *= uAmp;
  float b = y - .46;
  c += uBulge * exp(-b * b * 14.);
  c -= uSweep * smoothstep(uSweepAt, uSweepAt + .9, y);
  float q = y - uPtr.y;
  c += uPtr.x * uPtr.z * .035 * exp(-q * q * 18.);
  return c;
}

void main() {
  gl_Position = vec4(a, 0., 1.);
  float base = uBase * uRes.x / uRes.y;
  float y = (.5 - a.y * .5 - .46) / uZoom + .46;
  float t = uT * .7;
  float e = .004;
  vY = y;
  // The pull-back is centred on the line itself, otherwise it flies in from the side.
  vFocus = base + line(.46);
  vCenter = base + line(y);
  vSlope = (line(y + e) - line(y - e)) / (2. * e);
  vWidth = uThick * max(.03, .066 * (1. + .5 * noise(vec2(y * 2.2, t * .22 + 11.)) + .16 * noise(vec2(y * 4.6, t * .3 + 5.))));
  vWidth2 = vWidth * (.62 + .2 * noise(vec2(y * 3.1 + 8., t * .3)));
  vOffset = uThick * (.03 + .055 * noise(vec2(y * 2.2 + 20., t * .31)));
  vLobe = noise(vec2(y * 3.5 + 13., t * .32));
}`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uT, uZoom, uIn, uTheme, uDim, uGlow, uRib;
varying float vCenter, vSlope, vWidth, vOffset, vWidth2, vLobe, vFocus, vY;
${NOISE}

float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes.y;
  uv.y = 1. - uv.y;

  // Fluted glass in front of the light: thin vertical ribs that bend it a little.
  float rib = fract(uv.x * uRib);
  float x = (uv.x - vFocus) / uZoom + vFocus + (rib - .5) * .0016;
  float d = (x - vCenter) / sqrt(1. + vSlope * vSlope);

  // Two strands that drift over each other, with streaks running along them like folds of silk.
  float one = d / vWidth;
  float two = (d - vOffset) / vWidth2;
  float folds = noise(vec2(d * 9. + vLobe * 1.5, vY * 3. + uT * .24));
  float fine = noise(vec2(d * 19. - 1., vY * 4.6 - uT * .18 + 4.));
  float ribbon = max(exp(-one * one), .82 * exp(-two * two)) * (.9 + .17 * folds + .04 * fine);

  // The light spills to the right in slow uneven lobes and stops sharply on the left.
  float side = d > 0. ? exp(-d / (.115 + .055 * vLobe)) : exp(d / .034);
  float spill = side * (.5 + .16 * vLobe);
  float v = (1. - (1. - ribbon) * (1. - spill)) * (1. + uGlow * .25);
  v *= 1. - uDim * .46;

  float left = pow(clamp(1. - uv.x / aspect, 0., 1.), 3.);
  float top = pow(clamp(1. - uv.y, 0., 1.), 2.);

  vec3 dark = vec3(.004, .009, .016) + vec3(.016, .055, .10) * left * (.45 + .55 * top);
  dark = mix(dark, vec3(.02, .075, .15), smoothstep(.0, .24, v));
  dark = mix(dark, vec3(.16, .36, .60), smoothstep(.2, .5, v));
  dark = mix(dark, vec3(.66, .82, .96), smoothstep(.44, .72, v));
  dark = mix(dark, vec3(.975, .988, 1.), smoothstep(.76, .96, v));
  dark *= 1. + .02 * sin(rib * 6.2832) * (1. - v);

  vec3 light = vec3(.925, .953, .99) + vec3(-.05, -.025, 0.) * left * (.5 + .5 * top);
  light = mix(light, vec3(.70, .84, 1.), smoothstep(.0, .24, v));
  light = mix(light, vec3(.24, .56, 1.), smoothstep(.18, .5, v));
  light = mix(light, vec3(.05, .31, .95), smoothstep(.45, .76, v));
  light = mix(light, vec3(.20, .72, 1.), smoothstep(.8, .98, v));
  light *= 1. + .008 * sin(rib * 6.2832) * (1. - v);

  vec3 col = mix(dark, light, uTheme);
  vec3 bg = mix(vec3(.004, .009, .016), vec3(.925, .953, .99), uTheme);
  col = mix(bg, col, uIn);
  // A hair of grain, otherwise the long dark gradients break into bands.
  col += (grain(gl_FragCoord.xy + fract(uT)) - .5) / 170.;
  gl_FragColor = vec4(col, 1.);
}`;

/** Portrait: the line comes down from the top right and leaves through the left side, above the card. */
const PORTRAIT = '(max-aspect-ratio: 21/20)';
const DESKTOP_X = [0.44, 0.27, 0.66, 0.16, 0.8];
const PHONE_X = [0.66, 0.34, 0.82, 0.2, 0.5];

/** Length of the opening pull-back, seconds, and how close to the line it starts. */
const ENTRY = 2.2;
const ENTRY_ZOOM = 6;
/** Rows of the mesh the line is computed on. */
const ROWS = 140;

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

/** The living ribbon behind everything: two shaders on a strip mesh, no images, no libraries. */
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
    const mesh = new Float32Array((ROWS + 1) * 4);
    for (let i = 0; i <= ROWS; i++) {
      const y = (i / ROWS) * 2 - 1;
      mesh.set([-1, y, 1, y], i * 4);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(program, n);
    const at = {
      res: u('uRes'), t: u('uT'), zoom: u('uZoom'), in: u('uIn'), theme: u('uTheme'), base: u('uBase'), amp: u('uAmp'), bulge: u('uBulge'),
      sweep: u('uSweep'), sweepAt: u('uSweepAt'), thick: u('uThick'), dim: u('uDim'), glow: u('uGlow'), rib: u('uRib'), ptr: u('uPtr'),
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
      gl.uniform1f(at.t, still ? 40 : 40 + age);
      gl.uniform1f(at.zoom, 1 + (ENTRY_ZOOM - 1) * (1 - pull));
      gl.uniform1f(at.in, Math.min(1, age / 0.3));
      gl.uniform1f(at.theme, live.current.theme === 'light' ? 1 : 0);
      gl.uniform1f(at.base, base);
      gl.uniform1f(at.amp, tall ? 0.6 : 1);
      gl.uniform1f(at.bulge, tall ? 0.05 : 0.12);
      gl.uniform1f(at.sweep, tall ? 0.95 : 0.3);
      gl.uniform1f(at.sweepAt, tall ? 0.04 : 0.62);
      gl.uniform1f(at.thick, tall ? 0.8 : 1);
      gl.uniform1f(at.dim, dim);
      gl.uniform1f(at.glow, glow);
      gl.uniform3f(at.ptr, ptr.x, ptr.y, ptr.k);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (ROWS + 1) * 2);
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
