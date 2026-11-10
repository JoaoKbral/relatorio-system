// Browser-only: turns a photo or scan of a signature into a small transparent PNG
// that prints cleanly over the report's signature lines.

/** Output fits in this box (keeping proportions). ~5:1 like a signature line. */
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
/** Large inputs are scaled down to this before processing, for speed. */
const MAX_SOURCE_SIDE = 2000;
/** Every kept (signature) pixel is painted this one colour. */
const INK_RGB = [0, 0, 0] as const;
/** Paper brightness is averaged over a window of (longest side / this) around each pixel. */
const WINDOW_DIVISOR = 20;
/** A pixel is ink when it is darker than the paper around it by at least this many
 *  brightness levels (0-255)... */
const MIN_CONTRAST = 20;
/** ...and by at least this fraction of the paper's brightness. */
const CONTRAST_RATIO = 0.15;
/** Ink blobs smaller than this fraction of the image are dropped as noise. */
const SPECK_FRACTION = 1 / 100_000;
/** Transparent margin kept around the trimmed signature, in output pixels. */
const PADDING = 4;

export interface ProcessedSignature {
  blob: Blob;
  width: number;
  height: number;
}

export class SignatureImageError extends Error {}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new SignatureImageError("Seu navegador não permite processar imagens.");
  return { canvas, ctx };
}

/**
 * Brightness of the paper around each pixel: the mean over a square window,
 * computed with an integral image so it costs the same for any window size.
 * Comparing a pixel with its own surroundings (not one value for the whole
 * image) is what stops shadows and uneven light from being taken as ink.
 */
function localMean(lum: Uint8Array, w: number, h: number, radius: number): Float32Array {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += lum[y * w + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }
  const mean = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      mean[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return mean;
}

/** Clears ink blobs smaller than `minSize` pixels (paper grain, JPEG noise). */
function removeSpecks(ink: Uint8Array, w: number, h: number, minSize: number) {
  const seen = new Uint8Array(ink.length);
  const stack: number[] = [];
  const blob: number[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    blob.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      blob.push(p);
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (ink[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (blob.length < minSize) for (const p of blob) ink[p] = 0;
  }
}

export async function processSignatureImage(file: File): Promise<ProcessedSignature> {
  if (!file.type.startsWith("image/")) {
    throw new SignatureImageError("Selecione um arquivo de imagem (PNG ou JPG).");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new SignatureImageError("Não foi possível abrir a imagem.");
  }

  // 1. Draw the source, scaled down if huge.
  const srcScale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * srcScale));
  const h = Math.max(1, Math.round(bitmap.height * srcScale));
  const src = canvas2d(w, h);
  src.ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // 2. Reduce the image to two colours. The background is the colour that
  //    appears the most, so each pixel is compared with the average of the
  //    area around it (the local paper colour). A pixel is ink when it differs
  //    enough from that; everything else becomes transparent, and ink is
  //    painted one colour.
  const image = src.ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const total = w * h;
  const lum = new Uint8Array(total);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const a = px[i + 3] / 255;
    // Brightness as if drawn over white, so already-transparent areas count as paper.
    const l = Math.round((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a));
    lum[p] = l;
  }
  const mean = localMean(lum, w, h, Math.max(8, Math.round(Math.max(w, h) / WINDOW_DIVISOR)));
  // Ink stands out from the paper in one direction (dark pen on light paper, or
  // the reverse); whichever direction has more strong outliers is the ink.
  const darker = new Uint8Array(total);
  const lighter = new Uint8Array(total);
  let darkerCount = 0, lighterCount = 0;
  for (let p = 0; p < total; p++) {
    const diff = mean[p] - lum[p];
    if (diff >= Math.max(MIN_CONTRAST, CONTRAST_RATIO * mean[p])) {
      darker[p] = 1;
      darkerCount++;
    } else if (-diff >= Math.max(MIN_CONTRAST, CONTRAST_RATIO * (255 - mean[p]))) {
      lighter[p] = 1;
      lighterCount++;
    }
  }
  const ink = darkerCount >= lighterCount ? darker : lighter;
  removeSpecks(ink, w, h, Math.max(4, Math.round(total * SPECK_FRACTION)));

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    px[i] = INK_RGB[0];
    px[i + 1] = INK_RGB[1];
    px[i + 2] = INK_RGB[2];
    px[i + 3] = ink[p] ? 255 : 0;
    if (ink[p]) {
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    throw new SignatureImageError("Nenhuma assinatura encontrada. Use uma imagem da assinatura sobre um fundo liso.");
  }
  src.ctx.putImageData(image, 0, 0);

  // 3. Trim to the ink, then scale to fit the output box.
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const scale = Math.min(1, (MAX_WIDTH - 2 * PADDING) / cropW, (MAX_HEIGHT - 2 * PADDING) / cropH);
  const outW = Math.round(cropW * scale) + 2 * PADDING;
  const outH = Math.round(cropH * scale) + 2 * PADDING;
  const out = canvas2d(outW, outH);
  out.ctx.imageSmoothingQuality = "high";
  out.ctx.drawImage(src.canvas, minX, minY, cropW, cropH, PADDING, PADDING, outW - 2 * PADDING, outH - 2 * PADDING);

  // 4. Export as PNG (keeps transparency).
  const blob = await new Promise<Blob | null>((resolve) => out.canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new SignatureImageError("Não foi possível gerar a imagem.");
  return { blob, width: outW, height: outH };
}
