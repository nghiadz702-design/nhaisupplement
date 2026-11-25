import * as THREE from 'three';
import type { Product, ProductFlavor } from '../types/product';

export interface BuiltProductModel {
  root: THREE.Group;
  lidPart: THREE.Object3D;
  innerPart: THREE.Object3D;
  disposables: Array<{ dispose: () => void }>;
  realSizeLabel: string;
  applyRealAssets: (assets: RealProductVisualAssets) => void;
}

export interface RealProductVisualAssets {
  cutoutTexture: THREE.CanvasTexture;
  wrapTexture: THREE.CanvasTexture;
  aspectRatio: number;
  capColor: THREE.Color;
  bodyColor: THREE.Color;
  accentColor: THREE.Color;
  disposables: Array<{ dispose: () => void }>;
}

export interface BuiltPhotoShowcase {
  root: THREE.Group;
  applyRealAssets: (assets: RealProductVisualAssets) => void;
  disposables: Array<{ dispose: () => void }>;
}

export function getRealSizeLabel(product: Product): string {
  if (product.shape === 'bar') return '~ 14 × 5 × 2.5 cm';
  if (product.shape === 'bottle') return '~ 13 × 7 cm';
  if (product.shape === 'pouch') return '~ 34 × 24 × 11 cm';
  return product.weightLabel.includes('10') || product.weightLabel.includes('12')
    ? '~ 32 × 20 cm'
    : '~ 25 × 15 cm';
}

function getShowcaseTargetHeight(product: Product): number {
  if (product.shape === 'bar') return 1.62;
  if (product.shape === 'bottle') return 2.02;
  if (product.shape === 'pouch') return 2.18;
  return 2.16;
}

function drawBackArcPanels(
  ctx: CanvasRenderingContext2D,
  product: Product,
  accentHex: string,
) {
  // Left back panel (x = 18..224): Nutrition Facts
  ctx.fillStyle = 'rgba(14, 14, 18, 0.94)';
  ctx.fillRect(18, 92, 206, 326);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 92, 206, 326);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 18px monospace';
  ctx.fillText('NUTRITION FACTS', 32, 124);

  ctx.fillStyle = accentHex;
  ctx.fillRect(32, 134, 178, 4);

  const rows: Array<[string, string]> = [
    ['Serving', product.nutritionInfo.servingSize],
    ['Servings', `${product.nutritionInfo.servingsPerContainer}`],
    ['Calories', product.nutritionInfo.calories],
    ['Protein', product.nutritionInfo.protein],
    ['Carbs', product.nutritionInfo.carbs],
    ['Fat', product.nutritionInfo.fat],
  ];

  rows.forEach(([k, v], idx) => {
    const y = 172 + idx * 37;
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '500 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(k, 32, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v.slice(0, 12), 210, y);

    if (idx < rows.length - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, y + 12);
      ctx.lineTo(210, y + 12);
      ctx.stroke();
    }
  });

  // Right back panel (x = 800..1006): Authenticity Seal & Barcode
  ctx.fillStyle = 'rgba(14, 14, 18, 0.94)';
  ctx.fillRect(800, 92, 206, 326);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(800, 92, 206, 326);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF5A00';
  ctx.font = '800 17px monospace';
  ctx.fillText('TEM CHÍNH HÃNG', 903, 128);
  ctx.fillStyle = '#D4D4D8';
  ctx.font = '500 14px monospace';
  ctx.fillText('ĐỔI TRẢ 7 NGÀY', 903, 158);
  ctx.fillText('HOTLINE: 094618430', 903, 184);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(822, 214, 162, 102);
  ctx.fillStyle = '#09090B';
  for (let bx = 834; bx < 974; bx += 7) {
    const barW = (bx * 13) % 4 === 0 ? 4 : 2;
    ctx.fillRect(bx, 226, barW, 68);
  }
  ctx.fillStyle = '#18181B';
  ctx.font = '600 11px monospace';
  ctx.fillText(product.id.toUpperCase(), 903, 308);

  ctx.fillStyle = '#A1A1AA';
  ctx.font = '600 13px monospace';
  ctx.fillText('nhaisupplement.com', 903, 362);
  ctx.fillText('KHO HÀ NỘI · SHIP VN', 903, 386);
}

