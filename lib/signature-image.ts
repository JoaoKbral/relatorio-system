// Browser-only: turns a photo or scan of a signature into a small transparent PNG
// that prints cleanly over the report's signature lines.

/** Output fits in this box (keeping proportions). ~5:1 like a signature line. */
const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
/** Large inputs are scaled down to this before processing, for speed. */
const MAX_SOURCE_SIDE = 2000;
/** Brightness (0-255) at or above which a pixel becomes fully transparent... */
const WHITE_THRESHOLD = 225;
/** ...and at or below which it stays fully opaque. Between them it fades. */
const INK_THRESHOLD = 140;
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

  // 2. Light pixels become transparent; dark ink stays, with soft edges.
  const image = src.ctx.getImageData(0, 0, w, h);
  const px = image.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    // Brightness as if drawn over white, so already-transparent areas count as paper.
    const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * a + 255 * (1 - a);
    const ink = Math.min(1, Math.max(0, (WHITE_THRESHOLD - lum) / (WHITE_THRESHOLD - INK_THRESHOLD)));
    const alpha = Math.round(ink * 255);
    px[i + 3] = alpha;
    if (alpha > 24) {
      const p = i / 4;
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    throw new SignatureImageError("Nenhuma assinatura encontrada. Use uma imagem com traço escuro em fundo claro.");
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
