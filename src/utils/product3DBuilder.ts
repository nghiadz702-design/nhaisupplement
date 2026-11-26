import * as THREE from 'three';
import { formatVND } from '../data/catalog';
import type { Product, ProductFlavor } from '../types/product';
import {
  getProductTransparencyInfo,
  getRealPhysicalDimensions,
  getRealSizeLabel,
  type RealPhysicalDimensions,
} from './productTransparency';

export { getRealPhysicalDimensions, getRealSizeLabel, type RealPhysicalDimensions };

export interface RealProductVisualAssets {
  cutoutTexture: THREE.CanvasTexture;
  bodyWrapTexture: THREE.CanvasTexture;
  solidFrontTexture: THREE.CanvasTexture;
  cutoutCanvas: HTMLCanvasElement;
  aspectRatio: number;
  bodyColorHex: string;
  capColorHex: string;
  isLightPalette: boolean;
  disposables: Array<{ dispose: () => void }>;
}

export interface BuiltPhotoShowcase {
  root: THREE.Group;
  applyRealAssets: (assets: RealProductVisualAssets) => void;
  setLightTint: (brightness: number, rTint?: number, gTint?: number, bTint?: number) => void;
  setRulerVisible: (visible: boolean) => void;
  setFacingBack: (isBack: boolean) => void;
  getRealMeterScale: () => number;
  disposables: Array<{ dispose: () => void }>;
}