export function createProceduralLabelTexture(
  product: Product,
  flavor: ProductFlavor,
  anisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, 1024, 512);

  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(0, 0, 1024, 56);

  ctx.fillStyle = '#FF5A00';
  ctx.fillRect(0, 56, 1024, 10);

  ctx.fillStyle = flavor.accentHex || '#FF5A00';
  ctx.fillRect(0, 444, 1024, 68);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(product.brand.toUpperCase(), 512, 38);

  ctx.font = '800 38px sans-serif';
  const titleLine =
    product.name.length > 26 ? `${product.name.slice(0, 24)}...` : product.name;
  ctx.fillText(titleLine, 512, 165);

  ctx.fillStyle = '#FF5A00';
  ctx.font = '800 30px monospace';
  ctx.fillText(
    `${product.nutritionInfo.highlightValue} ${product.nutritionInfo.highlightKey}`,
    512,
    240,
  );

  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(326, 286, 372, 54);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px sans-serif';
  const flavorLabel =
    flavor.name.length > 24 ? `${flavor.name.slice(0, 22)}...` : flavor.name;
  ctx.fillText(`VỊ: ${flavorLabel.toUpperCase()}`, 512, 321);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 25px monospace';
  ctx.fillText(
    `${product.weightLabel} · ${product.nutritionInfo.servingsPerContainer} SERVINGS`,
    512,
    486,
  );

  drawBackArcPanels(ctx, product, flavor.accentHex || '#FF5A00');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
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
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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

  const maxWorkDim = 768;
  const scaleDown = Math.min(1, maxWorkDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(64, Math.round(img.naturalWidth * scaleDown));
  const h = Math.max(64, Math.round(img.naturalHeight * scaleDown));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) return null;

  workCtx.drawImage(img, 0, 0, w, h);

  let imageData: ImageData;
  try {
    imageData = workCtx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }

  const data = imageData.data;
  const total = w * h;
  const removed = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const isEdgeBackground = (idx: number): boolean => {
    const o = idx * 4;
    const a = data[o + 3];
    if (a < 24) return true;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
    const lum = (r + g + b) / 3;
    return lum >= 230 && maxC - minC <= 26;
  };

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    visited[idx] = 1;
    if (isEdgeBackground(idx)) {
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
    if (x > 0) enqueue(idx - 1);
    if (x < w - 1) enqueue(idx + 1);
    if (y > 0) enqueue(idx - w);
    if (y < h - 1) enqueue(idx + w);
  }

  // Strip removed background and gently feather white halo on perimeter pixels
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    if (removed[i]) {
      data[o + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i - x) / w;
    let bgNeighbors = 0;
    if (x > 0 && removed[i - 1]) bgNeighbors++;
    if (x < w - 1 && removed[i + 1]) bgNeighbors++;
    if (y > 0 && removed[i - w]) bgNeighbors++;
    if (y < h - 1 && removed[i + w]) bgNeighbors++;
    if (bgNeighbors > 0) {
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      if (lum > 205 && maxC - minC < 32) {
        const factor = Math.max(0.25, 1 - bgNeighbors * 0.24);
        data[o + 3] = Math.round(data[o + 3] * factor);
      }
    }
  }

  workCtx.putImageData(imageData, 0, 0);

  // Tight bounding box of opaque foreground
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const aspectRatio = cropW / cropH;

  // Sample cap, body, and vibrant accent colors from the foreground
  let capR = 0;
  let capG = 0;
  let capB = 0;
  let capN = 0;

  let bodyR = 0;
  let bodyG = 0;
  let bodyB = 0;
  let bodyN = 0;

  let bestSat = -1;
  let accR = 255;
  let accG = 90;
  let accB = 0;

  const capTop = minY + Math.round(cropH * 0.03);
  const capBot = minY + Math.round(cropH * 0.14);
  const bodyTop = minY + Math.round(cropH * 0.22);
  const bodyBot = minY + Math.round(cropH * 0.84);

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const o = (y * w + x) * 4;
      if (data[o + 3] < 180) continue;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = (r + g + b) / 3;

      if (y >= capTop && y <= capBot && lum < 236) {
        capR += r;
        capG += g;
        capB += b;
        capN++;
      }
      if (y >= bodyTop && y <= bodyBot && lum < 242) {
        bodyR += r;
        bodyG += g;
        bodyB += b;
        bodyN++;
      }
      if (maxC > 60) {
        const sat = (maxC - minC) / maxC;
        if (sat > bestSat && lum > 45 && lum < 225) {
          bestSat = sat;
          accR = r;
          accG = g;
          accB = b;
        }
      }
    }
  }

  const capColor = capN > 10 ? new THREE.Color(capR / (capN * 255), capG / (capN * 255), capB / (capN * 255)) : new THREE.Color(0x16161a);
  const bodyColor = bodyN > 20 ? new THREE.Color(bodyR / (bodyN * 255), bodyG / (bodyN * 255), bodyB / (bodyN * 255)) : new THREE.Color(0x1e1e22);
  const accentColor = bestSat > 0.28 ? new THREE.Color(accR / 255, accG / 255, accB / 255) : new THREE.Color(flavor.accentHex || '#FF5A00');

  // 1. Cutout Texture (exact tight crop with clean transparency for AR & VR showcase)
  const cutoutCanvas = document.createElement('canvas');
  const maxOut = 1024;
  if (aspectRatio >= 1) {
    cutoutCanvas.width = maxOut;
    cutoutCanvas.height = Math.max(128, Math.round(maxOut / aspectRatio));
  } else {
    cutoutCanvas.height = maxOut;
    cutoutCanvas.width = Math.max(128, Math.round(maxOut * aspectRatio));
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

  const cutoutTexture = new THREE.CanvasTexture(cutoutCanvas);
  cutoutTexture.colorSpace = THREE.SRGBColorSpace;
  cutoutTexture.anisotropy = anisotropy;
  cutoutTexture.needsUpdate = true;

  // 2. 360-Wrap Texture (real packaging artwork on front arc + Nutrition/Barcode on back arc)
  const wrapCanvas = document.createElement('canvas');
  wrapCanvas.width = 1024;
  wrapCanvas.height = 512;
  const wrapCtx = wrapCanvas.getContext('2d')!;

  const bgRgbHex = bodyN > 20
    ? rgbToHex(bodyR / bodyN, bodyG / bodyN, bodyB / bodyN)
    : '#18181B';
  wrapCtx.fillStyle = bgRgbHex;
  wrapCtx.fillRect(0, 0, 1024, 512);

  // Subtle dark gradient at back sides so nutrition panels look clean
  const sideGradL = wrapCtx.createLinearGradient(0, 0, 250, 0);
  sideGradL.addColorStop(0, 'rgba(12,12,16,0.92)');
  sideGradL.addColorStop(1, 'rgba(12,12,16,0)');
  wrapCtx.fillStyle = sideGradL;
  wrapCtx.fillRect(0, 0, 250, 512);

  const sideGradR = wrapCtx.createLinearGradient(774, 0, 1024, 0);
  sideGradR.addColorStop(0, 'rgba(12,12,16,0)');
  sideGradR.addColorStop(1, 'rgba(12,12,16,0.92)');
  wrapCtx.fillStyle = sideGradR;
  wrapCtx.fillRect(774, 0, 250, 512);

  // Extract label zone from real photo (center packaging label band for tub/bottle, full for bar/pouch)
  const srcX =
    product.shape === 'tub' || product.shape === 'bottle'
      ? minX + Math.round(cropW * 0.06)
      : minX;
  const srcW =
    product.shape === 'tub' || product.shape === 'bottle'
      ? Math.max(32, Math.round(cropW * 0.88))
      : cropW;
  const srcY =
    product.shape === 'tub'
      ? minY + Math.round(cropH * 0.25)
      : product.shape === 'bottle'
        ? minY + Math.round(cropH * 0.24)
        : product.shape === 'pouch'
          ? minY + Math.round(cropH * 0.1)
          : minY;
  const srcH =
    product.shape === 'tub'
      ? Math.max(32, Math.round(cropH * 0.65))
      : product.shape === 'bottle'
        ? Math.max(32, Math.round(cropH * 0.66))
        : product.shape === 'pouch'
          ? Math.max(32, Math.round(cropH * 0.84))
          : cropH;

  const frontSlotX = 246;
  const frontSlotW = 532;
  const frontSlotH = 488;
  const srcAspect = srcW / srcH;
  let drawW = frontSlotW;
  let drawH = drawW / srcAspect;
  if (drawH > frontSlotH) {
    drawH = frontSlotH;
    drawW = drawH * srcAspect;
  }
  const drawX = frontSlotX + (frontSlotW - drawW) / 2;
  const drawY = (512 - drawH) / 2;

  wrapCtx.drawImage(workCanvas, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);

  const accHexStr = `#${accentColor.getHexString()}`;
  drawBackArcPanels(wrapCtx, product, accHexStr);

  const wrapTexture = new THREE.CanvasTexture(wrapCanvas);
  wrapTexture.colorSpace = THREE.SRGBColorSpace;
  wrapTexture.anisotropy = anisotropy;
  wrapTexture.needsUpdate = true;

  return {
    cutoutTexture,
    wrapTexture,
    aspectRatio,
    capColor,
    bodyColor,
    accentColor,
    disposables: [cutoutTexture, wrapTexture],
  };
}

