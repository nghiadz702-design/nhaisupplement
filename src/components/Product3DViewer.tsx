import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Camera,
  Eye,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Product, ProductFlavor } from '../types/product';

export type ViewerMode = '3d' | 'ar' | 'vr';

interface Product3DViewerProps {
  product: Product;
  selectedFlavor: ProductFlavor;
  initialMode?: ViewerMode;
  compact?: boolean;
  onModeChange?: (mode: ViewerMode) => void;
  onClose?: () => void;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

function createProceduralLabelTexture(
  product: Product,
  flavor: ProductFlavor,
  anisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark matte label
  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, 1024, 512);

  // Top flavor color stripe
  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(0, 0, 1024, 72);

  // Orange NhaiSupplement energy stripe
  ctx.fillStyle = '#FF5A00';
  ctx.fillRect(0, 72, 1024, 14);

  // Bottom weight band
  ctx.fillStyle = flavor.accentHex || '#FF5A00';
  ctx.fillRect(0, 428, 1024, 84);

  // Subtle vertical technical grid lines on back side
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 60; x < 1024; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 96);
    ctx.lineTo(x, 420);
    ctx.stroke();
  }

  // Front face centered at x = 512
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px sans-serif';
  ctx.fillText(product.brand.toUpperCase(), 512, 46);

  ctx.font = '800 42px sans-serif';
  const titleLine =
    product.name.length > 26 ? `${product.name.slice(0, 24)}...` : product.name;
  ctx.fillText(titleLine, 512, 162);

  // Highlight nutrition metric box
  ctx.fillStyle = '#18181B';
  ctx.fillRect(312, 194, 400, 74);
  ctx.strokeStyle = '#FF5A00';
  ctx.lineWidth = 3;
  ctx.strokeRect(312, 194, 400, 74);

  ctx.fillStyle = '#FF5A00';
  ctx.font = '800 34px monospace';
  ctx.fillText(
    `${product.nutritionInfo.highlightValue} ${product.nutritionInfo.highlightKey}`,
    512,
    243,
  );

  // Selected flavor badge
  ctx.fillStyle = flavor.colorHex;
  ctx.fillRect(322, 296, 380, 58);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 24px sans-serif';
  ctx.fillText(`VỊ: ${flavor.name.toUpperCase()}`, 512, 334);

  // Website stamp
  ctx.fillStyle = '#A1A1AA';
  ctx.font = '600 20px monospace';
  ctx.fillText('nhaisupplement.com · KHO HÀ NỘI', 512, 396);

  // Bottom bar info
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px monospace';
  ctx.fillText(
    `${product.weightLabel} · ${product.nutritionInfo.servingsPerContainer} SERVINGS`,
    512,
    478,
  );

  // Back face Nutrition Facts panel (left/right wrap edges)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px monospace';
  ctx.fillText('NUTRITION FACTS', 42, 140);
  ctx.font = '500 18px monospace';
  ctx.fillStyle = '#D4D4D8';
  ctx.fillText(`Serving: ${product.nutritionInfo.servingSize}`, 42, 182);
  ctx.fillText(`Calories: ${product.nutritionInfo.calories}`, 42, 214);
  ctx.fillText(`Protein: ${product.nutritionInfo.protein}`, 42, 246);
  ctx.fillText(`Carbs: ${product.nutritionInfo.carbs}`, 42, 278);
  ctx.fillText(`Fat: ${product.nutritionInfo.fat}`, 42, 310);
  ctx.fillStyle = '#FF5A00';
  ctx.fillText('Hotline: 094618430', 42, 360);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function buildCompositeProductGroup(
  product: Product,
  flavor: ProductFlavor,
  labelTexture: THREE.CanvasTexture,
): {
  root: THREE.Group;
  lidPart: THREE.Object3D;
  innerPart: THREE.Object3D;
  disposables: Array<{ dispose: () => void }>;
} {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    color: product.shape === 'bottle' ? 0x2b180b : 0x171717,
    roughness: product.shape === 'bottle' ? 0.22 : 0.48,
    metalness: 0.14,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.35,
    metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff5a00,
    roughness: 0.3,
    metalness: 0.45,
  });
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTexture,
    roughness: 0.34,
    metalness: 0.08,
  });
  const powderMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(flavor.colorHex).lerp(new THREE.Color(0xf5f5f4), 0.35),
    roughness: 0.9,
    metalness: 0.0,
  });

  disposables.push(bodyMat, capMat, accentMat, labelMat, powderMat);

  let lidPart: THREE.Object3D = new THREE.Group();
  let innerPart: THREE.Object3D = new THREE.Group();

  if (product.shape === 'bar') {
    // 1. Primary foil bar wrapper
    const barGeo = new THREE.BoxGeometry(2.1, 0.56, 0.95);
    const barMesh = new THREE.Mesh(barGeo, labelMat);
    barMesh.position.y = 0.42;
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    root.add(barMesh);
    disposables.push(barGeo);

    // 2. Left & right crimped foil fins
    const finGeo = new THREE.BoxGeometry(0.18, 0.08, 0.96);
    const leftFin = new THREE.Mesh(finGeo, capMat);
    leftFin.position.set(-1.12, 0.42, 0);
    const rightFin = new THREE.Mesh(finGeo, capMat);
    rightFin.position.set(1.12, 0.42, 0);
    root.add(leftFin, rightFin);
    disposables.push(finGeo);

    // 3. Orange seal trim
    const trimGeo = new THREE.BoxGeometry(2.12, 0.07, 0.97);
    const trimMesh = new THREE.Mesh(trimGeo, accentMat);
    trimMesh.position.y = 0.42;
    root.add(trimMesh);
    disposables.push(trimGeo);

    // 4. Inner chocolate protein bar core (slides up on explode)
    const coreGroup = new THREE.Group();
    const coreGeo = new THREE.BoxGeometry(1.75, 0.38, 0.72);
    const coreMesh = new THREE.Mesh(coreGeo, powderMat);
    coreMesh.position.y = 0.44;
    coreMesh.castShadow = true;
    coreGroup.add(coreMesh);
    root.add(coreGroup);
    innerPart = coreGroup;
    lidPart = trimMesh;
    disposables.push(coreGeo);
  } else if (product.shape === 'pouch') {
    // Gusseted Stand-Up Pouch (Mass / MyProtein)
    const pouchGeo = new THREE.CylinderGeometry(0.86, 0.98, 2.25, 36, 1, false);
    pouchGeo.scale(1.15, 1, 0.52);
    const pouchMesh = new THREE.Mesh(pouchGeo, bodyMat);
    pouchMesh.position.y = 1.125;
    pouchMesh.castShadow = true;
    pouchMesh.receiveShadow = true;
    root.add(pouchMesh);
    disposables.push(pouchGeo);

    const wrapGeo = new THREE.CylinderGeometry(0.87, 0.96, 1.55, 36, 1, true);
    wrapGeo.scale(1.155, 1, 0.525);
    const wrapMesh = new THREE.Mesh(wrapGeo, labelMat);
    wrapMesh.position.y = 1.1;
    wrapMesh.rotation.y = -Math.PI / 2;
    root.add(wrapMesh);
    disposables.push(wrapGeo);

    // Top zip-lock seal bar
    const zipGroup = new THREE.Group();
    const zipGeo = new THREE.BoxGeometry(1.96, 0.14, 0.16);
    const zipMesh = new THREE.Mesh(zipGeo, accentMat);
    zipMesh.position.y = 2.26;
    zipGroup.add(zipMesh);
    root.add(zipGroup);
    lidPart = zipGroup;
    disposables.push(zipGeo);

    // Inner scoop
    const scoopGroup = new THREE.Group();
    const scoopGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.24, 18);
    const scoopMesh = new THREE.Mesh(scoopGeo, accentMat);
    scoopMesh.position.set(0, 1.85, 0);
    scoopGroup.add(scoopMesh);
    root.add(scoopGroup);
    innerPart = scoopGroup;
    disposables.push(scoopGeo);
  } else if (product.shape === 'bottle') {
    // Vitamin / Fish Oil Bottle
    const baseGeo = new THREE.CylinderGeometry(0.68, 0.65, 1.48, 40);
    const bodyMesh = new THREE.Mesh(baseGeo, bodyMat);
    bodyMesh.position.y = 0.74;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);
    disposables.push(baseGeo);

    // Tapered shoulder
    const shoulderGeo = new THREE.CylinderGeometry(0.46, 0.68, 0.34, 40);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, bodyMat);
    shoulderMesh.position.y = 1.65;
    shoulderMesh.castShadow = true;
    root.add(shoulderMesh);
    disposables.push(shoulderGeo);

    // Label band
    const labelGeo = new THREE.CylinderGeometry(0.692, 0.692, 1.08, 40, 1, true);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.76;
    labelMesh.rotation.y = -Math.PI / 2;
    root.add(labelMesh);
    disposables.push(labelGeo);

    // Cap Group
    const capGroup = new THREE.Group();
    const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 36);
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = 1.98;
    capMesh.castShadow = true;
    const ringGeo = new THREE.TorusGeometry(0.49, 0.025, 12, 36);
    const ringMesh = new THREE.Mesh(ringGeo, accentMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 1.82;
    capGroup.add(capMesh, ringMesh);
    root.add(capGroup);
    lidPart = capGroup;
    disposables.push(capGeo, ringGeo);

    // Golden softgel capsules inside
    const pillGroup = new THREE.Group();
    const pillGeo = new THREE.CapsuleGeometry(0.09, 0.18, 6, 12);
    const pillMat = new THREE.MeshPhysicalMaterial({
      color: product.category === 'dau-ca' ? 0xf59e0b : new THREE.Color(flavor.colorHex),
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
    });
    for (let i = 0; i < 4; i++) {
      const pill = new THREE.Mesh(pillGeo, pillMat);
      const ang = (i / 4) * Math.PI * 2;
      pill.position.set(Math.cos(ang) * 0.22, 1.48 + (i % 2) * 0.12, Math.sin(ang) * 0.22);
      pill.rotation.set(0.4 * i, ang, 0.6);
      pillGroup.add(pill);
    }
    root.add(pillGroup);
    innerPart = pillGroup;
    disposables.push(pillGeo, pillMat);
  } else {
    // Standard Supplement Tub (Whey, Pre-Workout, Creatine, EAA, BCAA)
    // 1. Foot ring
    const footGeo = new THREE.CylinderGeometry(0.92, 0.88, 0.12, 48);
    const footMesh = new THREE.Mesh(footGeo, capMat);
    footMesh.position.y = 0.06;
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    root.add(footMesh);
    disposables.push(footGeo);

    // 2. Main cylindrical tub body
    const tubGeo = new THREE.CylinderGeometry(0.94, 0.92, 1.56, 48);
    const tubMesh = new THREE.Mesh(tubGeo, bodyMat);
    tubMesh.position.y = 0.9;
    tubMesh.castShadow = true;
    tubMesh.receiveShadow = true;
    root.add(tubMesh);
    disposables.push(tubGeo);

    // 3. Wrap label
    const labelGeo = new THREE.CylinderGeometry(0.952, 0.948, 1.24, 48, 1, true);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.88;
    labelMesh.rotation.y = -Math.PI / 2;
    root.add(labelMesh);
    disposables.push(labelGeo);

    // 4. Tapered shoulder
    const shoulderGeo = new THREE.CylinderGeometry(0.75, 0.94, 0.26, 48);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, bodyMat);
    shoulderMesh.position.y = 1.81;
    shoulderMesh.castShadow = true;
    root.add(shoulderMesh);
    disposables.push(shoulderGeo);

    // 5. Inner flavored powder surface + scoop
    const powderGroup = new THREE.Group();
    const powderGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.12, 36);
    const powderMesh = new THREE.Mesh(powderGeo, powderMat);
    powderMesh.position.y = 1.72;
    const scoopGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.22, 20);
    const scoopMesh = new THREE.Mesh(scoopGeo, accentMat);
    scoopMesh.position.set(0.14, 1.88, 0.05);
    scoopMesh.rotation.z = -0.35;
    const handleGeo = new THREE.BoxGeometry(0.06, 0.34, 0.05);
    const handleMesh = new THREE.Mesh(handleGeo, accentMat);
    handleMesh.position.set(-0.02, 2.02, 0.05);
    handleMesh.rotation.z = 0.75;
    powderGroup.add(powderMesh, scoopMesh, handleMesh);
    root.add(powderGroup);
    innerPart = powderGroup;
    disposables.push(powderGeo, scoopGeo, handleGeo);

    // 6. Ribbed Screw Cap + Orange Rim Ring
    const capGroup = new THREE.Group();
    const capGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.32, 48);
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = 2.08;
    capMesh.castShadow = true;
    const topDiscGeo = new THREE.CylinderGeometry(0.74, 0.76, 0.05, 48);
    const topDisc = new THREE.Mesh(topDiscGeo, bodyMat);
    topDisc.position.y = 2.25;
    const rimGeo = new THREE.TorusGeometry(0.79, 0.028, 12, 48);
    const rimMesh = new THREE.Mesh(rimGeo, accentMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 1.94;
    capGroup.add(capMesh, topDisc, rimMesh);
    root.add(capGroup);
    lidPart = capGroup;
    disposables.push(capGeo, topDiscGeo, rimGeo);
  }

  return { root, lidPart, innerPart, disposables };
}