function getShowcaseTargetHeight(product: Product): number {
  if (product.shape === 'bar') return 1.48;
  if (product.shape === 'bottle') return 1.94;
  if (product.shape === 'pouch') return 2.08;
  return 2.08;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (
      typeof window !== 'undefined' &&
      src.startsWith('http') &&
      !src.startsWith(window.location.origin)
    ) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getColorLuminance(hex: string): number {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
}

function buildEdgeClampedCanvas(
  sourceCanvas: HTMLCanvasElement,
  baseColorHex: string,
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0);

  // Horizontal edge-clamp extrapolation so angled packshot margins blend seamlessly into 3D corners
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const srcData = sourceCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    const dst = imgData.data;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      let leftX = -1;
      let rightX = -1;
      for (let x = 0; x < w; x++) {
        if (srcData[rowOffset + x * 4 + 3] > 210) {
          leftX = x;
          break;
        }
      }
      for (let x = w - 1; x >= 0; x--) {
        if (srcData[rowOffset + x * 4 + 3] > 210) {
          rightX = x;
          break;
        }
      }

      if (leftX > 0 && rightX > leftX) {
        const lr = srcData[rowOffset + leftX * 4];
        const lg = srcData[rowOffset + leftX * 4 + 1];
        const lb = srcData[rowOffset + leftX * 4 + 2];
        for (let x = 0; x < leftX; x++) {
          const idx = rowOffset + x * 4;
          dst[idx] = lr;
          dst[idx + 1] = lg;
          dst[idx + 2] = lb;
          dst[idx + 3] = 255;
        }

        const rr = srcData[rowOffset + rightX * 4];
        const rg = srcData[rowOffset + rightX * 4 + 1];
        const rb = srcData[rowOffset + rightX * 4 + 2];
        for (let x = rightX + 1; x < w; x++) {
          const idx = rowOffset + x * 4;
          dst[idx] = rr;
          dst[idx + 1] = rg;
          dst[idx + 2] = rb;
          dst[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Keep solid baseColorHex + centered packshot if pixel access fails
  }

  return out;
}

export async function loadRealProductVisuals(
  product: Product,
  flavor: ProductFlavor,
  anisotropy: number,
): Promise<RealProductVisualAssets | null> {
  let img: HTMLImageElement | null = null;
  try {
    img = await loadImageElement(flavor.image);
  } catch {
    if (flavor.fallbackImage && flavor.fallbackImage !== flavor.image) {
      try {
        img = await loadImageElement(flavor.fallbackImage);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

  const maxWorkDim = 896;
  const scaleDown = Math.min(1, maxWorkDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(64, Math.round(img.naturalWidth * scaleDown));
  const h = Math.max(64, Math.round(img.naturalHeight * scaleDown));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) return null;

  workCtx.drawImage(img, 0, 0, w, h);

  let minX = 0;
  let minY = 0;
  let maxX = w - 1;
  let maxY = h - 1;
  let bodyColorHex = '#1c1c21';
  let capColorHex = '#141418';
  let medianBodyAspectRatio = 0.78;

  try {
    const imageData = workCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const total = w * h;
    const removed = new Uint8Array(total);
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let qHead = 0;
    let qTail = 0;

    // Sample 4 corners dynamically to handle pure white (#ffffff) & studio off-white (#efefef) backdrops
    const sampleCoords = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
    ];
    let bgR = 250;
    let bgG = 250;
    let bgB = 250;
    let bgSamples = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (const [cx, cy] of sampleCoords) {
      const o = (cy * w + cx) * 4;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const a = data[o + 3];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      if (a > 200 && lum >= 220 && maxC - minC <= 16) {
        sumR += r;
        sumG += g;
        sumB += b;
        bgSamples++;
      }
    }
    if (bgSamples > 0) {
      bgR = sumR / bgSamples;
      bgG = sumG / bgSamples;
      bgB = sumB / bgSamples;
    }

    const isStudioBackdrop = (idx: number): boolean => {
      const o = idx * 4;
      const a = data[o + 3];
      if (a < 28) return true;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
      const lum = (r + g + b) / 3;
      const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      return lum >= 222 && maxC - minC <= 16 && dist <= 42;
    };

    const enqueue = (idx: number) => {
      if (visited[idx]) return;
      visited[idx] = 1;
      if (isStudioBackdrop(idx)) {
        removed[idx] = 1;
        queue[qTail++] = idx;
      }
    };

    for (let x = 0; x < w; x++) {
      enqueue(x);
      enqueue((h - 1) * w + x);
    }
    for (let y = 1; y < h - 1; y++) {
      enqueue(y * w);
      enqueue(y * w + (w - 1));
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % w;
      const y = (idx - x) / w;
      const o = idx * 4;
      const r0 = data[o];
      const g0 = data[o + 1];
      const b0 = data[o + 2];

      const tryNeighbor = (nIdx: number) => {
        if (visited[nIdx]) return;
        const no = nIdx * 4;
        const diff =
          Math.abs(data[no] - r0) +
          Math.abs(data[no + 1] - g0) +
          Math.abs(data[no + 2] - b0);
        if (diff > 24) {
          visited[nIdx] = 1;
          return;
        }
        enqueue(nIdx);
      };

      if (x > 0) tryNeighbor(idx - 1);
      if (x < w - 1) tryNeighbor(idx + 1);
      if (y > 0) tryNeighbor(idx - w);
      if (y < h - 1) tryNeighbor(idx + w);
    }

    // Interior Fill Pass: ensures white labels/pouches/jars stay 100% opaque
    for (let y = 0; y < h; y++) {
      let leftSolid = -1;
      let rightSolid = -1;
      const rowStart = y * w;
      for (let x = 0; x < w; x++) {
        if (!removed[rowStart + x]) {
          leftSolid = x;
          break;
        }
      }
      for (let x = w - 1; x >= 0; x--) {
        if (!removed[rowStart + x]) {
          rightSolid = x;
          break;
        }
      }
      if (leftSolid !== -1 && rightSolid > leftSolid) {
        for (let x = leftSolid; x <= rightSolid; x++) {
          removed[rowStart + x] = 0;
        }
      }
    }

    for (let i = 0; i < total; i++) {
      const o = i * 4;
      if (removed[i]) {
        data[o + 3] = 0;
      } else {
        data[o + 3] = Math.max(250, data[o + 3]);
      }
    }

    workCtx.putImageData(imageData, 0, 0);

    let tMinX = w;
    let tMinY = h;
    let tMaxX = -1;
    let tMaxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (data[o + 3] > 28) {
          if (x < tMinX) tMinX = x;
          if (x > tMaxX) tMaxX = x;
          if (y < tMinY) tMinY = y;
          if (y > tMaxY) tMaxY = y;
        }
      }
    }

    if (tMaxX > tMinX && tMaxY > tMinY) {
      minX = tMinX;
      minY = tMinY;
      maxX = tMaxX;
      maxY = tMaxY;
    }

    const cropHeight = maxY - minY + 1;
    const cropWidth = maxX - minX + 1;

    // Median row width across middle third ignores stray foreground brownies/gummies
    const rowWidths: number[] = [];
    for (let y = minY + Math.round(cropHeight * 0.34); y <= minY + Math.round(cropHeight * 0.72); y += 3) {
      let l = -1;
      let r = -1;
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * w + x) * 4 + 3] > 200) {
          l = x;
          break;
        }
      }
      for (let x = maxX; x >= minX; x--) {
        if (data[(y * w + x) * 4 + 3] > 200) {
          r = x;
          break;
        }
      }
      if (l !== -1 && r > l) {
        rowWidths.push(r - l + 1);
      }
    }
    if (rowWidths.length > 0) {
      rowWidths.sort((a, b) => a - b);
      const medW = rowWidths[Math.floor(rowWidths.length * 0.5)];
      medianBodyAspectRatio = medW / cropHeight;
    } else {
      medianBodyAspectRatio = cropWidth / cropHeight;
    }

    // Sample dominant cap & side-body colors cleanly
    let capR = 0;
    let capG = 0;
    let capB = 0;
    let capCount = 0;
    const capStartY = minY + Math.round(cropHeight * 0.03);
    const capEndY = minY + Math.round(cropHeight * 0.13);
    for (let y = capStartY; y <= capEndY; y += 2) {
      for (let x = minX + Math.round(cropWidth * 0.32); x <= maxX - Math.round(cropWidth * 0.32); x += 3) {
        const o = (y * w + x) * 4;
        if (data[o + 3] > 200) {
          capR += data[o];
          capG += data[o + 1];
          capB += data[o + 2];
          capCount++;
        }
      }
    }
    if (capCount > 10) {
      capColorHex = rgbToHex(capR / capCount, capG / capCount, capB / capCount);
    }

    let bodyR = 0;
    let bodyG = 0;
    let bodyB = 0;
    let bodyCount = 0;
    const bodyStartY = minY + Math.round(cropHeight * 0.32);
    const bodyEndY = minY + Math.round(cropHeight * 0.72);
    for (let y = bodyStartY; y <= bodyEndY; y += 3) {
      let rowL = -1;
      let rowR = -1;
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * w + x) * 4 + 3] > 200) {
          rowL = x;
          break;
        }
      }
      for (let x = maxX; x >= minX; x--) {
        if (data[(y * w + x) * 4 + 3] > 200) {
          rowR = x;
          break;
        }
      }
      if (rowL !== -1 && rowR - rowL > 20) {
        for (let dx = 4; dx <= Math.min(20, Math.floor((rowR - rowL) * 0.14)); dx += 2) {
          const lo = (y * w + rowL + dx) * 4;
          bodyR += data[lo];
          bodyG += data[lo + 1];
          bodyB += data[lo + 2];
          bodyCount++;

          const ro = (y * w + rowR - dx) * 4;
          bodyR += data[ro];
          bodyG += data[ro + 1];
          bodyB += data[ro + 2];
          bodyCount++;
        }
      }
    }
    if (bodyCount > 12) {
      bodyColorHex = rgbToHex(bodyR / bodyCount, bodyG / bodyCount, bodyB / bodyCount);
    } else if (capCount > 10) {
      bodyColorHex = capColorHex;
    }
  } catch {
    // Fallback cleanly if canvas pixels cannot be read
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const fullAspect = cropW / cropH;
  const aspectRatio = THREE.MathUtils.clamp(medianBodyAspectRatio || fullAspect, 0.44, 1.45);
  const isLightPalette = getColorLuminance(bodyColorHex) > 0.6;

  // 1. Crisp cutout canvas (full product silhouette)
  const cutoutCanvas = document.createElement('canvas');
  const maxOut = 1024;
  if (fullAspect >= 1) {
    cutoutCanvas.width = maxOut;
    cutoutCanvas.height = Math.max(128, Math.round(maxOut / fullAspect));
  } else {
    cutoutCanvas.height = maxOut;
    cutoutCanvas.width = Math.max(128, Math.round(maxOut * fullAspect));
  }
  const cutoutCtx = cutoutCanvas.getContext('2d')!;
  cutoutCtx.clearRect(0, 0, cutoutCanvas.width, cutoutCanvas.height);
  cutoutCtx.drawImage(
    workCanvas,
    minX,
    minY,
    cropW,
    cropH,
    0,
    0,
    cutoutCanvas.width,
    cutoutCanvas.height,
  );

  // 2. Lid-free body wrap canvas for cylindrical Tubs & Bottles (prevents double-lid stack!)
  const capSplitRatio = product.shape === 'bottle' ? 0.175 : product.shape === 'tub' ? 0.145 : 0;
  const bodyCropStartY = minY + Math.round(cropH * capSplitRatio);
  const bodyCropH = Math.max(32, maxY - bodyCropStartY + 1);
  const bodyWrapCanvas = document.createElement('canvas');
  bodyWrapCanvas.width = cutoutCanvas.width;
  bodyWrapCanvas.height = Math.max(128, Math.round(cutoutCanvas.height * (1 - capSplitRatio)));
  const bodyWrapCtx = bodyWrapCanvas.getContext('2d')!;
  bodyWrapCtx.clearRect(0, 0, bodyWrapCanvas.width, bodyWrapCanvas.height);
  bodyWrapCtx.drawImage(
    workCanvas,
    minX,
    bodyCropStartY,
    cropW,
    bodyCropH,
    0,
    0,
    bodyWrapCanvas.width,
    bodyWrapCanvas.height,
  );

  // 3. Solid edge-clamped front canvas for Pouches & Carton Boxes (100% opaque, zero corner gaps)
  const solidFrontCanvas = buildEdgeClampedCanvas(cutoutCanvas, bodyColorHex);

  const cutoutTexture = new THREE.CanvasTexture(cutoutCanvas);
  cutoutTexture.colorSpace = THREE.SRGBColorSpace;
  cutoutTexture.anisotropy = anisotropy;
  cutoutTexture.needsUpdate = true;

  const bodyWrapTexture = new THREE.CanvasTexture(bodyWrapCanvas);
  bodyWrapTexture.colorSpace = THREE.SRGBColorSpace;
  bodyWrapTexture.anisotropy = anisotropy;
  bodyWrapTexture.needsUpdate = true;

  const solidFrontTexture = new THREE.CanvasTexture(solidFrontCanvas);
  solidFrontTexture.colorSpace = THREE.SRGBColorSpace;
  solidFrontTexture.anisotropy = anisotropy;
  solidFrontTexture.needsUpdate = true;

  return {
    cutoutTexture,
    bodyWrapTexture,
    solidFrontTexture,
    cutoutCanvas,
    aspectRatio,
    bodyColorHex,
    capColorHex,
    isLightPalette,
    disposables: [cutoutTexture, bodyWrapTexture, solidFrontTexture],
  };
}