export function buildRealPhotoShowcaseGroup(
  product: Product,
  initialTexture: THREE.Texture,
  isSoftwareGl: boolean,
): BuiltPhotoShowcase {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const targetH = getShowcaseTargetHeight(product);
  const initialW = product.shape === 'bar' ? targetH * 1.15 : targetH * 0.82;

  const frontMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: initialTexture,
    emissiveIntensity: 0.24,
    roughness: 0.65,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.14,
    side: THREE.FrontSide,
  });

  const backMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: initialTexture,
    emissiveIntensity: 0.18,
    roughness: 0.7,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.14,
    side: THREE.FrontSide,
  });

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: initialTexture,
    alphaTest: 0.14,
  });

  let planeGeo = new THREE.PlaneGeometry(initialW, targetH);

  const frontMesh = new THREE.Mesh(planeGeo, frontMat);
  frontMesh.position.set(0, targetH / 2, 0.008);
  frontMesh.castShadow = !isSoftwareGl;
  frontMesh.customDepthMaterial = depthMat;

  const backMesh = new THREE.Mesh(planeGeo, backMat);
  backMesh.position.set(0, targetH / 2, -0.008);
  backMesh.rotation.y = Math.PI;
  backMesh.castShadow = !isSoftwareGl;
  backMesh.customDepthMaterial = depthMat;

  // Grounded soft ambient occlusion shadow right beneath the product footprint
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 256;
  aoCanvas.height = 256;
  const aoCtx = aoCanvas.getContext('2d')!;
  const aoGrad = aoCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  aoGrad.addColorStop(0, 'rgba(0,0,0,0.52)');
  aoGrad.addColorStop(0.55, 'rgba(0,0,0,0.2)');
  aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 256, 256);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const aoGeo = new THREE.PlaneGeometry(initialW * 1.18, initialW * 0.72);
  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
  });
  const aoMesh = new THREE.Mesh(aoGeo, aoMat);
  aoMesh.rotation.x = -Math.PI / 2;
  aoMesh.position.y = 0.003;

  root.add(aoMesh, frontMesh, backMesh);
  disposables.push(frontMat, backMat, depthMat, aoTex, aoGeo, aoMat, {
    dispose: () => planeGeo.dispose(),
  });

  const applyRealAssets = (assets: RealProductVisualAssets) => {
    const h = getShowcaseTargetHeight(product);
    const w = Math.min(2.65, Math.max(0.85, h * assets.aspectRatio));
    const adjustedH = w / assets.aspectRatio;

    const nextGeo = new THREE.PlaneGeometry(w, adjustedH);
    planeGeo.dispose();
    planeGeo = nextGeo;

    frontMesh.geometry = planeGeo;
    backMesh.geometry = planeGeo;
    frontMesh.position.y = adjustedH / 2;
    backMesh.position.y = adjustedH / 2;
    aoMesh.scale.set(w / initialW, 1, 1);

    frontMat.map = assets.cutoutTexture;
    frontMat.emissiveMap = assets.cutoutTexture;
    frontMat.needsUpdate = true;

    backMat.map = assets.cutoutTexture;
    backMat.emissiveMap = assets.cutoutTexture;
    backMat.needsUpdate = true;

    depthMat.map = assets.cutoutTexture;
    depthMat.needsUpdate = true;
  };

  return {
    root,
    applyRealAssets,
    disposables,
  };
}

