import * as THREE from 'three';

/**
 * Creates high-fidelity Earth daytime texture with geographic continents,
 * distinct biomes, and highlighted agricultural belts (including Ukraine).
 */
export function createEarthDayTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Ocean Base with bathymetric gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#0a2138'); // Arctic
  oceanGrad.addColorStop(0.3, '#0b3558'); // North Atlantic
  oceanGrad.addColorStop(0.5, '#0d406b'); // Equatorial deep ocean
  oceanGrad.addColorStop(0.7, '#0b3558'); // South Atlantic
  oceanGrad.addColorStop(1, '#0a2138'); // Antarctic
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Function to project lon/lat to equirectangular canvas coordinates
  const toX = (lon: number) => ((lon + 180) / 360) * width;
  const toY = (lat: number) => ((90 - lat) / 180) * height;

  // Draw Continent Landmasses
  function drawLandmass(points: [number, number][], color: string) {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(points[0][0]), toY(points[0][1]));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i][0]), toY(points[i][1]));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Continental Shelves / Shallows (Teal)
  ctx.fillStyle = 'rgba(23, 107, 120, 0.35)';
  // Europe & Mediterranean shelf
  ctx.fillRect(toX(-12), toY(65), toX(45) - toX(-12), toY(35) - toY(65));

  // Eurasia (Broad landmass)
  drawLandmass([
    [-10, 36], [0, 44], [10, 54], [25, 71], [60, 75], [105, 78], [170, 68], [180, 66],
    [145, 45], [125, 32], [105, 20], [80, 10], [70, 22], [50, 26], [40, 15], [35, 30],
    [26, 36], [12, 38], [-5, 36]
  ], '#2c4e33');

  // Africa
  drawLandmass([
    [-17, 15], [-5, 36], [12, 38], [32, 31], [43, 12], [51, 10], [40, -10],
    [32, -28], [18, -34], [12, -15], [9, 5], [-15, 12]
  ], '#544d32');

  // Sahara Desert Overlay
  drawLandmass([
    [-15, 18], [35, 30], [35, 20], [-10, 16]
  ], '#7c7048');

  // North America
  drawLandmass([
    [-168, 65], [-140, 70], [-95, 72], [-65, 60], [-55, 48], [-75, 35], [-80, 25],
    [-98, 20], [-105, 25], [-120, 35], [-125, 50], [-165, 60]
  ], '#314e36');

  // South America
  drawLandmass([
    [-80, 10], [-50, 5], [-35, -5], [-40, -22], [-55, -38], [-68, -55], [-75, -45],
    [-80, -10], [-80, 5]
  ], '#2a5435');

  // Australia
  drawLandmass([
    [114, -22], [128, -15], [138, -12], [145, -15], [153, -28], [148, -38],
    [135, -35], [115, -34]
  ], '#6e5a38');

  // Antarctica & Greenland (Ice caps)
  ctx.fillStyle = '#d8e5ec';
  ctx.fillRect(0, toY(-65), width, height - toY(-65)); // Antarctica
  drawLandmass([[-50, 82], [-20, 80], [-25, 70], [-45, 60], [-55, 72]], '#d8e5ec'); // Greenland

  // 2. Highlighting Key Global Agricultural Belts (Vivid Green)
  ctx.fillStyle = '#428a4c';
  // European Breadbasket
  ctx.fillRect(toX(15), toY(55), toX(45) - toX(15), toY(45) - toY(55));
  // US Corn Belt
  ctx.fillRect(toX(-100), toY(46), toX(-80) - toX(-100), toY(36) - toY(46));
  // South American Pampas
  ctx.fillRect(toX(-65), toY(-25), toX(-50) - toX(-65), toY(-38) - toY(-25));

  // 3. SPECIAL HIGHLIGHT: UKRAINE (Key Region of FieldShift)
  // Coordinates roughly: lon 22° to 40° E, lat 44° to 52.4° N
  ctx.save();
  ctx.shadowColor = '#B4FF63';
  ctx.shadowBlur = 18;

  // Ukraine Chornozem agricultural heartland polygon
  ctx.beginPath();
  const ukrainePoly: [number, number][] = [
    [22.2, 48.5], [24.0, 50.5], [28.5, 51.5], [33.5, 52.4], [38.5, 50.0],
    [40.2, 49.0], [38.0, 46.8], [35.0, 45.2], [33.5, 46.2], [30.0, 45.5],
    [28.2, 46.5], [26.0, 48.0], [22.2, 48.5]
  ];
  ctx.moveTo(toX(ukrainePoly[0][0]), toY(ukrainePoly[0][1]));
  for (let i = 1; i < ukrainePoly.length; i++) {
    ctx.lineTo(toX(ukrainePoly[i][0]), toY(ukrainePoly[i][1]));
  }
  ctx.closePath();
  ctx.fillStyle = '#1e753b';
  ctx.fill();

  // Glowing neon boundary outline
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#B4FF63';
  ctx.stroke();

  // Poltava Region Landmark Beacon (lon 34.5, lat 49.6)
  const poltavaX = toX(34.5);
  const poltavaY = toY(49.6);
  ctx.beginPath();
  ctx.arc(poltavaX, poltavaY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#59D9F7';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates night city lights texture for dark-side Earth rendering.
 */
export function createEarthNightTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep space dark black base
  ctx.fillStyle = '#03080e';
  ctx.fillRect(0, 0, width, height);

  const toX = (lon: number) => ((lon + 180) / 360) * width;
  const toY = (lat: number) => ((90 - lat) / 180) * height;

  // Function to paint glowing urban cluster
  function drawCityCluster(lon: number, lat: number, radius: number, intensity: number = 0.8) {
    const x = toX(lon);
    const y = toY(lat);
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    radGrad.addColorStop(0, `rgba(255, 230, 140, ${intensity})`);
    radGrad.addColorStop(0.35, `rgba(240, 180, 60, ${intensity * 0.7})`);
    radGrad.addColorStop(0.7, `rgba(200, 120, 30, ${intensity * 0.3})`);
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Major European & Ukrainian Clusters
  drawCityCluster(30.5, 50.45, 12, 1.0); // Kyiv
  drawCityCluster(34.55, 49.59, 9, 0.95); // Poltava
  drawCityCluster(36.23, 50.0, 10, 0.9); // Kharkiv
  drawCityCluster(35.04, 48.46, 10, 0.9); // Dnipro
  drawCityCluster(30.73, 46.48, 10, 0.85); // Odesa
  drawCityCluster(24.03, 49.84, 9, 0.85); // Lviv

  // European Metropolis belt
  drawCityCluster(2.35, 48.85, 16, 0.9); // Paris
  drawCityCluster(-0.12, 51.5, 16, 0.9); // London
  drawCityCluster(13.4, 52.52, 14, 0.85); // Berlin
  drawCityCluster(21.0, 52.23, 11, 0.8); // Warsaw

  // North America
  drawCityCluster(-74.0, 40.7, 18, 0.9); // New York
  drawCityCluster(-87.6, 41.8, 15, 0.85); // Chicago
  drawCityCluster(-118.2, 34.0, 16, 0.85); // Los Angeles

  // East Asia
  drawCityCluster(139.7, 35.68, 18, 0.9); // Tokyo
  drawCityCluster(121.47, 31.23, 16, 0.85); // Shanghai

  // Nile ribbon
  for (let lat = 24; lat <= 31; lat += 0.8) {
    drawCityCluster(31.2 + Math.random() * 0.4, lat, 4, 0.7);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates dynamic cloud cover texture with semi-transparent alpha.
 */
export function createCloudsTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Clear transparent
  ctx.clearRect(0, 0, width, height);

  // Soft atmospheric cloud streaks
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * width;
    const y = height * 0.15 + Math.random() * height * 0.7;
    const rx = 40 + Math.random() * 90;
    const ry = 15 + Math.random() * 30;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.5, 'rgba(240, 248, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates custom atmosphere glow shader material (Fresnel electric cyan / emerald rim).
 */
export function createAtmosphereMaterial(): THREE.ShaderMaterial {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 glowColor;
    void main() {
      vec3 viewVector = normalize(-vPosition);
      float intensity = pow(1.0 - max(0.0, dot(vNormal, viewVector)), 2.8);
      gl_FragColor = vec4(glowColor, intensity * 0.75);
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      glowColor: { value: new THREE.Color('#59D9F7') },
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
}