function createBackNutritionTexture(
  product: Product,
  flavor: ProductFlavor,
  isLightPalette: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const transparency = getProductTransparencyInfo(product, flavor);
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  const bgMain = isLightPalette ? '#F5F5F3' : '#0D0D10';
  const bgRowEven = isLightPalette ? '#EAEAE6' : '#18181B';
  const borderCol = isLightPalette ? '#D4D4D8' : '#27272A';
  const textPrimary = isLightPalette ? '#09090B' : '#FFFFFF';
  const textLabel = isLightPalette ? '#3F3F46' : '#D4D4D8';
  const textMuted = isLightPalette ? '#71717A' : '#A1A1AA';

  ctx.fillStyle = bgMain;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#FF5A00';
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  ctx.fillStyle = '#FF5A00';
  ctx.fillRect(28, 28, canvas.width - 56, 48);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('THÔNG TIN MINH BẠCH · CHÍNH HÃNG', 44, 59);

  ctx.fillStyle = textMuted;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(
    `NSX: ${transparency.manufacturerShort.toUpperCase()} · ${product.weightLabel.toUpperCase()}`,
    32,
    108,
  );

  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 24px sans-serif';
  const truncatedName =
    product.name.length > 34 ? `${product.name.slice(0, 32)}…` : product.name;
  ctx.fillText(truncatedName, 32, 142);

  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(32, 160, 16, 16);
  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`Vị: ${flavor.name} · Còn ${flavor.stock}`, 58, 174);

  ctx.fillStyle = borderCol;
  ctx.fillRect(32, 194, canvas.width - 64, 2);

  const rows: Array<[string, string, boolean?]> = [
    ...transparency.keyFacts.slice(0, 6).map((fact): [string, string, boolean?] => [
      fact.label,
      fact.value,
      fact.accent,
    ]),
    ['Công ty sản xuất', transparency.manufacturerShort, false],
    ['Xuất xứ / HSD', `${transparency.origin.split(' (')[0]} · Date 12–24 tháng`, false],
  ];

  let y = 234;
  rows.forEach(([label, value, accent], idx) => {
    if (idx % 2 === 0) {
      ctx.fillStyle = bgRowEven;
      ctx.fillRect(32, y - 26, canvas.width - 64, 42);
    }
    ctx.fillStyle = textLabel;
    ctx.font = '17px sans-serif';
    const shortLabel = label.length > 22 ? `${label.slice(0, 20)}…` : label;
    ctx.fillText(shortLabel, 44, y);

    ctx.fillStyle = accent ? '#FF5A00' : textPrimary;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    const shortValue = value.length > 26 ? `${value.slice(0, 24)}…` : value;
    ctx.fillText(shortValue, canvas.width - 44, y);
    ctx.textAlign = 'left';
    y += 45;
  });

  ctx.fillStyle = bgRowEven;
  ctx.fillRect(32, 594, canvas.width - 64, 92);
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 594, canvas.width - 64, 92);

  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('HƯỚNG DẪN DÙNG · NHAISUPPLEMENT.COM', 46, 620);
  ctx.fillStyle = textLabel;
  ctx.font = '14px sans-serif';

  const usageLine = transparency.usageSteps[0] || '';
  const words = usageLine.split(' ');
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= 54 && !line2) {
      line1 = (line1 + ' ' + w).trim();
    } else if ((line2 + ' ' + w).trim().length <= 54) {
      line2 = (line2 + ' ' + w).trim();
    }
  }
  ctx.fillText(line1, 46, 646);
  if (line2) {
    ctx.fillText(line2.length >= 52 ? `${line2}…` : line2, 46, 668);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createSidePanelTexture(
  product: Product,
  flavor: ProductFlavor,
  baseColorHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle vertical foil/plastic studio shading
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Flavor accent band
  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(0, 72, canvas.width, 16);

  const isLight = getColorLuminance(baseColorHex) > 0.58;
  const textPrimary = isLight ? '#09090B' : '#FFFFFF';
  const textMuted = isLight ? '#52525B' : '#A1A1AA';

  ctx.save();
  ctx.translate(128, 286);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = textPrimary;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(product.brand.toUpperCase(), 0, -10);
  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(
    `${product.nutritionInfo.highlightValue} · ${product.weightLabel}`.slice(0, 22),
    0,
    22,
  );
  ctx.fillStyle = textMuted;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('CHÍNH HÃNG NHAISUPPLEMENT', 0, 50);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createRulerLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#09090B';
  ctx.fillRect(4, 8, 248, 64);
  ctx.strokeStyle = '#FF5A00';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 8, 248, 64);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildPouchGeometry(w: number, h: number, baseDepth: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, baseDepth, 14, 22, 4);
  const pos = geo.attributes.position;
  const halfH = h * 0.5;
  const halfW = Math.max(0.01, w * 0.5);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y + halfH) / h, 0, 1); // 0 bottom gusset -> 1 top crimp seal
    const xNorm = THREE.MathUtils.clamp(Math.abs(x) / halfW, 0, 1);

    // Doypack profile: flat top heat-seal crimp (t >= 0.88), gentle pillow belly in middle, wide standing base gusset
    const baseTapering = t >= 0.88 ? 0.09 : Math.max(0.11, 1.0 - t * 0.86 + Math.sin(t * Math.PI) * 0.28);
    const pillowCurve = t >= 0.88 ? 1.0 : 0.72 + Math.cos(xNorm * Math.PI * 0.48) * 0.34;
    const widthProfile = t >= 0.88 ? 0.96 : 0.95 + Math.sin(t * Math.PI) * 0.05;

    pos.setXYZ(i, x * widthProfile, y, z * baseTapering * pillowCurve);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function buildRealPhotoShowcaseGroup(
  product: Product,
  flavor: ProductFlavor,
  isSoftwareGl: boolean,
  anisotropy: number,
): BuiltPhotoShowcase {
  const root = new THREE.Group();
  const productModelGroup = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const dims = getRealPhysicalDimensions(product);
  const targetH = getShowcaseTargetHeight(product);
  const initialW = product.shape === 'bar' ? targetH * 1.15 : targetH * 0.8;

  const placeholderTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholderTex.needsUpdate = true;

  const isPouchOrBar = product.shape === 'pouch' || product.shape === 'bar';

  const frontMat = new THREE.MeshStandardMaterial({
    map: placeholderTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: placeholderTex,
    emissiveIntensity: 0.16,
    color: new THREE.Color(0xffffff),
    roughness: isPouchOrBar ? 0.38 : 0.42,
    metalness: isPouchOrBar ? 0.1 : 0.05,
    transparent: !isPouchOrBar,
    alphaTest: isPouchOrBar ? 0 : 0.14,
    side: THREE.FrontSide,
  });

  let backTex = createBackNutritionTexture(product, flavor, false, anisotropy);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: backTex,
    emissiveIntensity: 0.16,
    roughness: 0.46,
    metalness: 0.08,
    side: THREE.FrontSide,
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d1d22'),
    roughness: 0.42,
    metalness: 0.12,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#131317'),
    roughness: 0.34,
    metalness: 0.18,
  });

  const flavorAccentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(flavor.colorHex),
    roughness: 0.35,
    metalness: 0.12,
  });

  let sideTex = createSidePanelTexture(product, flavor, '#1d1d22', anisotropy);
  const sidePanelMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: 0.42,
    metalness: 0.12,
  });

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: placeholderTex,
    alphaTest: 0.14,
  });

  const modelGeos: THREE.BufferGeometry[] = [];

  const rebuildSolidPackagingGeometry = (w: number, h: number) => {
    while (productModelGroup.children.length > 0) {
      productModelGroup.remove(productModelGroup.children[0]);
    }
    while (modelGeos.length > 0) {
      modelGeos.pop()?.dispose();
    }

    if (product.shape === 'tub' || product.shape === 'bottle') {
      const radius = THREE.MathUtils.clamp(w * 0.45, 0.32, 0.86);
      const capHeight = product.shape === 'bottle' ? h * 0.15 : h * 0.125;
      const shoulderHeight = h * 0.055;
      const bodyHeight = Math.max(0.4, h - capHeight - shoulderHeight);

      // Smooth cylindrical jar / bottle core
      const coreGeo = new THREE.CylinderGeometry(radius, radius * 0.96, bodyHeight, 48, 1, false);
      const coreMesh = new THREE.Mesh(coreGeo, bodyMat);
      coreMesh.position.y = bodyHeight * 0.5;
      coreMesh.castShadow = !isSoftwareGl;
      coreMesh.receiveShadow = true;

      // Beveled neck shoulder
      const shoulderGeo = new THREE.CylinderGeometry(
        radius * 0.83,
        radius,
        shoulderHeight,
        48,
        1,
        false,
      );
      const shoulderMesh = new THREE.Mesh(shoulderGeo, bodyMat);
      shoulderMesh.position.y = bodyHeight + shoulderHeight * 0.5;
      shoulderMesh.castShadow = !isSoftwareGl;

      // Real 3D ribbed screw cap (without duplicate photo lid below!)
      const capRadius = product.shape === 'bottle' ? radius * 0.74 : radius * 0.84;
      const capGeo = new THREE.CylinderGeometry(
        capRadius * 0.96,
        capRadius,
        capHeight,
        40,
        1,
        false,
      );
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.y = bodyHeight + shoulderHeight + capHeight * 0.5;
      capMesh.castShadow = !isSoftwareGl;

      // Top lid bevel trim ring
      const lidRimGeo = new THREE.TorusGeometry(capRadius * 0.96, 0.01, 8, 40);
      const lidRimMesh = new THREE.Mesh(lidRimGeo, capMat);
      lidRimMesh.rotation.x = Math.PI / 2;
      lidRimMesh.position.y = bodyHeight + shoulderHeight + capHeight;

      // Subtle flavor seal collar beneath the lid
      const collarGeo = new THREE.TorusGeometry(capRadius * 0.99, 0.011, 10, 48);
      const collarMesh = new THREE.Mesh(collarGeo, flavorAccentMat);
      collarMesh.rotation.x = Math.PI / 2;
      collarMesh.position.y = bodyHeight + shoulderHeight + 0.01;

      // Front curved body label (using lid-free bodyWrapTexture!)
      const frontArcGeo = new THREE.CylinderGeometry(
        radius + 0.013,
        radius * 0.96 + 0.013,
        bodyHeight * 0.96,
        44,
        1,
        true,
        -Math.PI * 0.42,
        Math.PI * 0.84,
      );
      const frontArcMesh = new THREE.Mesh(frontArcGeo, frontMat);
      frontArcMesh.position.y = bodyHeight * 0.5;
      frontArcMesh.customDepthMaterial = depthMat;

      // Back curved Supplement Facts & Manufacturer panel on opposite (-Z) arc
      const backArcGeo = new THREE.CylinderGeometry(
        radius + 0.013,
        radius * 0.96 + 0.013,
        bodyHeight * 0.86,
        36,
        1,
        true,
        Math.PI - 0.68,
        1.36,
      );
      const backArcMesh = new THREE.Mesh(backArcGeo, backMat);
      backArcMesh.position.y = bodyHeight * 0.5;

      // Left & Right side brand callout ribbons
      const sideRightGeo = new THREE.CylinderGeometry(
        radius + 0.008,
        radius * 0.96 + 0.008,
        bodyHeight * 0.72,
        18,
        1,
        true,
        Math.PI * 0.46,
        0.34,
      );
      const sideRightMesh = new THREE.Mesh(sideRightGeo, sidePanelMat);
      sideRightMesh.position.y = bodyHeight * 0.5;

      const sideLeftGeo = new THREE.CylinderGeometry(
        radius + 0.008,
        radius * 0.96 + 0.008,
        bodyHeight * 0.72,
        18,
        1,
        true,
        -Math.PI * 0.46 - 0.34,
        0.34,
      );
      const sideLeftMesh = new THREE.Mesh(sideLeftGeo, sidePanelMat);
      sideLeftMesh.position.y = bodyHeight * 0.5;

      productModelGroup.add(
        coreMesh,
        shoulderMesh,
        capMesh,
        lidRimMesh,
        collarMesh,
        frontArcMesh,
        backArcMesh,
        sideRightMesh,
        sideLeftMesh,
      );
      modelGeos.push(
        coreGeo,
        shoulderGeo,
        capGeo,
        lidRimGeo,
        collarGeo,
        frontArcGeo,
        backArcGeo,
        sideRightGeo,
        sideLeftGeo,
      );
    } else if (product.shape === 'pouch') {
      // Real 3D Stand-up Tapered Gusset Doypack Pouch (e.g. OstroVit Creatine Bag, JOCKO Bag, Mutant Mass)
      const pouchW = w * 0.96;
      const pouchDepth = Math.max(0.5, pouchW * 0.42);
      const pouchGeo = buildPouchGeometry(pouchW, h, pouchDepth);
      const pouchMesh = new THREE.Mesh(pouchGeo, [
        sidePanelMat, // +X right gusset
        sidePanelMat, // -X left gusset
        capMat, // +Y top heat-seal crimp
        bodyMat, // -Y stable bottom gusset
        frontMat, // +Z 100% opaque solid edge-clamped front pouch graphic
        backMat, // -Z color-matched back transparency/nutrition sheet
      ]);
      pouchMesh.position.y = h * 0.5;
      pouchMesh.castShadow = !isSoftwareGl;
      pouchMesh.receiveShadow = true;

      // Subtle heat-sealed zip ridge across top of pouch (front & back)
      const zipRidgeGeo = new THREE.BoxGeometry(pouchW * 0.92, 0.016, pouchDepth * 0.14);
      const zipRidgeMesh = new THREE.Mesh(zipRidgeGeo, flavorAccentMat);
      zipRidgeMesh.position.y = h * 0.875;

      productModelGroup.add(pouchMesh, zipRidgeMesh);
      modelGeos.push(pouchGeo, zipRidgeGeo);
    } else {
      // 'bar': Real 3D Carton Box Packaging
      const boxW = w * 0.96;
      const boxD = Math.max(0.36, boxW * 0.36);
      const boxGeo = new THREE.BoxGeometry(boxW, h, boxD);
      const boxMesh = new THREE.Mesh(boxGeo, [
        sidePanelMat, // +X right wall
        sidePanelMat, // -X left wall
        capMat, // +Y top box lid
        bodyMat, // -Y bottom base
        frontMat, // +Z opaque front box art
        backMat, // -Z back nutrition & specs
      ]);
      boxMesh.position.y = h * 0.5;
      boxMesh.castShadow = !isSoftwareGl;
      boxMesh.receiveShadow = true;

      productModelGroup.add(boxMesh);
      modelGeos.push(boxGeo);
    }
  };

  rebuildSolidPackagingGeometry(initialW, targetH);

  // Soft studio ambient occlusion contact shadow
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 256;
  aoCanvas.height = 256;
  const aoCtx = aoCanvas.getContext('2d')!;
  const aoGrad = aoCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  aoGrad.addColorStop(0, 'rgba(0,0,0,0.52)');
  aoGrad.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 256, 256);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const aoGeo = new THREE.PlaneGeometry(initialW * 1.24, initialW * 1.05);
  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
  });
  const aoMesh = new THREE.Mesh(aoGeo, aoMat);
  aoMesh.rotation.x = -Math.PI / 2;
  aoMesh.position.y = 0.004;

  // Architectural CM Physical Size Ruler beside the product
  const rulerGroup = new THREE.Group();
  const rulerMat = new THREE.MeshBasicMaterial({ color: 0xff5a00 });
  const stemGeo = new THREE.BoxGeometry(0.018, targetH, 0.018);
  const stemMesh = new THREE.Mesh(stemGeo, rulerMat);
  stemMesh.position.y = targetH / 2;

  const tickGeo = new THREE.BoxGeometry(0.11, 0.018, 0.018);
  const topTick = new THREE.Mesh(tickGeo, rulerMat);
  topTick.position.set(-0.04, targetH, 0);
  const botTick = new THREE.Mesh(tickGeo, rulerMat);
  botTick.position.set(-0.04, 0.01, 0);

  const rulerLabelTex = createRulerLabelTexture(`${dims.heightCm} cm`);
  const rulerLabelGeo = new THREE.PlaneGeometry(0.46, 0.145);
  const rulerLabelMat = new THREE.MeshBasicMaterial({
    map: rulerLabelTex,
    side: THREE.DoubleSide,
  });
  const rulerLabelMesh = new THREE.Mesh(rulerLabelGeo, rulerLabelMat);
  rulerLabelMesh.position.set(0.27, targetH * 0.5, 0);

  rulerGroup.add(stemMesh, topTick, botTick, rulerLabelMesh);
  rulerGroup.position.set(initialW * 0.56, 0, 0);
  rulerGroup.visible = false;

  root.add(aoMesh, productModelGroup, rulerGroup);
  disposables.push(
    placeholderTex,
    frontMat,
    depthMat,
    backMat,
    bodyMat,
    capMat,
    flavorAccentMat,
    sidePanelMat,
    { dispose: () => backTex.dispose() },
    { dispose: () => sideTex.dispose() },
    aoTex,
    aoGeo,
    aoMat,
    rulerMat,
    stemGeo,
    tickGeo,
    rulerLabelTex,
    rulerLabelGeo,
    rulerLabelMat,
    {
      dispose: () => {
        while (modelGeos.length > 0) {
          modelGeos.pop()?.dispose();
        }
      },
    },
  );

  let currentShowcaseHeight = targetH;

  const applyRealAssets = (assets: RealProductVisualAssets) => {
    const h = getShowcaseTargetHeight(product);
    const w = Math.min(2.38, Math.max(0.82, h * assets.aspectRatio));
    const adjustedH = w / assets.aspectRatio;
    currentShowcaseHeight = adjustedH;

    bodyMat.color.set(assets.bodyColorHex);
    capMat.color.set(assets.capColorHex);

    const oldBackTex = backTex;
    backTex = createBackNutritionTexture(product, flavor, assets.isLightPalette, anisotropy);
    backMat.map = backTex;
    backMat.emissiveMap = backTex;
    backMat.needsUpdate = true;
    oldBackTex.dispose();

    const oldSideTex = sideTex;
    sideTex = createSidePanelTexture(product, flavor, assets.bodyColorHex, anisotropy);
    sidePanelMat.map = sideTex;
    sidePanelMat.needsUpdate = true;
    oldSideTex.dispose();

    rebuildSolidPackagingGeometry(w, adjustedH);

    aoMesh.scale.set(w / initialW, w / initialW, 1);

    stemMesh.scale.y = adjustedH / targetH;
    stemMesh.position.y = adjustedH / 2;
    topTick.position.y = adjustedH;
    rulerLabelMesh.position.y = adjustedH * 0.5;
    rulerGroup.position.x = w * 0.5 + 0.14;

    const chosenFrontTex = isPouchOrBar ? assets.solidFrontTexture : assets.bodyWrapTexture;
    frontMat.map = chosenFrontTex;
    frontMat.emissiveMap = chosenFrontTex;
    frontMat.needsUpdate = true;

    depthMat.map = chosenFrontTex;
    depthMat.needsUpdate = true;
  };

  const setLightTint = (brightness: number, rTint = 1, gTint = 1, bTint = 1) => {
    const clamped = Math.min(1.45, Math.max(0.65, brightness));
    frontMat.color.setRGB(clamped * rTint, clamped * gTint, clamped * bTint);
    frontMat.emissiveIntensity = 0.16 * clamped;
  };

  const setRulerVisible = (visible: boolean) => {
    rulerGroup.visible = visible;
  };

  const setFacingBack = (_isBack: boolean) => {
    // Front and back panels live permanently on opposite 3D faces
  };

  const getRealMeterScale = () => dims.heightMeters / Math.max(0.2, currentShowcaseHeight);

  return {
    root,
    applyRealAssets,
    setLightTint,
    setRulerVisible,
    setFacingBack,
    getRealMeterScale,
    disposables,
  };
}

