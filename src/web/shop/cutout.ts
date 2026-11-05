import { averageColor, trimTransparent } from '../../lib/cutout';
import type { CutoutResult } from '../../lib/cutoutBrowser';
import type { CutReply } from './cut.worker';
import { cleanMask, type Rect } from './mask';

/*
 * A thing found by name, cut out of its picture by ORMBG (Apache-2.0), a salient-object model run by
 * transformers.js in a worker (see cut.worker.ts). The model is downloaded once and cached.
 */

export type CutStage = 'model' | 'cut';

const MAX_SIDE = 768;
let worker: Worker | null = null;
let nextId = 0;

function segment(blob: Blob, onStage?: (stage: CutStage, share: number) => void): Promise<ImageData> {
  worker ??= new Worker(new URL('./cut.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<CutReply>) => {
      const m = e.data;
      if (m.id !== id) return;
      if ('stage' in m) return onStage?.(m.stage, m.share);
      w.removeEventListener('message', onMessage);
      if ('error' in m) reject(new Error(m.error));
      else resolve(new ImageData(new Uint8ClampedArray(m.data), m.width, m.height));
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ id, blob });
  });
}

/** Crops the model's output to the object; null when it found nothing or kept everything. */
async function fromMask(img: ImageData, clear?: Rect[]): Promise<CutoutResult | null> {
  const share = cleanMask(img, clear);
  if (share < 0.02 || share > 0.97) return null;

  const t = trimTransparent(img);
  const full = document.createElement('canvas');
  full.width = t.width;
  full.height = t.height;
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(t.data), t.width, t.height), 0, 0);
  const k = Math.min(1, MAX_SIDE / Math.max(t.width, t.height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(t.width * k));
  out.height = Math.max(1, Math.round(t.height * k));
  out.getContext('2d')!.drawImage(full, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/webp', 0.9));
  return blob && { blob, tint: averageColor(t), removed: true };
}

/**
 * Straight to the model. The flood fill leaves torn edges on the soft gradient behind a 3D render,
 * so pictures found by name skip it. Null when the model found nothing it could lift out.
 */
export async function cutOutByModel(blob: Blob): Promise<CutoutResult | null> {
  return fromMask(await segment(blob));
}

/** How much of its own frame a cut-out fills, 0…1: a hose and a handle with air between them is low. */
export async function solidShare(blob: Blob): Promise<number> {
  const SIDE = 48;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, SIDE, SIDE);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, SIDE, SIDE);
  let solid = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 128) solid++;
  return solid / (SIDE * SIDE);
}