export function buildCompositeProductGroup(
  product: Product,
  flavor: ProductFlavor,
  labelTexture: THREE.CanvasTexture,
  isSoftwareGl: boolean,
): BuiltProductModel {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: product.shape === 'bottle' ? 0x261509 : 0x161618,
    roughness: product.shape === 'bottle' ? 0.24 : 0.42,
    metalness: 0.14,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x101012,
    roughness: 0.34,
    metalness: 0.24,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.34,
    metalness: 0.28,
  });
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.22,
    metalness: 0.88,
  });
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTexture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: labelTexture,
    emissiveIntensity: 0.14,
    roughness: 0.32,
    metalness: 0.06,
  });
  const powderColor = new THREE.Color(flavor.colorHex).lerp(new THREE.Color(0xfafaf9), 0.32);
  const powderMat = new THREE.MeshStandardMaterial({
    color: powderColor,
    roughness: 0.92,
    metalness: 0.0,
  });

  disposables.push(bodyMat, capMat, accentMat, foilMat, labelMat, powderMat);

  let lidPart: THREE.Object3D = new THREE.Group();
  let innerPart: THREE.Object3D = new THREE.Group();
  let barFrontMat: THREE.MeshStandardMaterial | null = null;

  if (product.shape === 'bar') {
    barFrontMat = new THREE.MeshStandardMaterial({
      map: labelTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: labelTexture,
      emissiveIntensity: 0.22,
      roughness: 0.36,
      metalness: 0.05,
    });
    disposables.push(barFrontMat);

    const barGeo = new THREE.BoxGeometry(2.14, 0.56, 0.96);
    const barMats = [
      bodyMat,
      bodyMat,
      barFrontMat,
      bodyMat,
      barFrontMat,
      labelMat,
    ];
    const barMesh = new THREE.Mesh(barGeo, barMats);
    barMesh.position.y = 0.36;
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    root.add(barMesh);
    disposables.push(barGeo);

    const finGeo = new THREE.BoxGeometry(0.2, 0.06, 0.98);
    const leftFin = new THREE.Mesh(finGeo, foilMat);
    leftFin.position.set(-1.16, 0.36, 0);
    const rightFin = new THREE.Mesh(finGeo, foilMat);
    rightFin.position.set(1.16, 0.36, 0);
    root.add(leftFin, rightFin);
    disposables.push(finGeo);

    const lidGroup = new THREE.Group();
    const trimGeo = new THREE.BoxGeometry(2.16, 0.07, 0.98);
    const trimMesh = new THREE.Mesh(trimGeo, accentMat);
    trimMesh.position.y = 0.62;
    lidGroup.add(trimMesh);
    root.add(lidGroup);
    lidPart = lidGroup;
    disposables.push(trimGeo);

    const coreGroup = new THREE.Group();
    const coreGeo = new THREE.BoxGeometry(1.78, 0.34, 0.72);
    const coreMesh = new THREE.Mesh(coreGeo, powderMat);
    coreMesh.position.y = 0.38;
    coreMesh.castShadow = true;

    const caramelGeo = new THREE.BoxGeometry(1.72, 0.08, 0.66);
    const caramelMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.35,
      metalness: 0.05,
    });
    const caramelMesh = new THREE.Mesh(caramelGeo, caramelMat);
    caramelMesh.position.y = 0.56;

    coreGroup.add(coreMesh, caramelMesh);
    root.add(coreGroup);
    innerPart = coreGroup;
    disposables.push(coreGeo, caramelGeo, caramelMat);
  } else if (product.shape === 'pouch') {
    const pouchGeo = new THREE.CylinderGeometry(0.84, 1.0, 2.24, 40, 1, false);
    pouchGeo.scale(1.14, 1, 0.5);
    const pouchMesh = new THREE.Mesh(pouchGeo, bodyMat);
    pouchMesh.position.y = 1.12;
    pouchMesh.castShadow = true;
    pouchMesh.receiveShadow = true;
    root.add(pouchMesh);
    disposables.push(pouchGeo);

    const wrapGeo = new THREE.CylinderGeometry(0.86, 0.98, 1.56, 40, 1, true);
    wrapGeo.scale(1.148, 1, 0.508);
    const wrapMesh = new THREE.Mesh(wrapGeo, labelMat);
    wrapMesh.position.y = 1.08;
    wrapMesh.rotation.y = -Math.PI / 2;
    root.add(wrapMesh);
    disposables.push(wrapGeo);

    const seamGeo = new THREE.BoxGeometry(0.06, 2.18, 0.12);
    const seamL = new THREE.Mesh(seamGeo, foilMat);
    seamL.position.set(-1.04, 1.12, 0);
    const seamR = new THREE.Mesh(seamGeo, foilMat);
    seamR.position.set(1.04, 1.12, 0);
    root.add(seamL, seamR);
    disposables.push(seamGeo);

    const zipGroup = new THREE.Group();
    const zipGeo = new THREE.BoxGeometry(1.94, 0.14, 0.18);
    const zipMesh = new THREE.Mesh(zipGeo, accentMat);
    zipMesh.position.y = 2.26;
    const sliderGeo = new THREE.BoxGeometry(0.18, 0.18, 0.24);
    const sliderMesh = new THREE.Mesh(sliderGeo, capMat);
    sliderMesh.position.set(0.55, 2.26, 0);
    zipGroup.add(zipMesh, sliderMesh);
    root.add(zipGroup);
    lidPart = zipGroup;
    disposables.push(zipGeo, sliderGeo);

    const scoopGroup = new THREE.Group();
    const innerPowGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.18, 24);
    innerPowGeo.scale(1.1, 1, 0.45);
    const innerPowMesh = new THREE.Mesh(innerPowGeo, powderMat);
    innerPowMesh.position.y = 1.88;
    const scoopGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.24, 18);
    const scoopMesh = new THREE.Mesh(scoopGeo, accentMat);
    scoopMesh.position.set(0.12, 2.02, 0);
    scoopMesh.rotation.z = -0.3;
    scoopGroup.add(innerPowMesh, scoopMesh);
    root.add(scoopGroup);
    innerPart = scoopGroup;
    disposables.push(innerPowGeo, scoopGeo);
  } else if (product.shape === 'bottle') {
    const bottleGlassMat = new THREE.MeshPhysicalMaterial({
      color: product.category === 'dau-ca' ? 0x5c3010 : 0x1e293b,
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transmission: isSoftwareGl ? 0 : 0.42,
      transparent: true,
      opacity: isSoftwareGl ? 0.88 : 1,
      ior: 1.5,
      thickness: 0.35,
    });
    disposables.push(bottleGlassMat);

    const bottlePts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.62, 0.0),
      new THREE.Vector2(0.67, 0.08),
      new THREE.Vector2(0.67, 1.42),
      new THREE.Vector2(0.56, 1.62),
      new THREE.Vector2(0.45, 1.76),
      new THREE.Vector2(0.45, 1.88),
      new THREE.Vector2(0.0, 1.88),
    ];
    const bottleGeo = new THREE.LatheGeometry(bottlePts, 44);
    const bodyMesh = new THREE.Mesh(bottleGeo, bottleGlassMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);
    disposables.push(bottleGeo);

    const labelGeo = new THREE.CylinderGeometry(0.678, 0.678, 1.06, 44, 1, true);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.78;
    labelMesh.rotation.y = -Math.PI / 2;
    root.add(labelMesh);
    disposables.push(labelGeo);

    const pillGroup = new THREE.Group();
    const pillGeo = new THREE.CapsuleGeometry(0.085, 0.16, 6, 12);
    const pillMat = new THREE.MeshPhysicalMaterial({
      color: product.category === 'dau-ca' ? 0xf59e0b : new THREE.Color(flavor.colorHex),
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 1.0,
    });
    const pillCount = 12;
    const pillInst = new THREE.InstancedMesh(pillGeo, pillMat, pillCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < pillCount; i++) {
      const layer = Math.floor(i / 4);
      const ang = ((i % 4) / 4) * Math.PI * 2 + layer * 0.65;
      const rad = i % 3 === 0 ? 0.18 : 0.34;
      dummy.position.set(
        Math.cos(ang) * rad,
        0.55 + layer * 0.42 + (i % 2) * 0.08,
        Math.sin(ang) * rad,
      );
      dummy.rotation.set(0.45 * i, ang, 0.7 + layer * 0.3);
      dummy.updateMatrix();
      pillInst.setMatrixAt(i, dummy.matrix);
    }
    pillInst.instanceMatrix.needsUpdate = true;
    pillInst.computeBoundingSphere();
    pillGroup.add(pillInst);
    root.add(pillGroup);
    innerPart = pillGroup;
    disposables.push(pillGeo, pillMat);

    const capGroup = new THREE.Group();
    const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 36);
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = 1.98;
    capMesh.castShadow = true;

    const ringGeo = new THREE.TorusGeometry(0.49, 0.025, 12, 36);
    const ringMesh = new THREE.Mesh(ringGeo, accentMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 1.82;

    const foilSealGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.02, 32);
    const foilSealMesh = new THREE.Mesh(foilSealGeo, foilMat);
    foilSealMesh.position.y = 1.87;

    capGroup.add(capMesh, ringMesh, foilSealMesh);
    root.add(capGroup);
    lidPart = capGroup;
    disposables.push(capGeo, ringGeo, foilSealGeo);
  } else {
    // Ergonomic Supplement Tub
    const tubPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.87, 0.0),
      new THREE.Vector2(0.92, 0.08),
      new THREE.Vector2(0.94, 0.22),
      new THREE.Vector2(0.94, 1.56),
      new THREE.Vector2(0.86, 1.72),
      new THREE.Vector2(0.74, 1.88),
      new THREE.Vector2(0.74, 1.96),
      new THREE.Vector2(0.0, 1.96),
    ];
    const tubGeo = new THREE.LatheGeometry(tubPts, 52);
    const tubMesh = new THREE.Mesh(tubGeo, bodyMat);
    tubMesh.castShadow = true;
    tubMesh.receiveShadow = true;
    root.add(tubMesh);
    disposables.push(tubGeo);

    const footRingGeo = new THREE.TorusGeometry(0.905, 0.022, 12, 48);
    const footRing = new THREE.Mesh(footRingGeo, capMat);
    footRing.rotation.x = Math.PI / 2;
    footRing.position.y = 0.06;
    root.add(footRing);
    disposables.push(footRingGeo);

    const labelGeo = new THREE.CylinderGeometry(0.948, 0.946, 1.38, 52, 1, true);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.89;
    labelMesh.rotation.y = -Math.PI / 2;
    root.add(labelMesh);
    disposables.push(labelGeo);

    const powderGroup = new THREE.Group();
    const powderPts = [
      new THREE.Vector2(0.0, 1.78),
      new THREE.Vector2(0.32, 1.77),
      new THREE.Vector2(0.6, 1.72),
      new THREE.Vector2(0.71, 1.66),
      new THREE.Vector2(0.0, 1.66),
    ];
    const powderGeo = new THREE.LatheGeometry(powderPts, 36);
    const powderMesh = new THREE.Mesh(powderGeo, powderMat);

    const scoopCupGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.22, 20);
    const scoopCup = new THREE.Mesh(scoopCupGeo, accentMat);
    scoopCup.position.set(0.16, 1.88, 0.04);
    scoopCup.rotation.z = -0.35;

    const handleGeo = new THREE.BoxGeometry(0.055, 0.36, 0.045);
    const handleMesh = new THREE.Mesh(handleGeo, accentMat);
    handleMesh.position.set(-0.02, 2.02, 0.04);
    handleMesh.rotation.z = 0.78;

    const sealDiscGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.015, 36);
    const sealDisc = new THREE.Mesh(sealDiscGeo, foilMat);
    sealDisc.position.y = 1.97;

    powderGroup.add(powderMesh, scoopCup, handleMesh, sealDisc);
    root.add(powderGroup);
    innerPart = powderGroup;
    disposables.push(powderGeo, scoopCupGeo, handleGeo, sealDiscGeo);

    const capGroup = new THREE.Group();
    const capGeo = new THREE.CylinderGeometry(0.79, 0.8, 0.32, 48);
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = 2.09;
    capMesh.castShadow = true;

    const ribCount = 28;
    const ribGeo = new THREE.BoxGeometry(0.035, 0.24, 0.045);
    const ribInst = new THREE.InstancedMesh(ribGeo, capMat, ribCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < ribCount; i++) {
      const a = (i / ribCount) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 0.795, 2.09, Math.sin(a) * 0.795);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      ribInst.setMatrixAt(i, dummy.matrix);
    }
    ribInst.instanceMatrix.needsUpdate = true;
    ribInst.computeBoundingSphere();

    const topDiscGeo = new THREE.CylinderGeometry(0.72, 0.75, 0.05, 48);
    const topDisc = new THREE.Mesh(topDiscGeo, bodyMat);
    topDisc.position.y = 2.26;

    const medallionGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 32);
    const medallion = new THREE.Mesh(medallionGeo, accentMat);
    medallion.position.y = 2.29;

    const rimGeo = new THREE.TorusGeometry(0.79, 0.028, 12, 48);
    const rimMesh = new THREE.Mesh(rimGeo, accentMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 1.94;

    capGroup.add(capMesh, ribInst, topDisc, medallion, rimMesh);
    root.add(capGroup);
    lidPart = capGroup;
    disposables.push(capGeo, ribGeo, topDiscGeo, medallionGeo, rimGeo);
  }

  const applyRealAssets = (assets: RealProductVisualAssets) => {
    labelMat.map = assets.wrapTexture;
    labelMat.emissiveMap = assets.wrapTexture;
    labelMat.needsUpdate = true;

    if (barFrontMat) {
      barFrontMat.map = assets.cutoutTexture;
      barFrontMat.emissiveMap = assets.cutoutTexture;
      barFrontMat.needsUpdate = true;
    }

    bodyMat.color.copy(assets.bodyColor);
    capMat.color.copy(assets.capColor);
    accentMat.color.copy(assets.accentColor);
  };

  return {
    root,
    lidPart,
    innerPart,
    disposables,
    realSizeLabel: getRealSizeLabel(product),
    applyRealAssets,
  };
}

