// Browser-only: turns a photo or scan of a signature into a small transparent PNG
// that prints cleanly over the report's signature lines.

/** Output fits in this box (keeping proportions). ~5:1 like a signature line. */
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
/** Large inputs are scaled down to this before processing, for speed. */
const MAX_SOURCE_SIDE = 2000;
/** Every kept (signature) pixel is painted this one colour. */
const INK_RGB = [0, 0, 0] as const;
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

/** Otsu's method: the brightness that best splits the histogram into two groups. */
function otsuThreshold(hist: number[], total: number): number {
  let sumAll = 0;
  for (let l = 0; l < 256; l++) sumAll += l * hist[l];
  let sumDark = 0, countDark = 0, best = 0, bestVar = -1;
  for (let t = 0; t < 256; t++) {
    countDark += hist[t];
    if (countDark === 0) continue;
    const countLight = total - countDark;
    if (countLight === 0) break;
    sumDark += t * hist[t];
    const meanDark = sumDark / countDark;
    const meanLight = (sumAll - sumDark) / countLight;
    const between = countDark * countLight * (meanDark - meanLight) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
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

  // 2. Reduce the image to two colours: split pixels into a light and a dark
  //    group by brightness (Otsu's threshold), then remove whichever group is
  //    larger (the background) and paint the other one solid ink.
  const image = src.ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const total = w * h;
  const lum = new Uint8Array(total);
  const hist = new Array<number>(256).fill(0);
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const a = px[i + 3] / 255;
    // Brightness as if drawn over white, so already-transparent areas count as paper.
    const l = Math.round((0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a));
    lum[p] = l;
    hist[l]++;
  }
  const threshold = otsuThreshold(hist, total);
  let darkCount = 0;
  for (let l = 0; l <= threshold; l++) darkCount += hist[l];
  // The colour that appears the most is the background; the rest is the signature.
  const inkIsDark = darkCount <= total - darkCount;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const isInk = inkIsDark ? lum[p] <= threshold : lum[p] > threshold;
    px[i] = INK_RGB[0];
    px[i + 1] = INK_RGB[1];
    px[i + 2] = INK_RGB[2];
    px[i + 3] = isInk ? 255 : 0;
    if (isInk) {
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
