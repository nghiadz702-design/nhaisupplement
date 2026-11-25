import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  Camera,
  Compass,
  Download,
  Eye,
  Gift,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import type { Product, ProductFlavor } from '../types/product';
import { checkIsMobilePhone, useIsMobilePhone } from '../utils/deviceDetection';
import {
  buildArReticleGroup,
  buildCompositeProductGroup,
  buildRealPhotoShowcaseGroup,
  buildShakerBonusGroup,
  buildVrShowroomGroup,
  createProceduralLabelTexture,
  getRealSizeLabel,
  loadRealProductVisuals,
  type BuiltPhotoShowcase,
  type BuiltProductModel,
  type RealProductVisualAssets,
} from '../utils/product3DBuilder';

export type ViewerMode = '3d' | 'ar' | 'vr';
type CameraPreset = 'hero' | 'front' | 'nutrition' | 'top';
type StudioTheme = 'light' | 'dark';

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

// Pre-allocated math helpers outside render loop (zero GC)
const _eyeOffset = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _arWorldOffset = new THREE.Vector3();

function getPresetCameraVectors(
  preset: CameraPreset,
  shape: Product['shape'],
  compact: boolean,
  isPhotoMode: boolean,
  posOut: THREE.Vector3,
  targetOut: THREE.Vector3,
) {
  const scaleDist = compact ? 1.18 : 1.04;
  const targetY =
    shape === 'bar'
      ? isPhotoMode
        ? 0.56
        : 0.28
      : 0.82;
  targetOut.set(0, targetY, 0);

  if (preset === 'front') {
    posOut.set(0, targetY + 0.16, 4.95 * scaleDist);
  } else if (preset === 'nutrition') {
    posOut.set(-2.35 * scaleDist, targetY + 0.24, -4.25 * scaleDist);
  } else if (preset === 'top') {
    posOut.set(0.01, (shape === 'bar' && !isPhotoMode ? 3.4 : 4.75) * scaleDist, 1.85 * scaleDist);
  } else {
    posOut.set(
      (isPhotoMode ? 1.45 : 2.35) * scaleDist,
      targetY + 0.88 * scaleDist,
      (isPhotoMode ? 5.05 : 4.65) * scaleDist,
    );
  }
}