export function buildShakerBonusGroup(isSoftwareGl: boolean): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const cupMat = new THREE.MeshPhysicalMaterial({
    color: 0x334155,
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.45,
    transparent: true,
    opacity: isSoftwareGl ? 0.72 : 0.92,
    ior: 1.48,
    thickness: 0.25,
  });
  const blackCapMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35,
    metalness: 0.25,
  });
  const orangeMat = new THREE.MeshStandardMaterial({
    color: 0xff5a00,
    roughness: 0.3,
    metalness: 0.45,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.2,
    metalness: 0.92,
  });

  const cupGeo = new THREE.CylinderGeometry(0.42, 0.31, 1.32, 36);
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.position.y = 0.66;
  cupMesh.castShadow = true;

  const ballGeo = new THREE.TorusGeometry(0.14, 0.02, 10, 24);
  const ballMesh = new THREE.Mesh(ballGeo, steelMat);
  ballMesh.position.set(0, 0.28, 0);
  ballMesh.rotation.set(0.6, 0.4, 0.2);

  const collarGeo = new THREE.CylinderGeometry(0.44, 0.43, 0.14, 36);
  const collarMesh = new THREE.Mesh(collarGeo, orangeMat);
  collarMesh.position.y = 1.34;
  collarMesh.castShadow = true;

  const lidGeo = new THREE.CylinderGeometry(0.43, 0.44, 0.18, 36);
  const lidMesh = new THREE.Mesh(lidGeo, blackCapMat);
  lidMesh.position.y = 1.49;
  lidMesh.castShadow = true;

  const spoutGeo = new THREE.CylinderGeometry(0.08, 0.095, 0.2, 20);
  const spoutMesh = new THREE.Mesh(spoutGeo, orangeMat);
  spoutMesh.position.set(0.16, 1.62, 0);

  const loopGeo = new THREE.TorusGeometry(0.11, 0.025, 10, 24);
  const loopMesh = new THREE.Mesh(loopGeo, blackCapMat);
  loopMesh.position.set(-0.24, 1.56, 0);
  loopMesh.rotation.y = Math.PI / 2;

  group.add(cupMesh, ballMesh, collarMesh, lidMesh, spoutMesh, loopMesh);
  disposables.push(
    cupMat,
    blackCapMat,
    orangeMat,
    steelMat,
    cupGeo,
    ballGeo,
    collarGeo,
    lidGeo,
    spoutGeo,
    loopGeo,
  );

  return { group, disposables };
}

