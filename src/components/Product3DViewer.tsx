import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XREstimatedLight } from 'three/addons/webxr/XREstimatedLight.js';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Eye,
  FlipHorizontal2,
  Glasses,
  Hand,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Ruler,
  Scan,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import type { Product, ProductFlavor } from '../types/product';
import {
  checkIsAppleMobile,
  checkIsMobilePhone,
  useIsMobilePhone,
} from '../utils/deviceDetection';
import {
  buildArReticleGroup,
  buildRealPhotoShowcaseGroup,
  buildVrShowroomGroup,
  generateUsdzBlobUrl,
  getRealPhysicalDimensions,
  loadRealProductVisuals,
  type BuiltPhotoShowcase,
  type RealProductVisualAssets,
} from '../utils/product3DBuilder';

export type ViewerMode = 'ar' | 'vr';

interface Product3DViewerProps {
  product: Product;
  selectedFlavor: ProductFlavor;
  initialMode?: ViewerMode;
  compact?: boolean;
  productsList?: Product[];
  onSelectProduct?: (nextProduct: Product) => void;
  onSelectFlavor?: (nextFlavor: ProductFlavor) => void;
  onModeChange?: (mode: ViewerMode) => void;
  onClose?: () => void;
}

interface XrSystemCompat {
  isSessionSupported?: (mode: string) => Promise<boolean>;
  requestSession?: (mode: string, init?: Record<string, unknown>) => Promise<XRSession>;
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

// Pre-allocated math helpers outside render loop (zero GC)
const _eyeOffset = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _arWorldOffset = new THREE.Vector3();
const _xrCamWorldPos = new THREE.Vector3();
const _hitMatrix = new THREE.Matrix4();

function getViewerCameraVectors(
  shape: Product['shape'],
  compact: boolean,
  posOut: THREE.Vector3,
  targetOut: THREE.Vector3,
) {
  const scaleDist = compact ? 1.14 : 1.02;
  const targetY = shape === 'bar' ? 0.56 : 0.88;
  targetOut.set(0, targetY, 0);
  posOut.set(0.32 * scaleDist, targetY + 0.5 * scaleDist, 4.85 * scaleDist);
}

export default function Product3DViewer({
  product,
  selectedFlavor,
  initialMode = 'ar',
  compact = false,
  productsList,
  onSelectProduct,
  onSelectFlavor,
  onModeChange,
  onClose,
}: Product3DViewerProps) {
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const quickLookLinkRef = useRef<HTMLAnchorElement>(null);
  const lightSampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isMobilePhone = useIsMobilePhone();
  const isAppleMobile = checkIsAppleMobile();
  const safeInitialMode: ViewerMode =
    initialMode === 'vr' && !checkIsMobilePhone() ? 'ar' : initialMode;

  const [mode, setMode] = useState<ViewerMode>(safeInitialMode);
  const [vrMobileNotice, setVrMobileNotice] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [arScale, setArScale] = useState(1);
  const [arBrightness, setArBrightness] = useState(1.02);
  const [autoLightMatch, setAutoLightMatch] = useState(true);
  const [arFacing, setArFacing] = useState<'environment' | 'user'>('environment');
  const [arOffset, setArOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [arInteractMode, setArInteractMode] = useState<'move' | 'orbit'>('move');
  const [showBackFacts, setShowBackFacts] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [arRetryNonce, setArRetryNonce] = useState(0);
  const [vrIpdMm, setVrIpdMm] = useState(64);
  const [vrGyroActive, setVrGyroActive] = useState(false);
  const [vrGyroHint, setVrGyroHint] = useState<string | null>(null);
  const [arParallaxActive, setArParallaxActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [arCameraStatus, setArCameraStatus] = useState<'idle' | 'active' | 'fallback'>('idle');
  const [photoStatus, setPhotoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contextLost, setContextLost] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [webglRetryNonce, setWebglRetryNonce] = useState(0);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  // Native WebXR & Apple AR Quick Look support flags
  const [xrArSupported, setXrArSupported] = useState(false);
  const [xrVrSupported, setXrVrSupported] = useState(false);
  const [xrSessionType, setXrSessionType] = useState<'none' | 'ar' | 'vr'>('none');
  const [xrArPlaced, setXrArPlaced] = useState(false);
  const [usdzGenerating, setUsdzGenerating] = useState(false);
  const [usdzUrl, setUsdzUrl] = useState<string | null>(null);

  const modeRef = useRef<ViewerMode>(mode);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const arScaleRef = useRef<number>(arScale);
  const arBrightnessRef = useRef<number>(arBrightness);
  const arTintRef = useRef<{ r: number; g: number; b: number; luma: number }>({
    r: 1,
    g: 1,
    b: 1,
    luma: 1,
  });
  const arOffsetRef = useRef<{ x: number; z: number }>(arOffset);
  const arInteractModeRef = useRef<'move' | 'orbit'>(arInteractMode);
  const showBackFactsRef = useRef<boolean>(showBackFacts);
  const showRulerRef = useRef<boolean>(showRuler);
  const vrIpdRef = useRef<number>(vrIpdMm);
  const compactRef = useRef<boolean>(compact);
  const currentProductRef = useRef<Product>(product);
  const gyroDeltaRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const cameraResetRef = useRef<boolean>(false);
  const xrSessionTypeRef = useRef<'none' | 'ar' | 'vr'>('none');
  const xrPlacedRef = useRef<boolean>(false);

  const sceneControllerRef = useRef<{
    swap: (nextProduct: Product, nextFlavor: ProductFlavor) => void;
    capture: () => void;
    setRuler: (visible: boolean) => void;
    exportUsdz: () => Promise<string | null>;
    startWebXrAr: () => Promise<void>;
    startWebXrVr: () => Promise<void>;
    endWebXr: () => Promise<void>;
    resetWebXrPlacement: () => void;
  } | null>(null);

  // Probe WebXR hardware capabilities silently
  useEffect(() => {
    const navXr = (navigator as Navigator & { xr?: XrSystemCompat }).xr;
    if (!navXr || typeof navXr.isSessionSupported !== 'function') return;

    navXr
      .isSessionSupported('immersive-ar')
      .then((supported) => setXrArSupported(Boolean(supported)))
      .catch(() => setXrArSupported(false));

    navXr
      .isSessionSupported('immersive-vr')
      .then((supported) => setXrVrSupported(Boolean(supported)))
      .catch(() => setXrVrSupported(false));
  }, []);

  useEffect(() => {
    const resolvedMode: ViewerMode =
      initialMode === 'vr' && !isMobilePhone ? 'ar' : initialMode;
    setMode(resolvedMode);
    cameraResetRef.current = true;
  }, [initialMode, isMobilePhone]);

  useEffect(() => {
    if (!isMobilePhone && mode === 'vr') {
      setMode('ar');
      setVrGyroActive(false);
      onModeChange?.('ar');
    }
  }, [isMobilePhone, mode, onModeChange]);

  const handleSetMode = (nextMode: ViewerMode) => {
    if (nextMode === 'vr' && !isMobilePhone) {
      setVrMobileNotice(true);
      window.setTimeout(() => setVrMobileNotice(false), 3200);
      return;
    }
    setVrMobileNotice(false);
    setMode(nextMode);
    if (nextMode !== 'vr' && vrGyroActive) {
      setVrGyroActive(false);
    }
    cameraResetRef.current = true;
    onModeChange?.(nextMode);
  };

  modeRef.current = mode;
  autoRotateRef.current = autoRotate;
  arScaleRef.current = arScale;
  arBrightnessRef.current = arBrightness;
  arOffsetRef.current = arOffset;
  arInteractModeRef.current = arInteractMode;
  showBackFactsRef.current = showBackFacts;
  showRulerRef.current = showRuler;
  vrIpdRef.current = vrIpdMm;
  compactRef.current = compact;
  currentProductRef.current = product;
  xrSessionTypeRef.current = xrSessionType;

  useEffect(() => {
    sceneControllerRef.current?.setRuler(showRuler);
  }, [showRuler]);

  // Revoke generated USDZ blob URL when switching product/flavor or unmounting
  useEffect(() => {
    return () => {
      if (usdzUrl) {
        URL.revokeObjectURL(usdzUrl);
      }
    };
  }, [usdzUrl]);

  useEffect(() => {
    setUsdzUrl(null);
  }, [product.id, selectedFlavor.id]);

  // Track Fullscreen API state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerRootRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    const rootEl = viewerRootRef.current;
    if (!rootEl) return;
    try {
      if (document.fullscreenElement === rootEl) {
        await document.exitFullscreen();
      } else if (rootEl.requestFullscreen) {
        await rootEl.requestFullscreen();
      }
    } catch {
      // Ignore if fullscreen is blocked inside restricted iframe
    }
  };

  // Gyroscope Head-Tracking (VR Mode) & Gentle Tilt Parallax (AR Mode)
  const useGyroNow = (mode === 'vr' && vrGyroActive) || (mode === 'ar' && arParallaxActive);
  useEffect(() => {
    if (!useGyroNow) {
      gyroDeltaRef.current = null;
      return;
    }

    let baseAlpha: number | null = null;
    let basePitchDeg: number | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null) return;
      const screenAngle =
        typeof window.screen?.orientation?.angle === 'number'
          ? window.screen.orientation.angle
          : 0;
      const rawPitch =
        screenAngle === 90
          ? -(event.gamma ?? 0)
          : screenAngle === 270
            ? (event.gamma ?? 0)
            : event.beta;

      if (baseAlpha === null || basePitchDeg === null) {
        baseAlpha = event.alpha;
        basePitchDeg = rawPitch;
        return;
      }
      let dAlpha = event.alpha - baseAlpha;
      if (dAlpha > 180) dAlpha -= 360;
      if (dAlpha < -180) dAlpha += 360;
      const dPitch = THREE.MathUtils.clamp(rawPitch - basePitchDeg, -45, 45);
      gyroDeltaRef.current = {
        yaw: THREE.MathUtils.degToRad(dAlpha),
        pitch: THREE.MathUtils.degToRad(dPitch),
      };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      gyroDeltaRef.current = null;
    };
  }, [useGyroNow]);