export default function Product3DViewer({
  product,
  selectedFlavor,
  initialMode = '3d',
  compact = false,
  onModeChange,
  onClose,
}: Product3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const [autoRotate, setAutoRotate] = useState(!isSoftwareGl);
  const [exploded, setExploded] = useState(false);
  const [arScale, setArScale] = useState(1);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [arCameraStatus, setArCameraStatus] = useState<'idle' | 'active' | 'fallback'>('idle');
  const [contextLost, setContextLost] = useState(false);

  const modeRef = useRef<ViewerMode>(mode);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const explodedRef = useRef<boolean>(exploded);
  const arScaleRef = useRef<number>(arScale);
  const resetTriggerRef = useRef<number>(0);
  const sceneSwapRef = useRef<{
    swap: (nextProduct: Product, nextFlavor: ProductFlavor) => void;
  } | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSetMode = (nextMode: ViewerMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  modeRef.current = mode;
  autoRotateRef.current = autoRotate;
  explodedRef.current = exploded;
  arScaleRef.current = arScale;

  // Manage AR camera stream when entering/leaving AR mode
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      if (mode !== 'ar') {
        setArCameraStatus('idle');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setArCameraStatus('fallback');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setArCameraStatus('active');
      } catch {
        if (!cancelled) {
          setArCameraStatus('fallback');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [mode]);

  // Core Three.js scene lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(2.4, 2.0, 3.8);

    const stereoLeftCam = new THREE.PerspectiveCamera(42, (width * 0.5) / height, 0.1, 100);
    const stereoRightCam = new THREE.PerspectiveCamera(42, (width * 0.5) / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Environment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4d4d8, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff5a00, 1.1);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // Contact shadow grounding plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0,0,0,0.42)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlaneGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    scene.add(shadowPlane);

    // Persistent refs for hot-swapping flavor/product meshes without recreating WebGL context
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let currentLabelTex = createProceduralLabelTexture(product, selectedFlavor, maxAniso);
    let currentBuilt = buildCompositeProductGroup(product, selectedFlavor, currentLabelTex);
    scene.add(currentBuilt.root);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, product.shape === 'bar' ? 0.45 : 1.0, 0);
    controls.minDistance = 1.9;
    controls.maxDistance = 7.2;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const swapProductRef = {
      swap: (nextProduct: Product, nextFlavor: ProductFlavor) => {
        scene.remove(currentBuilt.root);
        currentLabelTex.dispose();
        currentBuilt.disposables.forEach((d) => d.dispose());

        currentLabelTex = createProceduralLabelTexture(nextProduct, nextFlavor, maxAniso);
        currentBuilt = buildCompositeProductGroup(nextProduct, nextFlavor, currentLabelTex);
        scene.add(currentBuilt.root);
        controls.target.set(0, nextProduct.shape === 'bar' ? 0.45 : 1.0, 0);
        controls.update();
      },
    };
    sceneSwapRef.current = swapProductRef;

    // Reusable temp vectors for stereo/VR camera
    const _eyeOffset = new THREE.Vector3();
    const _rightVec = new THREE.Vector3();
    const _lookDir = new THREE.Vector3();
    const clock = new THREE.Clock();

    let animFrameId = 0;
    let disposed = false;
    let lastResetSignal = resetTriggerRef.current;

    const renderFrame = () => {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.05);

      // Handle camera reset trigger
      if (resetTriggerRef.current !== lastResetSignal) {
        lastResetSignal = resetTriggerRef.current;
        camera.position.set(2.4, 2.0, 3.8);
        controls.target.set(0, currentBuilt.root.children.length && product.shape === 'bar' ? 0.45 : 1.0, 0);
        controls.update();
      }

      // Background mode switch (transparent in AR, studio gray in 3D, dark obsidian in VR)
      const activeMode = modeRef.current;
      if (activeMode === 'ar') {
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
        shadowPlane.visible = false;
      } else if (activeMode === 'vr') {
        scene.background = new THREE.Color(0x0a0a0a);
        renderer.setClearColor(0x0a0a0a, 1);
        shadowPlane.visible = true;
      } else {
        scene.background = new THREE.Color(0xf4f4f5);
        renderer.setClearColor(0xf4f4f5, 1);
        shadowPlane.visible = true;
      }

      // Smoothly damp scale in AR mode
      const targetScale = activeMode === 'ar' ? arScaleRef.current : 1;
      const dampedScale = THREE.MathUtils.damp(currentBuilt.root.scale.x, targetScale, 8, delta);
      currentBuilt.root.scale.setScalar(dampedScale);

      // Smoothly damp lid explode state
      const targetLidY = explodedRef.current ? 0.72 : 0;
      const targetInnerY = explodedRef.current ? 0.34 : 0;
      currentBuilt.lidPart.position.y = THREE.MathUtils.damp(
        currentBuilt.lidPart.position.y,
        targetLidY,
        7,
        delta,
      );
      currentBuilt.innerPart.position.y = THREE.MathUtils.damp(
        currentBuilt.innerPart.position.y,
        targetInnerY,
        7,
        delta,
      );

      // Auto-rotate
      controls.autoRotate = autoRotateRef.current && !isSoftwareGl;
      controls.autoRotateSpeed = 1.6;
      controls.update();

      const curW = container.clientWidth || width;
      const curH = container.clientHeight || height;

      if (activeMode === 'vr') {
        // Stereoscopic Side-By-Side VR Rendering (Left & Right Eye IPD)
        renderer.setScissorTest(true);
        const halfW = Math.floor(curW / 2);
        const ipd = 0.064;

        camera.getWorldDirection(_lookDir);
        _rightVec.crossVectors(_lookDir, camera.up).normalize();

        // Left eye
        stereoLeftCam.fov = camera.fov;
        stereoLeftCam.aspect = halfW / curH;
        stereoLeftCam.near = camera.near;
        stereoLeftCam.far = camera.far;
        stereoLeftCam.updateProjectionMatrix();
        _eyeOffset.copy(_rightVec).multiplyScalar(-ipd * 0.5);
        stereoLeftCam.position.copy(camera.position).add(_eyeOffset);
        stereoLeftCam.lookAt(controls.target);

        renderer.setViewport(0, 0, halfW, curH);
        renderer.setScissor(0, 0, halfW, curH);
        renderer.render(scene, stereoLeftCam);

        // Right eye
        stereoRightCam.fov = camera.fov;
        stereoRightCam.aspect = halfW / curH;
        stereoRightCam.near = camera.near;
        stereoRightCam.far = camera.far;
        stereoRightCam.updateProjectionMatrix();
        _eyeOffset.copy(_rightVec).multiplyScalar(ipd * 0.5);
        stereoRightCam.position.copy(camera.position).add(_eyeOffset);
        stereoRightCam.lookAt(controls.target);

        renderer.setViewport(halfW, 0, curW - halfW, curH);
        renderer.setScissor(halfW, 0, curW - halfW, curH);
        renderer.render(scene, stereoRightCam);

        renderer.setScissorTest(false);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, curW, curH);
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        animFrameId = window.setTimeout(() => {
          if (!disposed) requestAnimationFrame(renderFrame);
        }, 80);
      } else {
        animFrameId = requestAnimationFrame(renderFrame);
      }
    };

    animFrameId = requestAnimationFrame(renderFrame);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      sceneSwapRef.current = null;
      cancelAnimationFrame(animFrameId);
      clearTimeout(animFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      currentLabelTex.dispose();
      envTex.dispose();
      shadowTex.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      currentBuilt.disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  const hasMountedSwapRef = useRef(false);
  useEffect(() => {
    if (!hasMountedSwapRef.current) {
      hasMountedSwapRef.current = true;
      return;
    }
    sceneSwapRef.current?.swap(product, selectedFlavor);
  }, [product, selectedFlavor]);

  return (
    <div
      className={`relative w-full overflow-hidden border border-neutral-200 bg-neutral-100 ${
        compact ? 'h-[360px] sm:h-[420px]' : 'h-[480px] sm:h-[560px]'
      }`}
    >
      {/* Live Camera Feed Layer in AR Mode */}
      {mode === 'ar' && (
        <div className="absolute inset-0 z-0 bg-neutral-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${
              arCameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {arCameraStatus === 'fallback' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-24 text-center"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, #3f3f46 0%, #18181b 65%, #09090b 100%)',
              }}
            >
              {/* Simulated Tabletop AR Grid */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-35"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,90,0,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,90,0,0.4) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                  transform: 'perspective(400px) rotateX(62deg)',
                  transformOrigin: 'bottom',
                }}
              />
              <span className="relative z-10 bg-black/80 px-3 py-1.5 text-xs font-medium text-neutral-300">
                Chế độ AR mô phỏng mặt bàn (Trình duyệt chưa cấp quyền Camera)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stereoscopic VR Eye Divider & Reticle */}
      {mode === 'vr' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex">
          <div className="relative flex-1 border-r border-white/25">
            <div className="absolute left-3 top-3 bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white/80">
              LEFT EYE · VR
            </div>
          </div>
          <div className="relative flex-1">
            <div className="absolute right-3 top-3 bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white/80">
              RIGHT EYE · VR
            </div>
          </div>
        </div>
      )}

      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="relative z-[5] h-full w-full cursor-grab active:cursor-grabbing" />

      {contextLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-100 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">
            WebGL tạm gián đoạn. Vui lòng chọn lại chế độ xem hoặc tải lại trang.
          </p>
        </div>
      )}

      {/* Top Minimal Spec Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-4">
        <div className="pointer-events-auto bg-neutral-950/90 px-3 py-2 text-white">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-300">
            <span className="font-mono text-[#FF5A00]">
              {mode === '3d' ? '3D INTERACTIVE' : mode === 'ar' ? 'AR CAMERA' : 'VR STEREO'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[160px] sm:max-w-[260px]">{selectedFlavor.name}</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-white">
            Kéo để xoay 360° · Cuộn để phóng to
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng trình xem 3D"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center bg-neutral-950 text-white transition-colors hover:bg-[#FF5A00]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 flex items-center gap-1.5 bg-neutral-950 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#FF5A00]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {dockCollapsed ? 'Mở thanh điều khiển 3D/AR/VR' : 'Thu gọn điều khiển'}
        </button>

        {!dockCollapsed && (
          <div className="flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 border border-neutral-800 bg-neutral-950/95 p-2 text-white">
            {/* Mode Switcher: 3D | AR | VR */}
            <div className="flex items-center gap-1 bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => handleSetMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  mode === '3d'
                    ? 'bg-[#FF5A00] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                3D
              </button>
              <button
                type="button"
                onClick={() => handleSetMode('ar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  mode === 'ar'
                    ? 'bg-[#FF5A00] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                AR Camera
              </button>
              <button
                type="button"
                onClick={() => handleSetMode('vr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  mode === 'vr'
                    ? 'bg-[#FF5A00] text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                VR Stereo
              </button>
            </div>

            {/* AR Scale Slider when in AR mode */}
            {mode === 'ar' && (
              <label className="flex items-center gap-2 px-2 text-xs text-neutral-300">
                <span className="whitespace-nowrap">Tỉ lệ AR</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={arScale}
                  onChange={(e) => setArScale(Number(e.target.value))}
                  className="w-20 accent-[#FF5A00]"
                />
              </label>
            )}

            {/* Action Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setExploded((v) => !v)}
                className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  exploded
                    ? 'bg-white text-neutral-950'
                    : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                }`}
              >
                {exploded ? 'Đóng nắp' : 'Mở nắp xem lõi'}
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                title={autoRotate ? 'Tạm dừng tự xoay' : 'Tự xoay 360°'}
              >
                {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{autoRotate ? 'Dừng' : 'Xoay'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetTriggerRef.current += 1;
                  setExploded(false);
                  setArScale(1);
                }}
                className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                title="Đặt lại góc nhìn"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