export function buildArReticleGroup(): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Subtle neutral placement hairline ring (no sci-fi orange crosshairs)
  const guideRingGeo = new THREE.RingGeometry(0.96, 0.985, 64);
  const guideRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const guideRing = new THREE.Mesh(guideRingGeo, guideRingMat);
  guideRing.rotation.x = -Math.PI / 2;
  guideRing.position.y = 0.002;

  const shadowGeo = new THREE.PlaneGeometry(5, 5);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.36 });
  const shadowCatcher = new THREE.Mesh(shadowGeo, shadowMat);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.001;
  shadowCatcher.receiveShadow = true;

  group.add(guideRing, shadowCatcher);
  disposables.push(guideRingGeo, guideRingMat, shadowGeo, shadowMat);

  return { group, disposables };
}

export function buildVrShowroomGroup(): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Realistic dark slate architectural plinth & floor
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x17171b,
    roughness: 0.62,
    metalness: 0.25,
  });
  const brushedMetalMat = new THREE.MeshStandardMaterial({
    color: 0x52525b,
    roughness: 0.32,
    metalness: 0.78,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e11,
    roughness: 0.78,
    metalness: 0.12,
  });

  const pedGeo = new THREE.CylinderGeometry(1.72, 1.84, 0.12, 64);
  const pedMesh = new THREE.Mesh(pedGeo, baseMat);
  pedMesh.position.y = -0.07;
  pedMesh.receiveShadow = true;

  const rimGeo = new THREE.TorusGeometry(1.73, 0.012, 10, 64);
  const rimMesh = new THREE.Mesh(rimGeo, brushedMetalMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.012;

  const floorGeo = new THREE.CircleGeometry(9, 64);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.135;
  floorMesh.receiveShadow = true;

  // Architectural matte studio columns
  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.16, 5.4, 20);
  const pillarInst = new THREE.InstancedMesh(pillarGeo, baseMat, 6);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const r = 7.2;
    dummy.position.set(Math.cos(a) * r, 2.5, Math.sin(a) * r);
    dummy.rotation.set(0, -a, 0);
    dummy.updateMatrix();
    pillarInst.setMatrixAt(i, dummy.matrix);
  }
  pillarInst.instanceMatrix.needsUpdate = true;
  pillarInst.computeBoundingSphere();

  group.add(floorMesh, pedMesh, rimMesh, pillarInst);
  disposables.push(
    baseMat,
    brushedMetalMat,
    floorMat,
    pedGeo,
    rimGeo,
    floorGeo,
    pillarGeo,
  );

  return { group, disposables };
}