  const requestMotionPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setVrGyroHint('Thiết bị không có cảm biến xoay (hãy chạm kéo để nhìn 360°)');
      return false;
    }
    const devOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof devOrient.requestPermission === 'function') {
      try {
        const perm = await devOrient.requestPermission();
        if (perm !== 'granted') {
          setVrGyroHint('Chưa được cấp quyền cảm biến chuyển động');
          return false;
        }
      } catch {
        setVrGyroHint('Không thể bật cảm biến trên trình duyệt này');
        return false;
      }
    }
    return true;
  };

  const toggleVrGyro = async () => {
    if (vrGyroActive) {
      setVrGyroActive(false);
      setVrGyroHint(null);
      return;
    }
    const ok = await requestMotionPermission();
    if (!ok) return;
    setVrGyroHint(null);
    setAutoRotate(false);
    setVrGyroActive(true);
  };

  const toggleArParallax = async () => {
    if (arParallaxActive) {
      setArParallaxActive(false);
      return;
    }
    const ok = await requestMotionPermission();
    if (ok) {
      setArParallaxActive(true);
    }
  };

  // Manage live AR camera stream when entering/leaving AR mode or switching camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      if (mode !== 'ar' || xrSessionType === 'ar') {
        setArCameraStatus('idle');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setArCameraStatus('fallback');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: arFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
  }, [mode, arFacing, arRetryNonce, xrSessionType]);

  // Automatic Room Brightness & Color Warmth Estimation from live camera video
  useEffect(() => {
    if (mode !== 'ar' || arCameraStatus !== 'active' || !autoLightMatch) {
      arTintRef.current = { r: 1, g: 1, b: 1, luma: 1 };
      return;
    }
    if (!lightSampleCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      lightSampleCanvasRef.current = c;
    }

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const sampleCanvas = lightSampleCanvasRef.current;
      if (!video || !sampleCanvas || video.readyState < 2) return;
      const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        const pxCount = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
        }
        const rAvg = rSum / pxCount;
        const gAvg = gSum / pxCount;
        const bAvg = bSum / pxCount;
        const avgAll = Math.max(1, (rAvg + gAvg + bAvg) / 3);
        const lumaFactor = THREE.MathUtils.clamp(0.76 + (avgAll / 255) * 0.42, 0.75, 1.18);
        arTintRef.current = {
          luma: lumaFactor,
          r: THREE.MathUtils.clamp(0.86 + (rAvg / avgAll) * 0.14, 0.9, 1.1),
          g: THREE.MathUtils.clamp(0.88 + (gAvg / avgAll) * 0.12, 0.92, 1.08),
          b: THREE.MathUtils.clamp(0.86 + (bAvg / avgAll) * 0.14, 0.9, 1.1),
        };
      } catch {
        // Ignore restricted video pixel read
      }
    }, 700);

    return () => window.clearInterval(timer);
  }, [mode, arCameraStatus, autoLightMatch]);

  // Direct Canvas Drag-to-Place & Two-Finger Pinch-to-Scale in AR Move Mode
  useEffect(() => {
    const el = mountRef.current;
    if (!el || mode !== 'ar' || arInteractMode !== 'move' || xrSessionType !== 'none') return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchStartDist = 0;
    let pinchStartScale = arScaleRef.current;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerType === 'touch') return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      setArOffset((prev) => ({
        x: THREE.MathUtils.clamp(prev.x + dx * 0.009, -1.7, 1.7),
        z: THREE.MathUtils.clamp(prev.z + dy * 0.009, -1.7, 1.7),
      }));
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        dragging = false;
        pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
        pinchStartScale = arScaleRef.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && dragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        setArOffset((prev) => ({
          x: THREE.MathUtils.clamp(prev.x + dx * 0.009, -1.7, 1.7),
          z: THREE.MathUtils.clamp(prev.z + dy * 0.009, -1.7, 1.7),
        }));
      } else if (e.touches.length === 2 && pinchStartDist > 0) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const ratio = dist / pinchStartDist;
        setArScale(THREE.MathUtils.clamp(Number((pinchStartScale * ratio).toFixed(2)), 0.45, 1.8));
      }
    };
    const onTouchEnd = () => {
      dragging = false;
      pinchStartDist = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setArScale((prev) => THREE.MathUtils.clamp(Number((prev - e.deltaY * 0.001).toFixed(2)), 0.45, 1.8));
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [mode, arInteractMode, xrSessionType]);

  // Core Three.js & WebXR lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    const vrBgColor = new THREE.Color(0x070709);
    const vrFog = new THREE.Fog(0x070709, 8.0, 20);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
    getViewerCameraVectors(
      currentProductRef.current.shape,
      compactRef.current,
      camera.position,
      _camGoalTarget,
    );

    const stereoLeftCam = new THREE.PerspectiveCamera(44, (width * 0.5) / height, 0.05, 100);
    const stereoRightCam = new THREE.PerspectiveCamera(44, (width * 0.5) / height, 0.05, 100);

    let renderer: THREE.WebGLRenderer;
    let envTex: THREE.Texture;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.xr.enabled = true;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();
      setWebglError(false);
    } catch {
      setWebglError(true);
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4d4d8, 0.88);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf3, 1.45);
    keyLight.position.set(3.5, 6, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.2;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.8;
    keyLight.shadow.camera.right = 2.8;
    keyLight.shadow.camera.top = 2.8;
    keyLight.shadow.camera.bottom = -2.8;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff5a00, 0.42);
    rimLight.position.set(-4, 3.2, -3.5);
    scene.add(rimLight);

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let currentPhotoShowcase: BuiltPhotoShowcase = buildRealPhotoShowcaseGroup(
      product,
      selectedFlavor,
      isSoftwareGl,
      maxAniso,
    );
    currentPhotoShowcase.root.visible = false;
    let currentRealAssets: RealProductVisualAssets | null = null;
    let realPhotoReady = false;
    let activeSwapToken = 0;

    stageGroup.add(currentPhotoShowcase.root);

    const loadAndApplyProductPhotos = (
      targetProduct: Product,
      targetFlavor: ProductFlavor,
      token: number,
    ) => {
      setPhotoStatus('loading');
      loadRealProductVisuals(targetProduct, targetFlavor, maxAniso)
        .then((assets) => {
          if (disposed || token !== activeSwapToken) {
            assets?.disposables.forEach((d) => d.dispose());
            return;
          }
          if (!assets) {
            setPhotoStatus('error');
            return;
          }
          if (currentRealAssets) {
            currentRealAssets.disposables.forEach((d) => d.dispose());
          }
          currentRealAssets = assets;
          currentPhotoShowcase.applyRealAssets(assets);
          currentPhotoShowcase.setRulerVisible(showRulerRef.current);
          currentPhotoShowcase.root.visible = true;
          realPhotoReady = true;
          setPhotoStatus('ready');
        })
        .catch(() => {
          if (!disposed && token === activeSwapToken) {
            setPhotoStatus('error');
          }
        });
    };

    const arReticle = buildArReticleGroup();
    arReticle.group.visible = false;
    stageGroup.add(arReticle.group);

    // WebXR surface hit reticle (scaled to real meters ~18cm ring)
    const xrReticle = buildArReticleGroup();
    xrReticle.group.scale.setScalar(0.11);
    xrReticle.group.visible = false;
    scene.add(xrReticle.group);

    const vrShowroom = buildVrShowroomGroup(product, selectedFlavor, maxAniso);
    vrShowroom.group.visible = false;
    scene.add(vrShowroom.group);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.copy(_camGoalTarget);
    controls.minDistance = 2.0;
    controls.maxDistance = 8.6;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    const handleControlsStart = () => {
      cameraResetRef.current = false;
    };
    controls.addEventListener('start', handleControlsStart);

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Ignore non-fatal pre-compile errors
      }
    }

    // Active WebXR tracking refs
    let activeXrSession: XRSession | null = null;
    let xrHitTestSource: XRHitTestSource | null = null;
    let xrHitTestRequested = false;
    let xrEstimatedLight: XREstimatedLight | null = null;

    const cleanupXrRefs = () => {
      if (xrHitTestSource) {
        try {
          xrHitTestSource.cancel();
        } catch {
          // Ignore
        }
        xrHitTestSource = null;
      }
      if (xrEstimatedLight) {
        scene.remove(xrEstimatedLight);
        xrEstimatedLight = null;
        scene.environment = envTex;
      }
      xrHitTestRequested = false;
      xrReticle.group.visible = false;
      xrPlacedRef.current = false;
      setXrArPlaced(false);
      setXrSessionType('none');
      activeXrSession = null;
      stageGroup.position.set(0, 0, 0);
      stageGroup.scale.setScalar(1);
    };

    const renderSingleOrStereo = (w: number, h: number) => {
      if (renderer.xr.isPresenting) {
        renderer.render(scene, camera);
        return;
      }
      const activeMode = modeRef.current;
      if (activeMode === 'vr') {
        renderer.setScissorTest(true);
        const halfW = Math.floor(w / 2);
        const ipdMeters = vrIpdRef.current * 0.001;

        camera.getWorldDirection(_lookDir);
        _rightVec.crossVectors(_lookDir, camera.up).normalize();

        stereoLeftCam.fov = camera.fov;
        stereoLeftCam.aspect = halfW / h;
        stereoLeftCam.near = camera.near;
        stereoLeftCam.far = camera.far;
        stereoLeftCam.updateProjectionMatrix();
        _eyeOffset.copy(_rightVec).multiplyScalar(-ipdMeters * 0.5);
        stereoLeftCam.position.copy(camera.position).add(_eyeOffset);
        stereoLeftCam.lookAt(controls.target);

        renderer.setViewport(0, 0, halfW, h);
        renderer.setScissor(0, 0, halfW, h);
        renderer.render(scene, stereoLeftCam);

        stereoRightCam.fov = camera.fov;
        stereoRightCam.aspect = (w - halfW) / h;
        stereoRightCam.near = camera.near;
        stereoRightCam.far = camera.far;
        stereoRightCam.updateProjectionMatrix();
        _eyeOffset.copy(_rightVec).multiplyScalar(ipdMeters * 0.5);
        stereoRightCam.position.copy(camera.position).add(_eyeOffset);
        stereoRightCam.lookAt(controls.target);

        renderer.setViewport(halfW, 0, w - halfW, h);
        renderer.setScissor(halfW, 0, w - halfW, h);
        renderer.render(scene, stereoRightCam);

        renderer.setScissorTest(false);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.render(scene, camera);
      }
    };

    sceneControllerRef.current = {
      swap: (nextProduct: Product, nextFlavor: ProductFlavor) => {
        activeSwapToken += 1;
        realPhotoReady = false;
        stageGroup.remove(currentPhotoShowcase.root);
        currentPhotoShowcase.disposables.forEach((d) => d.dispose());
        if (currentRealAssets) {
          currentRealAssets.disposables.forEach((d) => d.dispose());
          currentRealAssets = null;
        }

        currentPhotoShowcase = buildRealPhotoShowcaseGroup(
          nextProduct,
          nextFlavor,
          isSoftwareGl,
          maxAniso,
        );
        currentPhotoShowcase.root.visible = false;
        stageGroup.add(currentPhotoShowcase.root);
        vrShowroom.updatePlaque(nextProduct, nextFlavor);
        loadAndApplyProductPhotos(nextProduct, nextFlavor, activeSwapToken);
        cameraResetRef.current = true;
      },
      setRuler: (visible: boolean) => {
        currentPhotoShowcase.setRulerVisible(visible);
      },
      exportUsdz: async () => {
        if (!currentRealAssets) return null;
        return generateUsdzBlobUrl(currentProductRef.current, currentRealAssets);
      },
      startWebXrAr: async () => {
        const navXr = (navigator as Navigator & { xr?: XrSystemCompat }).xr;
        if (!navXr?.requestSession) return;
        if (activeXrSession) {
          await activeXrSession.end().catch(() => {});
        }
        try {
          const domRoot = viewerRootRef.current;
          const sessionInit: Record<string, unknown> = {
            requiredFeatures: ['hit-test'],
            optionalFeatures: domRoot
              ? ['light-estimation', 'dom-overlay']
              : ['light-estimation'],
          };
          if (domRoot) {
            sessionInit.domOverlay = { root: domRoot };
          }
          let session: XRSession;
          try {
            session = await navXr.requestSession('immersive-ar', sessionInit);
          } catch {
            // Fallback without dom-overlay if unsupported
            session = await navXr.requestSession('immersive-ar', {
              requiredFeatures: ['hit-test'],
              optionalFeatures: ['light-estimation'],
            });
          }

          activeXrSession = session;
          xrPlacedRef.current = false;
          setXrArPlaced(false);
          setXrSessionType('ar');

          session.addEventListener('end', cleanupXrRefs);
          session.addEventListener('select', () => {
            if (xrReticle.group.visible && realPhotoReady) {
              const meterScale = currentPhotoShowcase.getRealMeterScale();
              stageGroup.position.copy(xrReticle.group.position);
              stageGroup.scale.setScalar(meterScale);
              xrPlacedRef.current = true;
              setXrArPlaced(true);
            }
          });

          if (!isSoftwareGl) {
            try {
              const estLight = new XREstimatedLight(renderer);
              estLight.addEventListener('estimationstart', () => {
                scene.add(estLight);
                if (estLight.environment) {
                  scene.environment = estLight.environment;
                }
              });
              estLight.addEventListener('estimationend', () => {
                scene.remove(estLight);
                scene.environment = envTex;
              });
              xrEstimatedLight = estLight;
            } catch {
              // Optional light estimation unavailable
            }
          }

          renderer.xr.setReferenceSpaceType('local');
          await renderer.xr.setSession(session);
        } catch {
          setSnapshotNotice('Thiết bị chưa cấp quyền hoặc không hỗ trợ WebXR AR');
          window.setTimeout(() => setSnapshotNotice(null), 2800);
        }
      },
      startWebXrVr: async () => {
        const navXr = (navigator as Navigator & { xr?: XrSystemCompat }).xr;
        if (!navXr?.requestSession) return;
        if (activeXrSession) {
          await activeXrSession.end().catch(() => {});
        }
        try {
          const session = await navXr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor'],
          });
          activeXrSession = session;
          setXrSessionType('vr');
          session.addEventListener('end', cleanupXrRefs);
          renderer.xr.setReferenceSpaceType('local');
          await renderer.xr.setSession(session);
          stageGroup.position.set(0, 0, -2.6);
          stageGroup.scale.setScalar(1);
        } catch {
          setSnapshotNotice('Không thể khởi động kính WebXR VR trên thiết bị này');
          window.setTimeout(() => setSnapshotNotice(null), 2800);
        }
      },
      endWebXr: async () => {
        if (activeXrSession) {
          await activeXrSession.end().catch(() => {});
        }
      },
      resetWebXrPlacement: () => {
        xrPlacedRef.current = false;
        setXrArPlaced(false);
      },
      capture: () => {
        try {
          const curW = container.clientWidth || width;
          const curH = container.clientHeight || height;
          renderSingleOrStereo(curW, curH);

          const activeMode = modeRef.current;
          const glCanvas = renderer.domElement;
          const slug = currentProductRef.current.slug || 'product';

          if (activeMode === 'ar' && videoRef.current && videoRef.current.readyState >= 2) {
            const video = videoRef.current;
            const outCanvas = document.createElement('canvas');
            outCanvas.width = glCanvas.width;
            outCanvas.height = glCanvas.height;
            const outCtx = outCanvas.getContext('2d');
            if (outCtx) {
              const vw = video.videoWidth || outCanvas.width;
              const vh = video.videoHeight || outCanvas.height;
              const scale = Math.max(outCanvas.width / vw, outCanvas.height / vh);
              const dw = vw * scale;
              const dh = vh * scale;
              outCtx.drawImage(
                video,
                (outCanvas.width - dw) / 2,
                (outCanvas.height - dh) / 2,
                dw,
                dh,
              );
              outCtx.drawImage(glCanvas, 0, 0);
              const link = document.createElement('a');
              link.download = `nhaisupplement-${slug}-ar.png`;
              link.href = outCanvas.toDataURL('image/png');
              link.click();
              return;
            }
          }

          const link = document.createElement('a');
          link.download = `nhaisupplement-${slug}-${activeMode}.png`;
          link.href = glCanvas.toDataURL('image/png');
          link.click();
        } catch {
          setSnapshotNotice('Không thể lưu ảnh trên trình duyệt này');
          window.setTimeout(() => setSnapshotNotice(null), 2400);
        }
      },
    };

    const clock = new THREE.Clock();
    let disposed = false;
    let softGlAccum = 0;

    activeSwapToken += 1;
    loadAndApplyProductPhotos(product, selectedFlavor, activeSwapToken);

    renderer.setAnimationLoop((_timestamp, xrFrame) => {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      if (isSoftwareGl && !renderer.xr.isPresenting) {
        softGlAccum += delta;
        if (softGlAccum < 0.075) return;
        softGlAccum = 0;
      }

      const activeMode = modeRef.current;
      const presentingType = xrSessionTypeRef.current;

      // WebXR Hit-Test Surface Tracking when inside immersive-ar
      if (xrFrame && presentingType === 'ar') {
        const session = renderer.xr.getSession();
        const refSpace = renderer.xr.getReferenceSpace();
        if (session && refSpace) {
          if (!xrHitTestRequested && session.requestHitTestSource) {
            xrHitTestRequested = true;
            session
              .requestReferenceSpace('viewer')
              .then((viewerSpace) =>
                session.requestHitTestSource!({ space: viewerSpace }),
              )
              .then((source) => {
                xrHitTestSource = source ?? null;
              })
              .catch(() => {});
          }

          if (xrHitTestSource && !xrPlacedRef.current) {
            const hitResults = xrFrame.getHitTestResults(xrHitTestSource);
            if (hitResults.length > 0) {
              const pose = hitResults[0].getPose(refSpace);
              if (pose) {
                _hitMatrix.fromArray(pose.transform.matrix);
                xrReticle.group.visible = true;
                xrReticle.group.position.setFromMatrixPosition(_hitMatrix);
              }
            } else {
              xrReticle.group.visible = false;
            }
          } else {
            xrReticle.group.visible = false;
          }
        }
      }

      if (presentingType === 'ar') {
        scene.background = null;
        scene.fog = null;
        renderer.setClearColor(0x000000, 0);
        arReticle.group.visible = false;
        vrShowroom.group.visible = false;
        currentPhotoShowcase.root.visible = realPhotoReady && xrPlacedRef.current;
      } else if (presentingType === 'vr' || activeMode === 'vr') {
        scene.background = vrBgColor;
        scene.fog = vrFog;
        renderer.setClearColor(0x070709, 1);
        arReticle.group.visible = false;
        vrShowroom.group.visible = true;
        currentPhotoShowcase.root.visible = realPhotoReady;
      } else {
        scene.background = null;
        scene.fog = null;
        renderer.setClearColor(0x000000, 0);
        arReticle.group.visible = realPhotoReady;
        vrShowroom.group.visible = false;
        currentPhotoShowcase.root.visible = realPhotoReady;
      }

      if (presentingType === 'none') {
        // OrbitControls enabled only when orbiting or in VR
        controls.enabled = activeMode === 'vr' || arInteractModeRef.current === 'orbit';

        const targetScale = activeMode === 'ar' ? arScaleRef.current : 1;
        const dampedScale = THREE.MathUtils.damp(stageGroup.scale.x, targetScale, 8, delta);
        stageGroup.scale.setScalar(dampedScale);

        if (activeMode === 'ar') {
          _arWorldOffset.set(arOffsetRef.current.x, 0, arOffsetRef.current.z);
        } else {
          _arWorldOffset.set(0, 0, 0);
        }
        stageGroup.position.x = THREE.MathUtils.damp(
          stageGroup.position.x,
          _arWorldOffset.x,
          8,
          delta,
        );
        stageGroup.position.z = THREE.MathUtils.damp(
          stageGroup.position.z,
          _arWorldOffset.z,
          8,
          delta,
        );
      }

      // Live lighting & tint adjustment
      const tint = arTintRef.current;
      const combinedBrightness =
        activeMode === 'ar' ? arBrightnessRef.current * tint.luma : arBrightnessRef.current;
      currentPhotoShowcase.setLightTint(combinedBrightness, tint.r, tint.g, tint.b);

      if (realPhotoReady) {
        if (renderer.xr.isPresenting) {
          renderer.xr.getCamera().getWorldPosition(_xrCamWorldPos);
        } else {
          _xrCamWorldPos.copy(camera.position);
        }
        const baseYaw = Math.atan2(
          _xrCamWorldPos.x - stageGroup.position.x,
          _xrCamWorldPos.z - stageGroup.position.z,
        );
        const flipAngle = showBackFactsRef.current ? Math.PI : 0;
        const swayAngle =
          autoRotateRef.current && !renderer.xr.isPresenting
            ? Math.sin(clock.elapsedTime * 1.15) * 0.36
            : 0;
        const targetYaw = baseYaw + flipAngle + swayAngle;
        let diff = targetYaw - currentPhotoShowcase.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        currentPhotoShowcase.root.rotation.y += diff * (1 - Math.exp(-12 * delta));

        const relAngle = currentPhotoShowcase.root.rotation.y - baseYaw;
        currentPhotoShowcase.setFacingBack(Math.cos(relAngle) < 0);
      }

      if (!renderer.xr.isPresenting) {
        if (cameraResetRef.current) {
          getViewerCameraVectors(
            currentProductRef.current.shape,
            compactRef.current,
            _camGoalPos,
            _camGoalTarget,
          );
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 7, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 7, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 7, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 7, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 7, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 7, delta);

          if (camera.position.distanceTo(_camGoalPos) < 0.02) {
            cameraResetRef.current = false;
          }
        }

        // Smooth gyroscope head-tracking (VR) or gentle horizon tilt parallax (AR)
        if (gyroDeltaRef.current) {
          if (activeMode === 'vr') {
            const radius = 4.15;
            const yaw = gyroDeltaRef.current.yaw;
            const pitch = THREE.MathUtils.clamp(0.3 + gyroDeltaRef.current.pitch * 0.65, 0.08, 1.25);
            camera.position.x = THREE.MathUtils.damp(
              camera.position.x,
              Math.sin(yaw) * Math.cos(pitch) * radius,
              8,
              delta,
            );
            camera.position.y = THREE.MathUtils.damp(
              camera.position.y,
              Math.sin(pitch) * radius + 0.55,
              8,
              delta,
            );
            camera.position.z = THREE.MathUtils.damp(
              camera.position.z,
              Math.cos(yaw) * Math.cos(pitch) * radius,
              8,
              delta,
            );
          } else if (activeMode === 'ar') {
            const targetX = THREE.MathUtils.clamp(-gyroDeltaRef.current.yaw * 1.15, -1.6, 1.6);
            const targetY = THREE.MathUtils.clamp(
              1.38 + gyroDeltaRef.current.pitch * 0.85,
              0.75,
              2.35,
            );
            camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 7, delta);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 7, delta);
          }
        }

        controls.autoRotate =
          autoRotateRef.current && !isSoftwareGl && !cameraResetRef.current;
        controls.autoRotateSpeed = 1.25;
        controls.update();
      }

      const curW = container.clientWidth || width;
      const curH = container.clientHeight || height;
      try {
        renderSingleOrStereo(curW, curH);
      } catch {
        setWebglError(true);
      }
    });

    const handleResize = () => {
      if (!container || disposed || renderer.xr.isPresenting) return;
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
      renderer.setAnimationLoop(null);
      if (activeXrSession) {
        activeXrSession.end().catch(() => {});
      }
      sceneControllerRef.current = null;
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      envTex.dispose();
      currentPhotoShowcase.disposables.forEach((d) => d.dispose());
      if (currentRealAssets) {
        currentRealAssets.disposables.forEach((d) => d.dispose());
      }
      arReticle.disposables.forEach((d) => d.dispose());
      xrReticle.disposables.forEach((d) => d.dispose());
      vrShowroom.disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [webglRetryNonce]);

  const hasMountedSwapRef = useRef(false);
  useEffect(() => {
    if (!hasMountedSwapRef.current) {
      hasMountedSwapRef.current = true;
      return;
    }
    sceneControllerRef.current?.swap(product, selectedFlavor);
  }, [product, selectedFlavor]);

  const handleCapture = () => {
    sceneControllerRef.current?.capture();
    setSnapshotNotice('Đã lưu ảnh chụp');
    window.setTimeout(() => setSnapshotNotice(null), 2200);
  };

  const handleOpenIosQuickLook = async () => {
    if (usdzUrl) {
      quickLookLinkRef.current?.click();
      return;
    }
    setUsdzGenerating(true);
    try {
      const nextUrl = await sceneControllerRef.current?.exportUsdz();
      if (nextUrl) {
        setUsdzUrl(nextUrl);
        window.setTimeout(() => {
          quickLookLinkRef.current?.click();
        }, 60);
      } else {
        setSnapshotNotice('Ảnh sản phẩm đang tải, thử lại sau 1 giây');
        window.setTimeout(() => setSnapshotNotice(null), 2400);
      }
    } catch {
      setSnapshotNotice('Không thể mở AR Quick Look trên trình duyệt này');
      window.setTimeout(() => setSnapshotNotice(null), 2400);
    } finally {
      setUsdzGenerating(false);
    }
  };

  const handleResetView = () => {
    setArScale(1);
    setArBrightness(1.02);
    setArOffset({ x: 0, z: 0 });
    setShowBackFacts(false);
    cameraResetRef.current = true;
  };

  const cycleFlavor = useCallback(
    (dir: 1 | -1) => {
      if (!onSelectFlavor || product.flavors.length <= 1) return;
      const idx = product.flavors.findIndex((f) => f.id === selectedFlavor.id);
      const nextIdx = (idx + dir + product.flavors.length) % product.flavors.length;
      onSelectFlavor(product.flavors[nextIdx]);
    },
    [onSelectFlavor, product.flavors, selectedFlavor.id],
  );

  const cycleProduct = useCallback(
    (dir: 1 | -1) => {
      if (!onSelectProduct || !productsList || productsList.length <= 1) return;
      const idx = productsList.findIndex((p) => p.id === product.id);
      const nextIdx = (idx + dir + productsList.length) % productsList.length;
      onSelectProduct(productsList[nextIdx]);
    },
    [onSelectProduct, product.id, productsList],
  );

  const dims = getRealPhysicalDimensions(product);

  return (
    <div
      ref={viewerRootRef}
      className={`relative w-full overflow-hidden border border-neutral-200 bg-neutral-900 ${
        isFullscreen
          ? 'h-screen w-screen border-0'
          : compact
            ? 'h-[410px] sm:h-[470px]'
            : 'h-[520px] sm:h-[600px]'
      }`}
    >
      {/* Hidden Apple AR Quick Look launcher (<a rel="ar"> with inner img per Apple spec) */}
      <a
        ref={quickLookLinkRef}
        rel="ar"
        href={usdzUrl ?? '#'}
        className="hidden"
        aria-hidden="true"
      >
        <img alt="" src={selectedFlavor.image} />
      </a>

      {/* Live Camera Feed Layer + Tabletop Studio Fallback in AR Mode */}
      {mode === 'ar' && xrSessionType === 'none' && (
        <div className="absolute inset-0 z-0 bg-neutral-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${
              arCameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {arCameraStatus !== 'active' && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-40 text-center"
              style={{
                background:
                  'linear-gradient(180deg, #eceae6 0%, #dcd8d1 56%, #c2bab0 56.4%, #9c9286 100%)',
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%]"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.28) 0%, rgba(0,0,0,0.18) 100%)',
                }}
              />
              {arCameraStatus === 'fallback' && (
                <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 border border-neutral-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm">
                  <span>Đặt trên mặt bàn · Kích thước thật {dims.label}</span>
                  <button
                    type="button"
                    onClick={() => setArRetryNonce((n) => n + 1)}
                    className="inline-flex items-center gap-1 bg-neutral-950 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#FF5A00]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Bật Camera</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stereoscopic VR Optical Binocular Mask & Lens Divider (Mobile Phones Only) */}
      {mode === 'vr' && isMobilePhone && xrSessionType === 'none' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex">
          <div
            className="relative flex-1 border-r-2 border-black"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.88) 78%)',
            }}
          >
            <div className="absolute left-3 top-[74px] bg-black/75 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
              MẮT TRÁI · IPD {vrIpdMm}mm
            </div>
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          </div>
          <div
            className="relative flex-1"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.88) 78%)',
            }}
          >
            <div className="absolute right-3 top-[74px] bg-black/75 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
              MẮT PHẢI · VR 360°
            </div>
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          </div>
        </div>
      )}

      {/* Isolated WebGL Canvas Container */}
      <div
        ref={mountRef}
        className={`relative z-[5] h-full w-full ${
          mode === 'ar' && arInteractMode === 'move'
            ? 'cursor-move'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Active WebXR Session HUD (AR Hit-Test or VR) */}
      {xrSessionType !== 'none' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4 text-center">
          <div className="pointer-events-auto border border-[#FF5A00] bg-neutral-950/95 px-4 py-2 text-xs font-semibold text-white">
            {xrSessionType === 'ar'
              ? xrArPlaced
                ? `Đã khóa vị trí thật (${dims.label}) · Đi quanh để quan sát sản phẩm`
                : 'Hướng camera xuống mặt bàn rồi chạm màn hình để đặt sản phẩm đúng tỉ lệ thật'
              : 'Đang ở chế độ WebXR VR · Xoay đầu để quan sát showroom'}
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {xrSessionType === 'ar' && xrArPlaced && (
              <button
                type="button"
                onClick={() => sceneControllerRef.current?.resetWebXrPlacement()}
                className="bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-950"
              >
                Đặt lại vị trí
              </button>
            )}
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.endWebXr()}
              className="bg-[#FF5A00] px-4 py-1.5 text-xs font-bold text-white"
            >
              Thoát WebXR
            </button>
          </div>
        </div>
      )}

      {/* Loading Pill while decoding real photo cutout */}
      {photoStatus === 'loading' && !contextLost && !webglError && (
        <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center">
          <span className="border border-neutral-800 bg-neutral-950/90 px-3.5 py-1.5 text-xs font-semibold text-white">
            Đang nạp ảnh thật sản phẩm...
          </span>
        </div>
      )}

      {/* Pure Real-Photo Fallback if WebGL unavailable or texture failed */}
      {(contextLost || webglError || photoStatus === 'error') && (
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center ${
            mode === 'ar' && arCameraStatus === 'active'
              ? 'bg-transparent'
              : mode === 'vr'
                ? 'bg-neutral-950 text-white'
                : 'bg-neutral-100/85'
          }`}
        >
          <img
            src={selectedFlavor.image}
            alt={`${product.name} - ${selectedFlavor.name}`}
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.src !== selectedFlavor.fallbackImage) {
                e.currentTarget.src = selectedFlavor.fallbackImage;
              }
            }}
            style={{
              transform: `translate(${arOffset.x * 48}px, ${arOffset.z * 28}px) scale(${arScale})`,
              filter: `brightness(${arBrightness}) drop-shadow(0 18px 20px rgba(0,0,0,0.35))`,
            }}
            className="mb-3 max-h-56 w-auto object-contain transition-transform duration-150"
          />
          {(contextLost || webglError) && (
            <button
              type="button"
              onClick={() => {
                setContextLost(false);
                setWebglError(false);
                setWebglRetryNonce((n) => n + 1);
              }}
              className="mt-2 bg-neutral-950 px-3.5 py-1.5 text-xs font-bold uppercase text-white transition-colors hover:bg-[#FF5A00]"
            >
              Khởi động lại AR/VR
            </button>
          )}
        </div>
      )}

      {/* Top Minimal Spec Header + Hardware AR / VR Launchers */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto bg-neutral-950/95 px-3 py-2 text-white">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-300">
            <span className="font-mono font-bold text-[#FF5A00]">
              {mode === 'ar'
                ? arCameraStatus === 'active'
                  ? 'AR CAMERA LIVE'
                  : 'AR ĐẶT BÀN'
                : 'VR SHOWROOM 360°'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[130px] truncate sm:max-w-[220px]">{selectedFlavor.name}</span>
            <span className="hidden font-mono text-neutral-400 sm:inline">
              · {dims.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-white">
            {mode === 'ar'
              ? arInteractMode === 'move'
                ? 'Kéo trên màn hình để đặt vị trí · Chụm 2 ngón phóng/thu tỉ lệ'
                : 'Kéo xoay góc nhìn · Lật xem mặt sau dinh dưỡng'
              : vrGyroHint ?? 'Lắp kính VR vào điện thoại · Đổi vị & sản phẩm ngay bên dưới'}
          </p>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          {vrMobileNotice && (
            <span className="bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-[#FF5A00]">
              VR Stereo chỉ xem trên điện thoại
            </span>
          )}
          {snapshotNotice && (
            <span className="bg-[#FF5A00] px-2.5 py-1.5 text-xs font-bold text-white">
              {snapshotNotice}
            </span>
          )}

          {/* Tier 1 Hardware AR: WebXR Hit-Test (Android Chrome) */}
          {mode === 'ar' && xrArSupported && xrSessionType === 'none' && (
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.startWebXrAr()}
              className="flex h-9 items-center gap-1.5 bg-[#FF5A00] px-2.5 text-xs font-bold text-white transition-colors hover:bg-white hover:text-neutral-950"
              title="Quét mặt bàn thật bằng WebXR ARCore"
            >
              <Scan className="h-3.5 w-3.5" />
              <span>Bám bàn WebXR</span>
            </button>
          )}

          {/* Tier 1 Hardware AR: Apple iOS AR Quick Look (.usdz) */}
          {mode === 'ar' && isAppleMobile && !xrArSupported && (
            <button
              type="button"
              onClick={handleOpenIosQuickLook}
              disabled={usdzGenerating}
              className="flex h-9 items-center gap-1.5 bg-[#FF5A00] px-2.5 text-xs font-bold text-white transition-colors hover:bg-white hover:text-neutral-950 disabled:opacity-60"
              title="Đặt trực tiếp lên bàn thật qua Apple ARKit"
            >
              <Scan className="h-3.5 w-3.5" />
              <span>{usdzGenerating ? 'Đang tạo AR...' : 'AR iPhone thật'}</span>
            </button>
          )}

          {/* Tier 1 Hardware VR: WebXR immersive-vr */}
          {mode === 'vr' && isMobilePhone && xrVrSupported && xrSessionType === 'none' && (
            <button
              type="button"
              onClick={() => sceneControllerRef.current?.startWebXrVr()}
              className="flex h-9 items-center gap-1.5 bg-[#FF5A00] px-2.5 text-xs font-bold text-white transition-colors hover:bg-white hover:text-neutral-950"
            >
              <Glasses className="h-3.5 w-3.5" />
              <span>WebXR VR</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCapture}
            title="Chụp ảnh AR / VR"
            className="flex h-9 items-center gap-1.5 bg-neutral-950/95 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#FF5A00]"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {mode === 'ar' ? 'Chụp AR' : 'Chụp ảnh'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="flex h-9 w-9 items-center justify-center bg-neutral-950/95 text-white transition-colors hover:bg-[#FF5A00]"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình xem AR / VR"
              className="flex h-9 w-9 items-center justify-center bg-neutral-950/95 text-white transition-colors hover:bg-[#FF5A00]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Control Dock */}
      {xrSessionType === 'none' && (
        <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-2 sm:px-3">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="mb-1.5 flex items-center gap-1.5 bg-neutral-950 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#FF5A00]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {dockCollapsed ? 'Mở thanh điều khiển AR/VR' : 'Thu gọn điều khiển'}
          </button>

          {!dockCollapsed && (
            <div className="flex w-full max-w-[820px] flex-col gap-2 border border-neutral-800 bg-neutral-950/95 p-2 text-white">
              {/* Row 1: Mode Switcher + AR Placement / VR Stereo Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-neutral-900 p-1">
                  <button
                    type="button"
                    onClick={() => handleSetMode('ar')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      mode === 'ar'
                        ? 'bg-[#FF5A00] text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>AR Camera</span>
                  </button>
                  {isMobilePhone ? (
                    <button
                      type="button"
                      onClick={() => handleSetMode('vr')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        mode === 'vr'
                          ? 'bg-[#FF5A00] text-white'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>VR Stereo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetMode('vr')}
                      title="Chế độ VR Stereo chỉ mở trên điện thoại"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-500 whitespace-nowrap transition-colors hover:text-neutral-300"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>VR (Điện thoại)</span>
                    </button>
                  )}
                </div>

                {/* AR Controls */}
                {mode === 'ar' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setArInteractMode((m) => (m === 'move' ? 'orbit' : 'move'))
                      }
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        arInteractMode === 'move'
                          ? 'bg-white text-neutral-950'
                          : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      }`}
                      title="Chuyển giữa Kéo đặt vị trí và Xoay góc nhìn"
                    >
                      {arInteractMode === 'move' ? (
                        <>
                          <Hand className="h-3 w-3 text-[#FF5A00]" />
                          <span>Đang kéo đặt bàn</span>
                        </>
                      ) : (
                        <>
                          <Move className="h-3 w-3 text-[#FF5A00]" />
                          <span>Đang xoay góc</span>
                        </>
                      )}
                    </button>

                    <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                      <span className="whitespace-nowrap">Tỉ lệ {Math.round(arScale * 100)}%</span>
                      <input
                        type="range"
                        min={0.45}
                        max={1.8}
                        step={0.05}
                        value={arScale}
                        onChange={(e) => setArScale(Number(e.target.value))}
                        className="w-20 accent-[#FF5A00]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setArFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))
                      }
                      className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-[11px] font-semibold text-neutral-200 hover:bg-neutral-700"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>{arFacing === 'environment' ? 'Cam sau' : 'Cam trước'}</span>
                    </button>

                    {isMobilePhone && (
                      <button
                        type="button"
                        onClick={toggleArParallax}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-colors ${
                          arParallaxActive
                            ? 'bg-[#FF5A00] text-white'
                            : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                        }`}
                        title="Nghiêng điện thoại để nhìn góc sản phẩm"
                      >
                        <Compass className="h-3 w-3" />
                        <span>Nghiêng AR</span>
                      </button>
                    )}
                  </div>
                )}

                {/* VR IPD + Gyroscope Controls in VR mode */}
                {mode === 'vr' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                      <span className="whitespace-nowrap">IPD {vrIpdMm}mm</span>
                      <input
                        type="range"
                        min={58}
                        max={72}
                        step={1}
                        value={vrIpdMm}
                        onChange={(e) => setVrIpdMm(Number(e.target.value))}
                        className="w-20 accent-[#FF5A00]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={toggleVrGyro}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        vrGyroActive
                          ? 'bg-[#FF5A00] text-white'
                          : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      }`}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>{vrGyroActive ? 'Tắt cảm biến' : 'Xoay theo đầu'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Row 2: Nutrition Flip, CM Ruler, Auto Light Match, In-Viewer Flavor/Product Switcher, Rotate & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowBackFacts((v) => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                      showBackFacts
                        ? 'bg-[#FF5A00] text-white'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    }`}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" />
                    <span>{showBackFacts ? 'Ảnh mặt trước' : 'Mặt sau dinh dưỡng'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRuler((v) => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                      showRuler
                        ? 'bg-white text-neutral-950'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    }`}
                    title={`Hiển thị thước đo ${dims.heightCm} cm thực tế`}
                  >
                    <Ruler className="h-3.5 w-3.5 text-[#FF5A00]" />
                    <span>Thước {dims.heightCm}cm</span>
                  </button>

                  {mode === 'ar' && arCameraStatus === 'active' && (
                    <button
                      type="button"
                      onClick={() => setAutoLightMatch((v) => !v)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                        autoLightMatch
                          ? 'bg-neutral-800 text-[#FF5A00]'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                      title="Tự động cân ánh sáng & tông màu theo camera phòng"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{autoLightMatch ? 'Khớp sáng phòng' : 'Sáng thủ công'}</span>
                    </button>
                  )}

                  <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                    <Sun className="h-3.5 w-3.5 text-[#FF5A00]" />
                    <input
                      type="range"
                      min={0.75}
                      max={1.35}
                      step={0.03}
                      value={arBrightness}
                      onChange={(e) => setArBrightness(Number(e.target.value))}
                      aria-label="Độ sáng sản phẩm"
                      className="w-16 accent-[#FF5A00]"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {onSelectFlavor && product.flavors.length > 1 && (
                    <div className="flex items-center bg-neutral-900 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => cycleFlavor(-1)}
                        className="px-1.5 py-1 hover:text-[#FF5A00]"
                        title="Vị trước"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="max-w-[80px] truncate px-1">Vị</span>
                      <button
                        type="button"
                        onClick={() => cycleFlavor(1)}
                        className="px-1.5 py-1 hover:text-[#FF5A00]"
                        title="Đổi vị khác"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {onSelectProduct && productsList && productsList.length > 1 && (
                    <div className="flex items-center bg-neutral-900 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => cycleProduct(-1)}
                        className="px-1.5 py-1 hover:text-[#FF5A00]"
                        title="Sản phẩm trước"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-1">Đổi SP</span>
                      <button
                        type="button"
                        onClick={() => cycleProduct(1)}
                        className="px-1.5 py-1 hover:text-[#FF5A00]"
                        title="Sản phẩm tiếp theo"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setAutoRotate((v) => !v)}
                    className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                    title={autoRotate ? 'Tạm dừng xoay' : 'Tự xoay góc nhìn'}
                  >
                    {autoRotate ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{autoRotate ? 'Dừng' : 'Xoay'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetView}
                    className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                    title="Đặt lại vị trí & góc nhìn"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
