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
  cutoutCanvas: HTMLCanvasElement;
  aspectRatio: number;
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
  if (product.shape === 'bar') return 1.56;
  if (product.shape === 'bottle') return 2.02;
  if (product.shape === 'pouch') return 2.18;
  return 2.18;
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

export async function loadRealProductVisuals(
  _product: Product,
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

  try {
    const imageData = workCtx.getImageData(0, 0, w, h);
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
      return lum >= 228 && maxC - minC <= 28;
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
        if (lum > 202 && maxC - minC < 34) {
          const factor = Math.max(0.22, 1 - bgNeighbors * 0.24);
          data[o + 3] = Math.round(data[o + 3] * factor);
        }
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
  } catch {
    // Fallback cleanly to full image without pixel manipulation if restricted
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const aspectRatio = cropW / cropH;

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

  return {
    cutoutTexture,
    cutoutCanvas,
    aspectRatio,
    disposables: [cutoutTexture],
  };
}

function createBackNutritionTexture(
  product: Product,
  flavor: ProductFlavor,
  anisotropy: number,
): THREE.CanvasTexture {
  const transparency = getProductTransparencyInfo(product, flavor);
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  // Dark brushed studio backing
  ctx.fillStyle = '#0D0D10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer hairline frame
  ctx.strokeStyle = '#FF5A00';
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Header strip
  ctx.fillStyle = '#FF5A00';
  ctx.fillRect(28, 28, canvas.width - 56, 48);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('THÔNG TIN MINH BẠCH · CHÍNH HÃNG', 44, 59);

  // Product & brand origin summary
  ctx.fillStyle = '#A1A1AA';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(
    `NSX: ${transparency.manufacturerShort.toUpperCase()} · ${product.weightLabel.toUpperCase()}`,
    32,
    108,
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px sans-serif';
  const truncatedName =
    product.name.length > 34 ? `${product.name.slice(0, 32)}…` : product.name;
  ctx.fillText(truncatedName, 32, 142);

  // Flavor & stock indicator badge
  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(32, 160, 16, 16);
  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`Vị: ${flavor.name} · Còn ${flavor.stock} hộp`, 58, 174);

  // Divider
  ctx.fillStyle = '#27272A';
  ctx.fillRect(32, 194, canvas.width - 64, 3);

  // Category-adaptive transparent nutrition & spec rows
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
      ctx.fillStyle = '#18181B';
      ctx.fillRect(32, y - 26, canvas.width - 64, 42);
    }
    ctx.fillStyle = '#D4D4D8';
    ctx.font = '17px sans-serif';
    const shortLabel = label.length > 22 ? `${label.slice(0, 20)}…` : label;
    ctx.fillText(shortLabel, 44, y);

    ctx.fillStyle = accent ? '#FF5A00' : '#FFFFFF';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    const shortValue = value.length > 26 ? `${value.slice(0, 24)}…` : value;
    ctx.fillText(shortValue, canvas.width - 44, y);
    ctx.textAlign = 'left';
    y += 45;
  });

  // Usage note box (wrapped cleanly up to 2 lines)
  ctx.fillStyle = '#18181B';
  ctx.fillRect(32, 594, canvas.width - 64, 92);
  ctx.strokeStyle = '#3F3F46';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 594, canvas.width - 64, 92);

  ctx.fillStyle = '#FF5A00';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('HƯỚNG DẪN DÙNG · NHAISUPPLEMENT.COM', 46, 620);
  ctx.fillStyle = '#E4E4E7';
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

