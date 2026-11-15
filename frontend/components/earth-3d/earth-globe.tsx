'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  SATELLITE_FLEET,
  STARLINK_CONSTELLATION,
  getSatellitePosition,
  getOrbitPathPoints,
  type SatelliteMission,
  type SatellitePosition,
} from '@/lib/satellites';
import {
  createEarthDayTexture,
  createEarthNightTexture,
  createCloudsTexture,
  createAtmosphereMaterial,
} from './procedural-textures';
import { Play, Pause, RotateCcw, Satellite, Wifi, Eye, Radio, Sparkles, Navigation } from 'lucide-react';
import { Button } from '../ui/button';

interface EarthGlobeProps {
  onSelectSatellite?: (sat: SatelliteMission | null) => void;
  onSelectRegion?: (region: string) => void;
  selectedSatelliteId?: string;
  showStarlink?: boolean;
  showObservationCones?: boolean;
  activeDataLayer?: string;
}

export default function EarthGlobe({
  onSelectSatellite,
  onSelectRegion,
  selectedSatelliteId,
  showStarlink = true,
  showObservationCones = true,
  activeDataLayer = 'ALL',
}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [focusedTarget, setFocusedTarget] = useState<string>('ukraine');

  // Animation & simulation time references
  const simTimeRef = useRef<Date>(new Date());
  const isPlayingRef = useRef(true);
  const timeMultiplierRef = useRef(1);
  isPlayingRef.current = isPlaying;
  timeMultiplierRef.current = timeMultiplier;

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const satellitesGroupRef = useRef<THREE.Group | null>(null);
  const starlinkGroupRef = useRef<THREE.Group | null>(null);
  const conesGroupRef = useRef<THREE.Group | null>(null);
  const orbitLinesGroupRef = useRef<THREE.Group | null>(null);

  // Satellite mesh registry for raycasting & animation
  const satMeshesRef = useRef<Map<string, { mesh: THREE.Group; sat: SatelliteMission }>>(new Map());
  const coneMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const targetCameraPosRef = useRef<THREE.Vector3>(new THREE.Vector3(25, 95, 185)); // Europe/Ukraine perspective

  // Helper: Convert lat/lon to 3D Cartesian coordinates on sphere R
  const latLonToVector3 = useCallback((lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }, []);

  // Set camera target view preset
  const setCameraPreset = (preset: 'space' | 'ukraine' | 'poltava') => {
    setFocusedTarget(preset);
    if (preset === 'space') {
      targetCameraPosRef.current.set(0, 110, 310);
    } else if (preset === 'ukraine') {
      // Perspective facing Eastern Europe / Ukraine (lat ~49°N, lon ~32°E)
      targetCameraPosRef.current.set(30, 95, 175);
    } else if (preset === 'poltava') {
      // Closer focus on Poltava agricultural cluster
      targetCameraPosRef.current.set(22, 85, 145);
    }
  };

  const skipIntro = () => {
    setIntroFinished(true);
    setCameraPreset('ukraine');
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Three.js Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 130, 390); // Start position for intro dive
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting (Sun & Deep Space ambient)
    const ambientLight = new THREE.AmbientLight(0x0d1f2d, 1.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.set(350, 120, 280);
    scene.add(sunLight);

    // 3. Deep Space Starfield (2500 glowing stars)
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2500;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 700 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);

      // Subtle cyan / lime / white twinkling
      const colVariant = Math.random();
      if (colVariant > 0.8) {
        starColors[i] = 0.7; starColors[i + 1] = 1.0; starColors[i + 2] = 0.9;
      } else if (colVariant > 0.6) {
        starColors[i] = 0.7; starColors[i + 1] = 0.95; starColors[i + 2] = 0.4;
      } else {
        starColors[i] = 0.9; starColors[i + 1] = 0.95; starColors[i + 2] = 1.0;
      }
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starsMat = new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // 4. Earth Globe Group
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    const earthRadius = 100;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);

    // Day & Night Multi-material / Shader
    const dayTexture = createEarthDayTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughness: 0.75,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Atmosphere Glow Outer Shell
    const atmosphereMat = createAtmosphereMaterial();
    const atmosphereGeo = new THREE.SphereGeometry(earthRadius * 1.045, 64, 64);
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthGroup.add(atmosphereMesh);

    // Clouds Layer (slightly larger, rotating gently)
    const cloudsTex = createCloudsTexture();
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.015, 64, 64);
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMeshRef.current = cloudsMesh;
    earthGroup.add(cloudsMesh);

    // 5. Poltava Beacon Pin & Pulsating Golden Ring (49.62° N, 34.46° E)
    const poltavaPos = latLonToVector3(49.62, 34.46, earthRadius);
    const beaconGroup = new THREE.Group();
    beaconGroup.position.copy(poltavaPos);
    beaconGroup.lookAt(0, 0, 0); // Orient towards Earth center

    // Glowing cyan marker cylinder
    const pinGeo = new THREE.CylinderGeometry(0.5, 0.2, 5, 12);
    pinGeo.rotateX(Math.PI / 2);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x59D9F7 });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    beaconGroup.add(pinMesh);

    // Pulsating ring
    const ringGeo = new THREE.RingGeometry(2.5, 3.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xB4FF63, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    beaconGroup.add(ringMesh);
    earthGroup.add(beaconGroup);

    // 6. Satellites Groups
    const satellitesGroup = new THREE.Group();
    satellitesGroupRef.current = satellitesGroup;
    scene.add(satellitesGroup);

    const starlinkGroup = new THREE.Group();
    starlinkGroupRef.current = starlinkGroup;
    scene.add(starlinkGroup);

    const conesGroup = new THREE.Group();
    conesGroupRef.current = conesGroup;
    scene.add(conesGroup);

    const orbitLinesGroup = new THREE.Group();
    orbitLinesGroupRef.current = orbitLinesGroup;
    scene.add(orbitLinesGroup);

    // Procedural 3D model generator for NASA Satellites
    function createNasaSatelliteMesh(sat: SatelliteMission): THREE.Group {
      const group = new THREE.Group();

      // Main Bus (Gold MLI foil cube)
      const busGeo = new THREE.BoxGeometry(2.4, 2.4, 3.2);
      const busMat = new THREE.MeshStandardMaterial({
        color: 0xf3c032,
        roughness: 0.3,
        metalness: 0.85,
        emissive: 0x332600,
      });
      const bus = new THREE.Mesh(busGeo, busMat);
      group.add(bus);

      // Solar Panels (Blue photovoltaic array with cells)
      const panelGeo = new THREE.BoxGeometry(7.0, 0.15, 1.8);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x113b68,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x051830,
      });
      const leftPanel = new THREE.Mesh(panelGeo, panelMat);
      leftPanel.position.set(-5.2, 0, 0);
      group.add(leftPanel);

      const rightPanel = new THREE.Mesh(panelGeo, panelMat);
      rightPanel.position.set(5.2, 0, 0);
      group.add(rightPanel);

      // High-gain Antenna Dish
      const dishGeo = new THREE.CylinderGeometry(1.2, 0.2, 0.4, 16);
      const dishMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 });
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(0, 0, 1.8);
      dish.rotateX(Math.PI / 2);
      group.add(dish);

      // Interactive Click Target Sphere
      const hitGeo = new THREE.SphereGeometry(4.5, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { satId: sat.id };
      group.add(hitMesh);

      return group;
    }

    // Procedural 3D model generator for Starlink Satellite
    function createStarlinkMesh(): THREE.Group {
      const group = new THREE.Group();

      // Flat rectangular chassis
      const bodyGeo = new THREE.BoxGeometry(1.2, 0.2, 2.0);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.9 });
      group.add(new THREE.Mesh(bodyGeo, bodyMat));

      // Single tall solar array
      const solarGeo = new THREE.BoxGeometry(1.0, 0.08, 4.0);
      const solarMat = new THREE.MeshStandardMaterial({ color: 0x0b2c54, metalness: 0.95 });
      const solar = new THREE.Mesh(solarGeo, solarMat);
      solar.position.set(0, 0, -3.0);
      group.add(solar);

      return group;
    }

    // Build NASA fleet meshes, orbit trails, and observation cones
    const now = new Date();
    SATELLITE_FLEET.forEach(sat => {
      // 1. Mesh
      const mesh = createNasaSatelliteMesh(sat);
      satellitesGroup.add(mesh);
      satMeshesRef.current.set(sat.id, { mesh, sat });

      // 2. Orbit Trail
      const orbitPoints = getOrbitPathPoints(sat, now, earthRadius, 72);
      const curve = new THREE.CatmullRomCurve3(orbitPoints.map(p => new THREE.Vector3(...p)), true);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120));
      const orbitMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(sat.color),
        transparent: true,
        opacity: 0.45,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLinesGroup.add(orbitLine);

      // 3. Volumetric Observation Cone (sensor beam down to Earth)
      const coneHeight = sat.altitudeKm / (6371 / earthRadius);
      const groundRadius = (sat.swathKm / (6371 / earthRadius)) * 0.8;
      const coneGeo = new THREE.ConeGeometry(groundRadius, coneHeight, 24, 1, true);
      coneGeo.translate(0, -coneHeight / 2, 0); // Apex at satellite
      const coneMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sat.color),
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      conesGroup.add(coneMesh);
      coneMeshesRef.current.set(sat.id, coneMesh);
    });

    // Build Starlink constellation meshes
    STARLINK_CONSTELLATION.forEach(starlinkSat => {
      const mesh = createStarlinkMesh();
      starlinkGroup.add(mesh);
      satMeshesRef.current.set(starlinkSat.id, { mesh, sat: starlinkSat });
    });

    // 7. Mouse Orbit & Drag Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      // Rotate Earth Group
      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y += deltaX * 0.005;
        earthGroupRef.current.rotation.x = Math.max(-0.6, Math.min(0.6, earthGroupRef.current.rotation.x + deltaY * 0.003));
      }

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const zoomFactor = e.deltaY * 0.12;
      const currentDist = cameraRef.current.position.length();
      const newDist = Math.max(135, Math.min(450, currentDist + zoomFactor));
      cameraRef.current.position.setLength(newDist);
      targetCameraPosRef.current.setLength(newDist);
    };

    // Click / Raycast Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Check click on satellites
      const hitObjects: THREE.Object3D[] = [];
      satMeshesRef.current.forEach(({ mesh }) => {
        mesh.traverse(child => {
          if (child instanceof THREE.Mesh && child.userData.satId) {
            hitObjects.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(hitObjects);
      if (intersects.length > 0) {
        const satId = intersects[0].object.userData.satId;
        const target = SATELLITE_FLEET.find(s => s.id === satId) || STARLINK_CONSTELLATION.find(s => s.id === satId);
        if (target && onSelectSatellite) {
          onSelectSatellite(target);
          return;
        }
      }

      // Check click on Earth / Ukraine beacon
      const earthIntersects = raycaster.intersectObject(earthMesh);
      if (earthIntersects.length > 0 && onSelectRegion) {
        onSelectRegion('ukraine');
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('click', handleClick);

    // 8. Animation Loop
    let animationFrameId: number;
    let ringPulsePhase = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Advance simulation clock
      if (isPlayingRef.current) {
        const deltaMs = 16.6 * timeMultiplierRef.current * 10;
        simTimeRef.current = new Date(simTimeRef.current.getTime() + deltaMs);
      }

      const currentTime = simTimeRef.current;

      // Update Satellites & Cones Positions
      satMeshesRef.current.forEach(({ mesh, sat }) => {
        const pos = getSatellitePosition(sat, currentTime, earthRadius);
        mesh.position.set(pos.x, pos.y, pos.z);

        // Orient satellite body tangentially along orbit vector
        mesh.lookAt(0, 0, 0);

        // Update observation cone
        const cone = coneMeshesRef.current.get(sat.id);
        if (cone) {
          cone.position.set(pos.x, pos.y, pos.z);
          cone.lookAt(0, 0, 0);
          cone.rotateX(Math.PI / 2);
        }
      });

      // Atmospheric rotation & Poltava beacon pulsating
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0002;
      }
      ringPulsePhase += 0.04;
      const ringScale = 1.0 + 0.25 * Math.sin(ringPulsePhase);
      ringMesh.scale.set(ringScale, ringScale, 1.0);

      // Camera lerp towards target
      if (cameraRef.current) {
        cameraRef.current.position.lerp(targetCameraPosRef.current, 0.045);
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Trigger initial cinematic camera transition
    const introTimeout = setTimeout(() => {
      setIntroFinished(true);
      setCameraPreset('ukraine');
    }, 400);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(introTimeout);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [latLonToVector3, onSelectRegion, onSelectSatellite]);

  // Handle visibility toggles for Starlink & Cones
  useEffect(() => {
    if (starlinkGroupRef.current) {
      starlinkGroupRef.current.visible = showStarlink;
    }
  }, [showStarlink]);

  useEffect(() => {
    if (conesGroupRef.current) {
      conesGroupRef.current.visible = showObservationCones;
    }
  }, [showObservationCones]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden" style={{ background: '#06131C' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Cinematic Intro Banner & Skip Button */}
      {!introFinished && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md border border-emerald-500/30 px-5 py-2.5 rounded-full text-white text-sm shadow-2xl z-30 animate-pulse">
          <Sparkles size={16} className="text-emerald-400" />
          <span>Синхронізація орбітальних даних NASA & Starlink…</span>
          <button
            onClick={skipIntro}
            className="text-xs bg-emerald-700/60 hover:bg-emerald-600 px-3 py-1 rounded-full text-emerald-100 transition-colors"
          >
            Пропустити
          </button>
        </div>
      )}

      {/* View Presets & Camera HUD Bar (Floating Over 3D Scene) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#06131C]/80 backdrop-blur-xl border border-emerald-500/30 px-4 py-2 rounded-2xl shadow-2xl z-20">
        <div className="flex items-center gap-1 border-r border-emerald-900/60 pr-2 mr-1">
          <Button
            variant="ghost"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-emerald-400 hover:text-white"
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              simTimeRef.current = new Date();
              setTimeMultiplier(1);
            }}
            className="text-emerald-400 hover:text-white"
            title="Reset to current UTC"
          >
            <RotateCcw size={14} />
          </Button>
        </div>

        {/* View Angles */}
        <button
          onClick={() => setCameraPreset('space')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            focusedTarget === 'space'
              ? 'bg-emerald-700/80 text-white shadow-md'
              : 'text-gray-300 hover:bg-emerald-950/40'
          }`}
        >
          Космос (Огляд)
        </button>

        <button
          onClick={() => setCameraPreset('ukraine')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            focusedTarget === 'ukraine'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
              : 'text-gray-300 hover:bg-emerald-950/40'
          }`}
        >
          <span>🇺🇦</span> Україна
        </button>

        <button
          onClick={() => setCameraPreset('poltava')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            focusedTarget === 'poltava'
              ? 'bg-emerald-700/80 text-white shadow-md'
              : 'text-gray-300 hover:bg-emerald-950/40'
          }`}
        >
          <Navigation size={13} className="text-cyan-400" /> Полтавщина
        </button>
      </div>
    </div>
  );
}