export function buildArReticleGroup(): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const outerRingGeo = new THREE.RingGeometry(0.94, 0.965, 64);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xff5a00,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.002;

  const innerRingGeo = new THREE.RingGeometry(0.64, 0.655, 64);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.002;

  const shadowGeo = new THREE.PlaneGeometry(6, 6);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.36 });
  const shadowCatcher = new THREE.Mesh(shadowGeo, shadowMat);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.001;
  shadowCatcher.receiveShadow = true;

  group.add(outerRing, innerRing, shadowCatcher);
  disposables.push(outerRingGeo, outerRingMat, innerRingGeo, innerRingMat, shadowGeo, shadowMat);

  return { group, disposables };
}

function createVrPlaqueTexture(
  product: Product,
  flavor: ProductFlavor,
  anisotropy: number,
): THREE.CanvasTexture {
  const transparency = getProductTransparencyInfo(product, flavor);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 264;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#FF5A00';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(
    `${product.brand.toUpperCase()} (${transparency.origin.toUpperCase()}) · ${product.weightLabel.toUpperCase()}`,
    26,
    44,
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 27px sans-serif';
  const nameLine = product.name.length > 34 ? `${product.name.slice(0, 32)}…` : product.name;
  ctx.fillText(nameLine, 26, 84);

  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(26, 102, 16, 16);
  ctx.fillStyle = '#E4E4E7';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(`Vị: ${flavor.name} · Còn ${flavor.stock}`, 52, 117);

  const activePrice = flavor.priceOverride ?? product.price;
  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(formatVND(activePrice), canvas.width - 26, 118);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#27272A';
  ctx.fillRect(26, 138, canvas.width - 52, 2);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '17px sans-serif';
  ctx.fillText('Liều dùng · Khẩu phần', 26, 174);
  ctx.fillText(product.nutritionInfo.highlightKey || 'Hoạt chất chính', 238, 174);
  ctx.fillText('Chi phí · Kích thước', 450, 174);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 19px monospace';
  ctx.fillText(
    `${product.nutritionInfo.servingsPerContainer}x (${product.nutritionInfo.servingSize.split(' (')[0].slice(0, 11)})`,
    26,
    210,
  );
  ctx.fillStyle = '#FF5A00';
  const highlightCol =
    product.category === 'whey-hydrolyzed' || product.category === 'mass'
      ? `${product.nutritionInfo.protein} · ${product.nutritionInfo.highlightValue}`
      : product.nutritionInfo.highlightValue;
  ctx.fillText(highlightCol.slice(0, 18), 238, 210);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(transparency.costPerServingLabel.replace('~', ''), 450, 210);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '14px sans-serif';
  ctx.fillText(getRealSizeLabel(product), 450, 234);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function buildVrShowroomGroup(
  initialProduct: Product,
  initialFlavor: ProductFlavor,
  anisotropy: number,
): {
  group: THREE.Group;
  updatePlaque: (product: Product, flavor: ProductFlavor) => void;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x17171b,
    roughness: 0.58,
    metalness: 0.28,
  });
  const brushedMetalMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    roughness: 0.32,
    metalness: 0.78,
  });
  const ledRingMat = new THREE.MeshBasicMaterial({
    color: 0xff5a00,
    transparent: true,
    opacity: 0.75,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    roughness: 0.76,
    metalness: 0.14,
  });

  const pedGeo = new THREE.CylinderGeometry(1.72, 1.84, 0.12, 64);
  const pedMesh = new THREE.Mesh(pedGeo, baseMat);
  pedMesh.position.y = -0.07;
  pedMesh.receiveShadow = true;

  const rimGeo = new THREE.TorusGeometry(1.73, 0.012, 10, 64);
  const rimMesh = new THREE.Mesh(rimGeo, brushedMetalMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.012;

  const ledGeo = new THREE.TorusGeometry(1.86, 0.01, 8, 64);
  const ledMesh = new THREE.Mesh(ledGeo, ledRingMat);
  ledMesh.rotation.x = Math.PI / 2;
  ledMesh.position.y = -0.125;

  const floorGeo = new THREE.CircleGeometry(10, 64);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.135;
  floorMesh.receiveShadow = true;

  const ring1Geo = new THREE.RingGeometry(3.2, 3.23, 64);
  const ring2Geo = new THREE.RingGeometry(5.2, 5.23, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x27272a,
    side: THREE.DoubleSide,
  });
  const ring1 = new THREE.Mesh(ring1Geo, ringMat);
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = -0.13;
  const ring2 = new THREE.Mesh(ring2Geo, ringMat);
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = -0.13;

  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.16, 5.4, 20);
  const pillarInst = new THREE.InstancedMesh(pillarGeo, baseMat, 6);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const r = 7.4;
    dummy.position.set(Math.cos(a) * r, 2.5, Math.sin(a) * r);
    dummy.rotation.set(0, -a, 0);
    dummy.updateMatrix();
    pillarInst.setMatrixAt(i, dummy.matrix);
  }
  pillarInst.instanceMatrix.needsUpdate = true;
  pillarInst.computeBoundingSphere();

  let plaqueTex = createVrPlaqueTexture(initialProduct, initialFlavor, anisotropy);
  const plaqueGeo = new THREE.PlaneGeometry(1.36, 0.56);
  const plaqueMat = new THREE.MeshBasicMaterial({
    map: plaqueTex,
    side: THREE.DoubleSide,
  });
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
  plaqueMesh.position.set(0, 0.14, 1.46);
  plaqueMesh.rotation.set(-0.56, 0, 0);

  group.add(floorMesh, ring1, ring2, pedMesh, rimMesh, ledMesh, pillarInst, plaqueMesh);
  disposables.push(
    baseMat,
    brushedMetalMat,
    ledRingMat,
    floorMat,
    ringMat,
    pedGeo,
    rimGeo,
    ledGeo,
    floorGeo,
    ring1Geo,
    ring2Geo,
    pillarGeo,
    plaqueGeo,
    plaqueMat,
    { dispose: () => plaqueTex.dispose() },
  );

  const updatePlaque = (nextProduct: Product, nextFlavor: ProductFlavor) => {
    const oldTex = plaqueTex;
    plaqueTex = createVrPlaqueTexture(nextProduct, nextFlavor, anisotropy);
    plaqueMat.map = plaqueTex;
    plaqueMat.needsUpdate = true;
    oldTex.dispose();
  };

  return { group, updatePlaque, disposables };
}

