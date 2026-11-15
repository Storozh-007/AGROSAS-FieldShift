'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Cpu, Radio, Wifi, Sun, Droplets, Thermometer, Battery, Info, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { Field, Device, SensorMeasurement } from '@/lib/types';
import type { Copy } from '@/lib/i18n';

interface FieldTwin3DProps {
  field: Field;
  devices: Device[];
  telemetry: SensorMeasurement[];
  t: Copy;
  onOpenAnalysis: () => void;
}

export default function FieldTwin3D({
  field,
  devices,
  telemetry,
  t,
  onOpenAnalysis,
}: FieldTwin3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06131c);
    scene.fog = new THREE.FogExp2(0x06131c, 0.007);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    camera.position.set(0, 45, 95);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x08251a, 1.6);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7e6, 2.4);
    sunLight.position.set(60, 80, 40);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 3. Terrain & Crop Field Mesh with NDVI Color Gradient
    const terrainWidth = 100;
    const terrainHeight = 80;
    const terrainGeo = new THREE.PlaneGeometry(terrainWidth, terrainHeight, 48, 48);
    terrainGeo.rotateX(-Math.PI / 2);

    // Subtle undulating elevation & agricultural furrows
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Gentle topography rolling hill + furrows
      const elevation = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.2 + Math.sin(z * 0.8) * 0.25;
      pos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    // Canvas texture with NDVI gradient & soil rows
    const fieldCanvas = document.createElement('canvas');
    fieldCanvas.width = 1024;
    fieldCanvas.height = 1024;
    const fCtx = fieldCanvas.getContext('2d')!;

    // Rich dark chernozem soil base
    fCtx.fillStyle = '#1c2e22';
    fCtx.fillRect(0, 0, 1024, 1024);

    // Alternating crop rows (maize / wheat)
    for (let y = 0; y < 1024; y += 16) {
      fCtx.fillStyle = y % 32 === 0 ? '#2d6a3f' : '#3c8c54'; // High NDVI green
      fCtx.fillRect(0, y, 1024, 10);
    }

    // High moisture & canopy zones
    const grad = fCtx.createRadialGradient(512, 512, 100, 512, 512, 450);
    grad.addColorStop(0, 'rgba(112, 184, 107, 0.45)');
    grad.addColorStop(0.7, 'rgba(23, 107, 69, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, 1024, 1024);

    const terrainTex = new THREE.CanvasTexture(fieldCanvas);
    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Perimeter Glowing Boundary Line
    const boundaryPoints = [
      new THREE.Vector3(-45, 0.5, -35),
      new THREE.Vector3(45, 0.5, -35),
      new THREE.Vector3(45, 0.5, 35),
      new THREE.Vector3(-45, 0.5, 35),
      new THREE.Vector3(-45, 0.5, -35),
    ];
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
    const boundaryMat = new THREE.LineBasicMaterial({ color: 0xb4ff63, linewidth: 2 });
    scene.add(new THREE.Line(boundaryGeo, boundaryMat));

    // 4. IoT 3D Devices in Field
    const clickableObjects: THREE.Object3D[] = [];

    // Helper: Weather Station 3D Model
    function createWeatherStation(x: number, z: number, dev?: Device): THREE.Group {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Mast / pole
      const mastGeo = new THREE.CylinderGeometry(0.3, 0.4, 12, 12);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 6;
      group.add(mast);

      // Solar panel & sensor crossbar
      const barGeo = new THREE.BoxGeometry(4.5, 0.2, 0.3);
      const bar = new THREE.Mesh(barGeo, mastMat);
      bar.position.y = 10.5;
      group.add(bar);

      // Mini solar panel
      const spGeo = new THREE.BoxGeometry(2.0, 0.1, 1.2);
      const spMat = new THREE.MeshStandardMaterial({ color: 0x0d2847, metalness: 0.9 });
      const sp = new THREE.Mesh(spGeo, spMat);
      sp.position.set(1.2, 10.8, 0);
      sp.rotateZ(-0.35);
      group.add(sp);

      // Anemometer cups
      const anemometer = new THREE.Group();
      anemometer.position.set(-1.4, 11.2, 0);
      for (let i = 0; i < 3; i++) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9), mastMat);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = (i * Math.PI * 2) / 3;
        anemometer.add(arm);
      }
      group.add(anemometer);
      group.userData = { isAnemometer: true, anemometerRef: anemometer, dev };

      // Hit Target
      const hit = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 6;
      hit.userData = { dev };
      group.add(hit);
      clickableObjects.push(hit);

      return group;
    }

    // Helper: Soil Moisture Multi-depth Probe Model
    function createSoilProbe(x: number, z: number, dev?: Device): THREE.Group {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Above ground collar & antenna
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.5, 12), new THREE.MeshStandardMaterial({ color: 0x176b45 }));
      collar.position.y = 1.25;
      group.add(collar);

      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      ant.position.y = 3.5;
      group.add(ant);

      // Below ground probe core (semi-visible / translucent ground marker)
      const probeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 6, 8), new THREE.MeshBasicMaterial({ color: 0x59d9f7 }));
      probeCore.position.y = -3;
      group.add(probeCore);

      // Depth rings (10cm, 30cm, 60cm)
      [ -1.0, -3.0, -5.0 ].forEach(d => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 16), new THREE.MeshBasicMaterial({ color: 0xb4ff63 }));
        ring.position.y = d;
        ring.rotateX(Math.PI / 2);
        group.add(ring);
      });

      const hit = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 2;
      hit.userData = { dev };
      group.add(hit);
      clickableObjects.push(hit);

      return group;
    }

    // Helper: Starlink Terminal Dish
    function createStarlinkDish(x: number, z: number, dev?: Device): THREE.Group {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Pedestal
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
      base.position.y = 1.5;
      group.add(base);

      // Rectangular Dishy angled to space
      const dish = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 3.4), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3 }));
      dish.position.set(0, 3.2, 0);
      dish.rotateX(0.5); // 30° elevation
      dish.rotateY(0.4);
      group.add(dish);

      // Pulsating Wi-Fi / Starlink signal arc
      const arcGeo = new THREE.RingGeometry(1.5, 1.8, 24);
      const arcMat = new THREE.MeshBasicMaterial({ color: 0xb4ff63, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.position.set(0, 4.5, 0);
      arc.rotateX(-Math.PI / 2);
      group.add(arc);
      group.userData = { isStarlink: true, arcRef: arc, dev };

      const hit = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 2.5;
      hit.userData = { dev };
      group.add(hit);
      clickableObjects.push(hit);

      return group;
    }

    // Add devices onto 3D field terrain
    const wsDev = devices.find(d => d.device_type === 'weather_station') || devices[0];
    const smDev = devices.find(d => d.device_type === 'soil_moisture') || devices[1];
    const rgDev = devices.find(d => d.device_type === 'rain_gauge') || devices[2];

    const wsGroup = createWeatherStation(-20, -10, wsDev);
    const smGroup = createSoilProbe(10, 5, smDev);
    const slGroup = createStarlinkDish(-30, 20, rgDev);

    scene.add(wsGroup);
    scene.add(smGroup);
    scene.add(slGroup);

    // 5. Mouse Orbit / Drag
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      camera.position.x += dx * 0.15;
      camera.position.y = Math.max(15, Math.min(85, camera.position.y - dy * 0.15));
      camera.lookAt(0, 0, 0);

      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableObjects);
      if (hits.length > 0) {
        const hitDev = hits[0].object.userData.dev;
        if (hitDev) {
          setSelectedDevice(hitDev);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('click', onClick);

    // 6. Animation Loop
    let animId: number;
    let phase = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      phase += 0.05;

      // Spin anemometer cups
      if (wsGroup.userData.anemometerRef) {
        wsGroup.userData.anemometerRef.rotation.y += 0.06;
      }
      // Pulse Starlink signal arc
      if (slGroup.userData.arcRef) {
        const s = 1.0 + 0.35 * Math.sin(phase);
        slGroup.userData.arcRef.scale.set(s, s, 1.0);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('click', onClick);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [devices]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden" style={{ background: '#06131C' }}>
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Field Digital Twin Banner Header */}
      <div className="absolute top-6 left-6 flex items-center gap-3 bg-[#06131C]/85 backdrop-blur-md border border-emerald-500/30 px-5 py-3 rounded-2xl text-white z-10 shadow-2xl">
        <div className="icon-chip" style={{ background: '#EAF4E6', color: '#176B45', padding: '8px', borderRadius: 10 }}>
          <Cpu size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">{field.name}</h2>
            <span className="tag green" style={{ fontSize: '0.7rem' }}>
              3D DIGITAL TWIN
            </span>
          </div>
          <p className="text-xs text-gray-300">
            {field.area_ha} га · {field.soil_type} · Ін-сіту IoT датчики та NDVI шар
          </p>
        </div>
      </div>

      {/* Button to Launch Crop Rotation Intelligence */}
      <div className="absolute top-6 right-6 z-10">
        <Button onClick={onOpenAnalysis} className="flex items-center gap-2 shadow-xl">
          <span>{t.openAnalysis}</span>
          <ArrowRight size={16} />
        </Button>
      </div>

      {/* Clicked IoT Device Telemetry Popup Card */}
      {selectedDevice && (
        <div className="absolute bottom-6 right-6 w-80 bg-[#06131C]/90 backdrop-blur-xl border border-emerald-500/40 p-4 rounded-2xl text-white z-20 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="tag green" style={{ fontSize: '0.68rem' }}>
                {selectedDevice.device_type.toUpperCase()}
              </span>
              <h3 className="font-semibold text-emerald-100 mt-1">{selectedDevice.name}</h3>
              <p className="text-xs text-gray-400 font-mono">{selectedDevice.serial_number}</p>
            </div>
            <button onClick={() => setSelectedDevice(null)} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-emerald-900/60 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">{t.connectivityStatus}:</span>
              <span className="font-semibold text-emerald-300">{selectedDevice.connectivity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">{t.batteryLevel}:</span>
              <span className="font-semibold text-emerald-400">{selectedDevice.battery_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Статус:</span>
              <span className="tag green text-[10px]">{selectedDevice.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