export function buildRealPhotoShowcaseGroup(
  product: Product,
  flavor: ProductFlavor,
  isSoftwareGl: boolean,
  anisotropy: number,
): BuiltPhotoShowcase {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const dims = getRealPhysicalDimensions(product);
  const targetH = getShowcaseTargetHeight(product);
  const initialW = product.shape === 'bar' ? targetH * 1.15 : targetH * 0.82;

  const placeholderTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  placeholderTex.needsUpdate = true;

  const frontMat = new THREE.MeshStandardMaterial({
    map: placeholderTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: placeholderTex,
    emissiveIntensity: 0.28,
    color: new THREE.Color(0xffffff),
    roughness: 0.62,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.14,
    side: THREE.FrontSide,
  });

  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: placeholderTex,
    alphaTest: 0.14,
  });

  let planeGeo = new THREE.PlaneGeometry(initialW, targetH);
  const photoMesh = new THREE.Mesh(planeGeo, frontMat);
  photoMesh.position.set(0, targetH / 2, 0.014);
  photoMesh.castShadow = !isSoftwareGl;
  photoMesh.customDepthMaterial = depthMat;

  // Back Nutrition & Spec Plate (visible smoothly when flipped 180 deg)
  const backTex = createBackNutritionTexture(product, flavor, anisotropy);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: backTex,
    emissiveIntensity: 0.24,
    roughness: 0.45,
    metalness: 0.08,
    side: THREE.FrontSide,
  });
  let backGeo = new THREE.PlaneGeometry(initialW * 0.62, targetH * 0.68);
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.position.set(0, targetH * 0.48, -0.014);
  backMesh.rotation.y = Math.PI;
  backMesh.visible = false;

  // Grounded soft ambient occlusion shadow right beneath the product footprint
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 256;
  aoCanvas.height = 256;
  const aoCtx = aoCanvas.getContext('2d')!;
  const aoGrad = aoCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  aoGrad.addColorStop(0, 'rgba(0,0,0,0.58)');
  aoGrad.addColorStop(0.54, 'rgba(0,0,0,0.22)');
  aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
  aoCtx.fillStyle = aoGrad;
  aoCtx.fillRect(0, 0, 256, 256);
  const aoTex = new THREE.CanvasTexture(aoCanvas);
  const aoGeo = new THREE.PlaneGeometry(initialW * 1.24, initialW * 0.78);
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

  root.add(aoMesh, photoMesh, backMesh, rulerGroup);
  disposables.push(
    placeholderTex,
    frontMat,
    depthMat,
    backTex,
    backMat,
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
        planeGeo.dispose();
        backGeo.dispose();
      },
    },
  );

  let currentShowcaseHeight = targetH;

  const applyRealAssets = (assets: RealProductVisualAssets) => {
    const h = getShowcaseTargetHeight(product);
    const w = Math.min(2.65, Math.max(0.85, h * assets.aspectRatio));
    const adjustedH = w / assets.aspectRatio;
    currentShowcaseHeight = adjustedH;

    const nextGeo = new THREE.PlaneGeometry(w, adjustedH);
    planeGeo.dispose();
    planeGeo = nextGeo;

    photoMesh.geometry = planeGeo;
    photoMesh.position.y = adjustedH / 2;

    const nextBackGeo = new THREE.PlaneGeometry(Math.min(w * 0.64, 1.38), adjustedH * 0.7);
    backGeo.dispose();
    backGeo = nextBackGeo;
    backMesh.geometry = backGeo;
    backMesh.position.y = adjustedH * 0.48;

    aoMesh.scale.set(w / initialW, 1, 1);

    // Resize ruler to match exact photo top edge
    stemMesh.scale.y = adjustedH / targetH;
    stemMesh.position.y = adjustedH / 2;
    topTick.position.y = adjustedH;
    rulerLabelMesh.position.y = adjustedH * 0.5;
    rulerGroup.position.x = w * 0.5 + 0.14;

    frontMat.map = assets.cutoutTexture;
    frontMat.emissiveMap = assets.cutoutTexture;
    frontMat.needsUpdate = true;

    depthMat.map = assets.cutoutTexture;
    depthMat.needsUpdate = true;
  };

  const setLightTint = (brightness: number, rTint = 1, gTint = 1, bTint = 1) => {
    const clamped = Math.min(1.45, Math.max(0.65, brightness));
    frontMat.color.setRGB(clamped * rTint, clamped * gTint, clamped * bTint);
    frontMat.emissiveIntensity = 0.24 * clamped;
  };

  const setRulerVisible = (visible: boolean) => {
    rulerGroup.visible = visible;
  };

  const setFacingBack = (isBack: boolean) => {
    photoMesh.visible = !isBack;
    backMesh.visible = isBack;
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

  const outerRingGeo = new THREE.RingGeometry(0.92, 0.96, 64);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xff5a00,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.002;

  const innerRingGeo = new THREE.RingGeometry(0.64, 0.66, 64);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.002;

  const shadowGeo = new THREE.PlaneGeometry(6, 6);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.42 });
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

  // Architectural concentric showroom rings
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

  // Architectural matte studio columns for spatial 360° VR depth
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

  // Centered angled VR Spec Plaque on the front rim of the pedestal
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

  const photoMat = new THREE.MeshStandardMaterial({
    map: assets.cutoutTexture,
    alphaTest: 0.2,
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const photoGeo = new THREE.PlaneGeometry(wMeters, hMeters);
  const photoMesh = new THREE.Mesh(photoGeo, photoMat);
  photoMesh.position.set(0, hMeters / 2, 0);

  exportScene.add(photoMesh);

  const exporter = new USDZExporter();
  const arraybuffer = await exporter.parseAsync(exportScene);

  photoGeo.dispose();
  photoMat.dispose();

  const blob = new Blob([arraybuffer], { type: 'model/vnd.usdz+zip' });
  return URL.createObjectURL(blob);
}