export default function Product3DViewer({
  product,
  selectedFlavor,
  initialMode = '3d',
  compact = false,
  onModeChange,
  onClose,
}: Product3DViewerProps) {
  const viewerRootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isMobilePhone = useIsMobilePhone();
  const safeInitialMode: ViewerMode =
    initialMode === 'vr' && !checkIsMobilePhone() ? '3d' : initialMode;

  const [mode, setMode] = useState<ViewerMode>(safeInitialMode);
  const [usePhotoShowcase, setUsePhotoShowcase] = useState(safeInitialMode !== '3d');
  const [vrMobileNotice, setVrMobileNotice] = useState(false);
  const [studioTheme, setStudioTheme] = useState<StudioTheme>('light');
  const [autoRotate, setAutoRotate] = useState(!isSoftwareGl);
  const [exploded, setExploded] = useState(false);
  const [showShaker, setShowShaker] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('hero');
  const [arScale, setArScale] = useState(1);
  const [arFacing, setArFacing] = useState<'environment' | 'user'>('environment');
  const [arOffset, setArOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [arRetryNonce, setArRetryNonce] = useState(0);
  const [vrIpdMm, setVrIpdMm] = useState(64);
  const [vrGyroActive, setVrGyroActive] = useState(false);
  const [vrGyroHint, setVrGyroHint] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [arCameraStatus, setArCameraStatus] = useState<'idle' | 'active' | 'fallback'>('idle');
  const [contextLost, setContextLost] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  const modeRef = useRef<ViewerMode>(mode);
  const usePhotoShowcaseRef = useRef<boolean>(usePhotoShowcase);
  const studioThemeRef = useRef<StudioTheme>(studioTheme);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const explodedRef = useRef<boolean>(exploded);
  const showShakerRef = useRef<boolean>(showShaker);
  const arScaleRef = useRef<number>(arScale);
  const arOffsetRef = useRef<{ x: number; z: number }>(arOffset);
  const vrIpdRef = useRef<number>(vrIpdMm);
  const compactRef = useRef<boolean>(compact);
  const currentProductRef = useRef<Product>(product);
  const gyroDeltaRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const presetTransitionRef = useRef<{ active: boolean; preset: CameraPreset }>({
    active: false,
    preset: 'hero',
  });
  const sceneSwapRef = useRef<{
    swap: (nextProduct: Product, nextFlavor: ProductFlavor) => void;
    capture: () => void;
  } | null>(null);

  useEffect(() => {
    const resolvedMode: ViewerMode =
      initialMode === 'vr' && !isMobilePhone ? '3d' : initialMode;
    setMode(resolvedMode);
    setUsePhotoShowcase(resolvedMode !== '3d');
    if (resolvedMode !== '3d') {
      setExploded(false);
    }
    presetTransitionRef.current = { active: true, preset: 'hero' };
  }, [initialMode, isMobilePhone]);

  useEffect(() => {
    if (!isMobilePhone && mode === 'vr') {
      setMode('3d');
      setUsePhotoShowcase(false);
      setVrGyroActive(false);
      onModeChange?.('3d');
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
    if (nextMode === 'ar' || nextMode === 'vr') {
      setUsePhotoShowcase(true);
      setExploded(false);
    } else {
      setUsePhotoShowcase(false);
    }
    if (nextMode !== 'vr' && vrGyroActive) {
      setVrGyroActive(false);
    }
    presetTransitionRef.current = { active: true, preset: 'hero' };
    onModeChange?.(nextMode);
  };

  modeRef.current = mode;
  usePhotoShowcaseRef.current = usePhotoShowcase;
  studioThemeRef.current = studioTheme;
  autoRotateRef.current = autoRotate;
  explodedRef.current = exploded;
  showShakerRef.current = showShaker;
  arScaleRef.current = arScale;
  arOffsetRef.current = arOffset;
  vrIpdRef.current = vrIpdMm;
  compactRef.current = compact;
  currentProductRef.current = product;

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

  // Gyroscope Head-Tracking in VR Mode
  useEffect(() => {
    if (mode !== 'vr' || !vrGyroActive) {
      gyroDeltaRef.current = null;
      return;
    }

    let baseAlpha: number | null = null;
    let baseBeta: number | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null) return;
      if (baseAlpha === null || baseBeta === null) {
        baseAlpha = event.alpha;
        baseBeta = event.beta;
        return;
      }
      let dAlpha = event.alpha - baseAlpha;
      if (dAlpha > 180) dAlpha -= 360;
      if (dAlpha < -180) dAlpha += 360;
      const dBeta = THREE.MathUtils.clamp(event.beta - baseBeta, -45, 45);
      gyroDeltaRef.current = {
        yaw: THREE.MathUtils.degToRad(dAlpha),
        pitch: THREE.MathUtils.degToRad(dBeta),
      };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      gyroDeltaRef.current = null;
    };
  }, [mode, vrGyroActive]);

  const toggleVrGyro = async () => {
    if (vrGyroActive) {
      setVrGyroActive(false);
      setVrGyroHint(null);
      return;
    }
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setVrGyroHint('Thiết bị không có cảm biến xoay (hãy kéo chuột/ngón tay để nhìn 360°)');
      return;
    }
    const devOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof devOrient.requestPermission === 'function') {
      try {
        const perm = await devOrient.requestPermission();
        if (perm !== 'granted') {
          setVrGyroHint('Chưa được cấp quyền cảm biến chuyển động');
          return;
        }
      } catch {
        setVrGyroHint('Không thể bật cảm biến trên trình duyệt này');
        return;
      }
    }
    setVrGyroHint(null);
    setAutoRotate(false);
    setVrGyroActive(true);
  };

  // Manage live AR camera stream when entering/leaving AR mode or switching camera
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
          video: { facingMode: arFacing },
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
  }, [mode, arFacing, arRetryNonce]);

  const triggerPreset = useCallback((preset: CameraPreset) => {
    setActivePreset(preset);
    if (preset === 'nutrition') {
      setUsePhotoShowcase(false);
    }
    if (preset === 'top') {
      setUsePhotoShowcase(false);
      setExploded(true);
    }
    presetTransitionRef.current = { active: true, preset };
  }, []);

  // Core Three.js scene lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const scene = new THREE.Scene();
    const lightBgColor = new THREE.Color(0xf4f4f5);
    const darkBgColor = new THREE.Color(0x0d0d10);
    const vrBgColor = new THREE.Color(0x070709);
    const vrFog = new THREE.Fog(0x070709, 7.5, 19);
    scene.background = lightBgColor;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    getPresetCameraVectors(
      'hero',
      currentProductRef.current.shape,
      compactRef.current,
      usePhotoShowcaseRef.current,
      camera.position,
      _camGoalTarget,
    );

    const stereoLeftCam = new THREE.PerspectiveCamera(44, (width * 0.5) / height, 0.1, 100);
    const stereoRightCam = new THREE.PerspectiveCamera(44, (width * 0.5) / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
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

    // Studio Environment Map (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // 3-Point Lighting Rig + Studio Softbox on GPU
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.05);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.8;
    keyLight.shadow.camera.right = 2.8;
    keyLight.shadow.camera.top = 2.8;
    keyLight.shadow.camera.bottom = -2.8;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff5a00, 1.15);
    rimLight.position.set(-4, 3.2, -3.5);
    scene.add(rimLight);

    let softboxLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      softboxLight = new THREE.RectAreaLight(0xffffff, 2.4, 3.5, 2.2);
      softboxLight.position.set(-3.2, 3.4, 3.2);
      softboxLight.lookAt(0, 1, 0);
      scene.add(softboxLight);
    }

    // Contact shadow grounding plane for 3D mode
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0,0,0,0.44)');
    grad.addColorStop(0.58, 'rgba(0,0,0,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlaneGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    scene.add(shadowPlane);

    // Stage Group (moves with AR offset & scale)
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // Product Composite 3D Model + Real Product Cutout Showcase (AR/VR)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let currentLabelTex = createProceduralLabelTexture(product, selectedFlavor, maxAniso);
    let currentBuilt: BuiltProductModel = buildCompositeProductGroup(
      product,
      selectedFlavor,
      currentLabelTex,
      isSoftwareGl,
    );
    let currentPhotoShowcase: BuiltPhotoShowcase = buildRealPhotoShowcaseGroup(
      product,
      currentLabelTex,
      isSoftwareGl,
    );
    let currentRealAssets: RealProductVisualAssets | null = null;
    let realPhotoReady = false;
    let activeSwapToken = 0;

    stageGroup.add(currentBuilt.root);
    stageGroup.add(currentPhotoShowcase.root);

    const loadAndApplyProductPhotos = (
      targetProduct: Product,
      targetFlavor: ProductFlavor,
      token: number,
    ) => {
      loadRealProductVisuals(targetProduct, targetFlavor, maxAniso)
        .then((assets) => {
          if (!assets) return;
          if (disposed || token !== activeSwapToken) {
            assets.disposables.forEach((d) => d.dispose());
            return;
          }
          if (currentRealAssets) {
            currentRealAssets.disposables.forEach((d) => d.dispose());
          }
          currentRealAssets = assets;
          currentBuilt.applyRealAssets(assets);
          currentPhotoShowcase.applyRealAssets(assets);
          realPhotoReady = true;
        })
        .catch(() => {
          // Keep procedural fallback if image decoding fails
        });
    };

    // Bonus Shaker Companion Model
    const shakerBuilt = buildShakerBonusGroup(isSoftwareGl);
    shakerBuilt.group.position.set(1.52, 0, 0.22);
    shakerBuilt.group.scale.setScalar(0.001);
    shakerBuilt.group.visible = false;
    stageGroup.add(shakerBuilt.group);

    // AR Reticle + Shadow Catcher
    const arReticle = buildArReticleGroup();
    arReticle.group.visible = false;
    stageGroup.add(arReticle.group);

    // VR 360 Showroom Environment
    const vrShowroom = buildVrShowroomGroup();
    vrShowroom.group.visible = false;
    scene.add(vrShowroom.group);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.copy(_camGoalTarget);
    controls.minDistance = 2.2;
    controls.maxDistance = 9.0;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.update();

    // Immediately cancel preset camera transition when user interacts manually
    const handleControlsStart = () => {
      presetTransitionRef.current.active = false;
    };
    controls.addEventListener('start', handleControlsStart);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const renderSingleOrStereo = (w: number, h: number) => {
      const activeMode = modeRef.current;
      if (activeMode === 'vr') {
        renderer.setScissorTest(true);
        const halfW = Math.floor(w / 2);
        const ipdMeters = vrIpdRef.current * 0.001;

        camera.getWorldDirection(_lookDir);
        _rightVec.crossVectors(_lookDir, camera.up).normalize();

        // Left eye
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

        // Right eye
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

    sceneSwapRef.current = {
      swap: (nextProduct: Product, nextFlavor: ProductFlavor) => {
        activeSwapToken += 1;
        realPhotoReady = false;
        stageGroup.remove(currentBuilt.root);
        stageGroup.remove(currentPhotoShowcase.root);
        currentLabelTex.dispose();
        currentBuilt.disposables.forEach((d) => d.dispose());
        currentPhotoShowcase.disposables.forEach((d) => d.dispose());
        if (currentRealAssets) {
          currentRealAssets.disposables.forEach((d) => d.dispose());
          currentRealAssets = null;
        }

        currentLabelTex = createProceduralLabelTexture(nextProduct, nextFlavor, maxAniso);
        currentBuilt = buildCompositeProductGroup(
          nextProduct,
          nextFlavor,
          currentLabelTex,
          isSoftwareGl,
        );
        currentPhotoShowcase = buildRealPhotoShowcaseGroup(
          nextProduct,
          currentLabelTex,
          isSoftwareGl,
        );
        stageGroup.add(currentBuilt.root);
        stageGroup.add(currentPhotoShowcase.root);
        loadAndApplyProductPhotos(nextProduct, nextFlavor, activeSwapToken);
        presetTransitionRef.current = { active: true, preset: 'hero' };
      },
      capture: () => {
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
            // Draw cover-fitted camera feed underneath
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
      },
    };

    const clock = new THREE.Clock();
    let animFrameId = 0;
    let disposed = false;

    // Kick off real photo cutout & label texture extraction on initial mount
    activeSwapToken += 1;
    loadAndApplyProductPhotos(product, selectedFlavor, activeSwapToken);

    const renderFrame = () => {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const activeMode = modeRef.current;

      // Mode environment switching
      if (activeMode === 'ar') {
        scene.background = null;
        scene.fog = null;
        renderer.setClearColor(0x000000, 0);
        shadowPlane.visible = false;
        arReticle.group.visible = true;
        vrShowroom.group.visible = false;
      } else if (activeMode === 'vr') {
        scene.background = vrBgColor;
        scene.fog = vrFog;
        renderer.setClearColor(0x070709, 1);
        shadowPlane.visible = false;
        arReticle.group.visible = false;
        vrShowroom.group.visible = true;
      } else {
        const isDark = studioThemeRef.current === 'dark';
        scene.background = isDark ? darkBgColor : lightBgColor;
        scene.fog = null;
        renderer.setClearColor(isDark ? 0x0d0d10 : 0xf4f4f5, 1);
        shadowPlane.visible = true;
        arReticle.group.visible = false;
        vrShowroom.group.visible = false;
      }

      // Smoothly damp stage scale & AR position offset
      const targetScale = activeMode === 'ar' ? arScaleRef.current : 1;
      const dampedScale = THREE.MathUtils.damp(stageGroup.scale.x, targetScale, 8, delta);
      stageGroup.scale.setScalar(dampedScale);

      if (activeMode === 'ar') {
        _arWorldOffset.set(arOffsetRef.current.x, 0, arOffsetRef.current.z);
      } else {
        _arWorldOffset.set(0, 0, 0);
      }
      stageGroup.position.x = THREE.MathUtils.damp(stageGroup.position.x, _arWorldOffset.x, 8, delta);
      stageGroup.position.z = THREE.MathUtils.damp(stageGroup.position.z, _arWorldOffset.z, 8, delta);

      // Smoothly damp companion Shaker gift visibility & scale
      const shakerTargetScale = showShakerRef.current ? 1 : 0.001;
      const nextShakerScale = THREE.MathUtils.damp(
        shakerBuilt.group.scale.x,
        shakerTargetScale,
        9,
        delta,
      );
      shakerBuilt.group.scale.setScalar(nextShakerScale);
      shakerBuilt.group.visible = nextShakerScale > 0.02;

      // Toggle between real photo cutout showcase (default in AR & VR) and 3D model
      const showPhotoNow = usePhotoShowcaseRef.current && !explodedRef.current && realPhotoReady;
      currentPhotoShowcase.root.visible = showPhotoNow;
      currentBuilt.root.visible = !showPhotoNow;

      // Center product horizontally slightly left when Shaker is shown
      const targetProdX = showShakerRef.current ? -0.44 : 0;
      currentBuilt.root.position.x = THREE.MathUtils.damp(
        currentBuilt.root.position.x,
        targetProdX,
        8,
        delta,
      );
      currentPhotoShowcase.root.position.x = currentBuilt.root.position.x;

      if (showPhotoNow) {
        // Keep real product cutout smoothly facing the viewer on Y axis while VR/AR stage orbits around it
        const targetYaw = Math.atan2(
          camera.position.x - (stageGroup.position.x + currentPhotoShowcase.root.position.x),
          camera.position.z - stageGroup.position.z,
        );
        let diff = targetYaw - currentPhotoShowcase.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        currentPhotoShowcase.root.rotation.y += diff * (1 - Math.exp(-12 * delta));
      }

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

      // Smoothly animate scripted camera preset transitions
      if (presetTransitionRef.current.active) {
        getPresetCameraVectors(
          presetTransitionRef.current.preset,
          currentProductRef.current.shape,
          compactRef.current,
          showPhotoNow,
          _camGoalPos,
          _camGoalTarget,
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 7, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 7, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 7, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 7, delta);

        if (camera.position.distanceTo(_camGoalPos) < 0.015) {
          presetTransitionRef.current.active = false;
        }
      }

      // Apply VR Gyroscope head-tracking orbit when enabled
      if (activeMode === 'vr' && gyroDeltaRef.current) {
        const radius = 4.15;
        const yaw = gyroDeltaRef.current.yaw;
        const pitch = THREE.MathUtils.clamp(0.32 + gyroDeltaRef.current.pitch * 0.65, 0.08, 1.25);
        const gx = Math.sin(yaw) * Math.cos(pitch) * radius;
        const gy = Math.sin(pitch) * radius + 0.6;
        const gz = Math.cos(yaw) * Math.cos(pitch) * radius;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, gx, 8, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, gy, 8, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, gz, 8, delta);
      }

      controls.autoRotate = autoRotateRef.current && !isSoftwareGl && !presetTransitionRef.current.active;
      controls.autoRotateSpeed = 1.45;
      controls.update();

      const curW = container.clientWidth || width;
      const curH = container.clientHeight || height;
      renderSingleOrStereo(curW, curH);

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
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      currentLabelTex.dispose();
      envTex.dispose();
      shadowTex.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      currentBuilt.disposables.forEach((d) => d.dispose());
      currentPhotoShowcase.disposables.forEach((d) => d.dispose());
      if (currentRealAssets) {
        currentRealAssets.disposables.forEach((d) => d.dispose());
      }
      shakerBuilt.disposables.forEach((d) => d.dispose());
      arReticle.disposables.forEach((d) => d.dispose());
      vrShowroom.disposables.forEach((d) => d.dispose());
      if (softboxLight) softboxLight.dispose();
      renderer.dispose();
    };
  }, []);

  const hasMountedSwapRef = useRef(false);
  useEffect(() => {
    if (!hasMountedSwapRef.current) {
      hasMountedSwapRef.current = true;
      return;
    }
    setActivePreset('hero');
    sceneSwapRef.current?.swap(product, selectedFlavor);
  }, [product, selectedFlavor]);

  const handleCapture = () => {
    sceneSwapRef.current?.capture();
    setSnapshotNotice('Đã lưu ảnh chụp');
    window.setTimeout(() => setSnapshotNotice(null), 2200);
  };

  const handleResetView = () => {
    setExploded(false);
    setUsePhotoShowcase(mode !== '3d');
    setArScale(1);
    setArOffset({ x: 0, z: 0 });
    triggerPreset('hero');
  };

  const realSizeLabel = getRealSizeLabel(product);

  return (
    <div
      ref={viewerRootRef}
      className={`relative w-full overflow-hidden border border-neutral-200 bg-neutral-100 ${
        isFullscreen
          ? 'h-screen w-screen border-0'
          : compact
            ? 'h-[390px] sm:h-[450px]'
            : 'h-[500px] sm:h-[580px]'
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
              className="absolute inset-0 flex flex-col items-center justify-end pb-36 text-center"
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
              <div className="relative z-10 flex items-center gap-2 border border-neutral-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm">
                <span>Đặt trên mặt bàn · Kích thước thật {realSizeLabel}</span>
                <button
                  type="button"
                  onClick={() => setArRetryNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1 bg-neutral-950 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#FF5A00]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Bật Camera</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stereoscopic VR Eye Divider & Cardboard Lens Frame (Mobile Phones Only) */}
      {mode === 'vr' && isMobilePhone && (
        <div className="pointer-events-none absolute inset-0 z-10 flex">
          <div className="relative flex-1 border-r border-neutral-700/80">
            <div className="absolute left-3 top-[74px] bg-black/75 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
              MẮT TRÁI · IPD {vrIpdMm}mm
            </div>
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          </div>
          <div className="relative flex-1">
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
        className="relative z-[5] h-full w-full cursor-grab active:cursor-grabbing"
      />

      {contextLost && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-100 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">
            WebGL tạm gián đoạn. Vui lòng chọn lại chế độ xem hoặc tải lại trang.
          </p>
        </div>
      )}

      {/* Top Minimal Spec Header (No side-panel clutter) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto bg-neutral-950/95 px-3 py-2 text-white">
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-300">
            <span className="font-mono font-bold text-[#FF5A00]">
              {mode === '3d'
                ? '3D STUDIO'
                : mode === 'ar'
                  ? arCameraStatus === 'active'
                    ? 'AR CAMERA LIVE'
                    : 'AR MÔ PHỎNG'
                  : 'VR SHOWROOM 360°'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[140px] truncate sm:max-w-[240px]">{selectedFlavor.name}</span>
            <span className="hidden font-mono text-neutral-400 sm:inline">
              · {realSizeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-white">
            {mode === 'ar'
              ? 'Chỉnh tỉ lệ thật, xoay 360° và chụp ảnh đặt sản phẩm trên bàn'
              : mode === 'vr'
                ? vrGyroHint ?? 'Bật Toàn màn hình để lắp kính VR / Cardboard hoặc kéo xoay 360°'
                : 'Kéo xoay 360° · Cuộn phóng to · Đổi góc xem mặt sau dinh dưỡng'}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={handleCapture}
            title="Chụp ảnh màn hình 3D / AR"
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
              aria-label="Đóng trình xem 3D"
              className="flex h-9 w-9 items-center justify-center bg-neutral-950/95 text-white transition-colors hover:bg-[#FF5A00]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-2 sm:px-3">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 flex items-center gap-1.5 bg-neutral-950 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#FF5A00]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {dockCollapsed ? 'Mở thanh điều khiển 3D/AR/VR' : 'Thu gọn điều khiển'}
        </button>

        {!dockCollapsed && (
          <div className="flex w-full max-w-[780px] flex-col gap-2 border border-neutral-800 bg-neutral-950/95 p-2 text-white">
            {/* Row 1: Mode Switcher + Mode-Specific Quick Tools */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-neutral-900 p-1">
                <button
                  type="button"
                  onClick={() => handleSetMode('3d')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    mode === '3d'
                      ? 'bg-[#FF5A00] text-white'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>3D</span>
                </button>
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

              {/* Camera Angle Presets in 3D mode */}
              {mode === '3d' && (
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['hero', 'Góc 3/4'],
                      ['front', 'Mặt trước'],
                      ['nutrition', 'Thành phần'],
                      ['top', 'Từ trên'],
                    ] as Array<[CameraPreset, string]>
                  ).map(([presetKey, label]) => (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => triggerPreset(presetKey)}
                      className={`px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        activePreset === presetKey
                          ? 'bg-white text-neutral-950'
                          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* AR Scale + Position Nudge + Camera Flip in AR mode */}
              {mode === 'ar' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                    <span className="whitespace-nowrap">Tỉ lệ {Math.round(arScale * 100)}%</span>
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
                  <div className="flex items-center gap-1 bg-neutral-900 px-1.5 py-0.5 text-[11px]">
                    <Move className="h-3 w-3 text-[#FF5A00]" />
                    <button
                      type="button"
                      onClick={() => setArOffset((p) => ({ ...p, x: Math.max(p.x - 0.3, -1.5) }))}
                      className="px-1.5 py-0.5 hover:text-[#FF5A00]"
                      title="Dịch trái"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setArOffset((p) => ({ ...p, x: Math.min(p.x + 0.3, 1.5) }))}
                      className="px-1.5 py-0.5 hover:text-[#FF5A00]"
                      title="Dịch phải"
                    >
                      →
                    </button>
                  </div>
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

            {/* Row 2: Action Controls (Photo/3D toggle, Explode, Shaker Gift Scale, Theme, Rotate, Reset) */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-neutral-800 pt-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setUsePhotoShowcase((prev) => {
                      const next = !prev;
                      if (next) setExploded(false);
                      return next;
                    });
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    usePhotoShowcase && !exploded
                      ? 'bg-white text-neutral-950'
                      : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                  }`}
                >
                  {usePhotoShowcase && !exploded ? 'Ảnh thật sản phẩm' : 'Xem ảnh thật'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExploded((v) => {
                      const next = !v;
                      if (next) setUsePhotoShowcase(false);
                      return next;
                    });
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    exploded
                      ? 'bg-white text-neutral-950'
                      : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                  }`}
                >
                  {exploded ? 'Đóng nắp' : 'Mở nắp xem lõi'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowShaker((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    showShaker
                      ? 'bg-[#FF5A00] text-white'
                      : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                  }`}
                >
                  <Gift className="h-3.5 w-3.5" />
                  <span>{showShaker ? 'Ẩn bình lắc tặng' : 'Kèm bình lắc 700ml'}</span>
                </button>

                {mode === '3d' && (
                  <button
                    type="button"
                    onClick={() => setStudioTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                    className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                  >
                    <Sun className="h-3.5 w-3.5 text-[#FF5A00]" />
                    <span>{studioTheme === 'light' ? 'Nền tối' : 'Nền sáng'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoRotate((v) => !v)}
                  className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                  title={autoRotate ? 'Tạm dừng tự xoay' : 'Tự xoay 360°'}
                >
                  {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{autoRotate ? 'Dừng' : 'Xoay'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetView}
                  className="flex items-center gap-1 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 whitespace-nowrap"
                  title="Đặt lại góc nhìn"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
