/** Client-side image preparation and offline OCR helpers. */

const MAX_OCR_SIZE = 1600;

export type PreparedImage = {
  blob: Blob;
  previewUrl: string;
  ocrBase64: string;
};

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be opened as an image. Please use a JPG or PNG photo."));
    };
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Downscale the original image to max 1600px JPEG 0.85 and return its base64 (no data URL prefix). */
export async function prepareImage(blob: Blob): Promise<PreparedImage> {
  const img = await loadImage(blob);
  const canvas = drawScaled(img, MAX_OCR_SIZE);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    ocrBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
  };
}

/** Small JPEG data URL used as a library thumbnail. */
export async function makeThumbnail(blob: Blob): Promise<string> {
  const img = await loadImage(blob);
  const canvas = drawScaled(img, 320);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** Grayscale + mild contrast (1.3), applied only to the offline OCR input. */
export function preprocessForOfflineOcr(blob: Blob): Promise<HTMLCanvasElement> {
  return loadImage(blob).then((img) => {
    const canvas = drawScaled(img, MAX_OCR_SIZE);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process this image.");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const contrast = 1.3;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let v = (gray - 128) * contrast + 128;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  });
}

/** Browser Tesseract.js v5 OCR with the best available Kannada trained data. */
export async function runOfflineOcr(canvas: HTMLCanvasElement): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("kan", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/",
    langPath: "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0_best",
    gzip: true,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const { data } = await worker.recognize(canvas);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