export async function generateUsdzBlobUrl(
  product: Product,
  assets: RealProductVisualAssets,
): Promise<string> {
  const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
  const dims = getRealPhysicalDimensions(product);

  const exportScene = new THREE.Scene();
  const hMeters = dims.heightMeters;
  const wMeters = hMeters * assets.aspectRatio;
  const isPouchOrBar = product.shape === 'pouch' || product.shape === 'bar';

  const frontMat = new THREE.MeshStandardMaterial({
    map: isPouchOrBar ? assets.solidFrontTexture : assets.bodyWrapTexture,
    alphaTest: isPouchOrBar ? 0 : 0.14,
    roughness: 0.42,
    metalness: 0.06,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(assets.bodyColorHex),
    roughness: 0.45,
    metalness: 0.1,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(assets.capColorHex),
    roughness: 0.35,
    metalness: 0.15,
  });

  const exportGeos: THREE.BufferGeometry[] = [];

  if (product.shape === 'tub' || product.shape === 'bottle') {
    const r = THREE.MathUtils.clamp(wMeters * 0.44, 0.025, 0.12);
    const bodyH = hMeters * 0.85;
    const capH = hMeters * 0.14;
    const coreGeo = new THREE.CylinderGeometry(r, r * 0.96, bodyH, 36);
    const core = new THREE.Mesh(coreGeo, bodyMat);
    core.position.y = bodyH * 0.5;

    const capGeo = new THREE.CylinderGeometry(r * 0.85, r * 0.85, capH, 36);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = bodyH + capH * 0.5;

    const wrapGeo = new THREE.CylinderGeometry(
      r + 0.002,
      r * 0.96 + 0.002,
      bodyH * 0.95,
      36,
      1,
      true,
      -Math.PI * 0.42,
      Math.PI * 0.84,
    );
    const wrap = new THREE.Mesh(wrapGeo, frontMat);
    wrap.position.y = bodyH * 0.5;

    exportScene.add(core, cap, wrap);
    exportGeos.push(coreGeo, capGeo, wrapGeo);
  } else {
    const dMeters = product.shape === 'pouch' ? wMeters * 0.42 : wMeters * 0.36;
    const boxGeo =
      product.shape === 'pouch'
        ? buildPouchGeometry(wMeters * 0.96, hMeters, dMeters)
        : new THREE.BoxGeometry(wMeters * 0.96, hMeters, dMeters);
    const box = new THREE.Mesh(boxGeo, [bodyMat, bodyMat, capMat, bodyMat, frontMat, bodyMat]);
    box.position.y = hMeters * 0.5;
    exportScene.add(box);
    exportGeos.push(boxGeo);
  }

  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(exportScene);

  exportGeos.forEach((g) => g.dispose());
  frontMat.dispose();
  bodyMat.dispose();
  capMat.dispose();

  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });
  return URL.createObjectURL(blob);
}
