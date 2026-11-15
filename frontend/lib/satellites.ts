import * as satellite from 'satellite.js';

export interface SatelliteMission {
  id: string;
  name: string;
  noradId: number;
  agency: string;
  category: 'nasa' | 'starlink' | 'international';
  roleUk: string;
  roleEn: string;
  sensorUk: string;
  sensorEn: string;
  swathKm: number; // Observation beam footprint width
  altitudeKm: number;
  inclinationDeg: number;
  tleLine1: string;
  tleLine2: string;
  productKey?: string; // Associated NASA product in FieldShift
  status: 'operational' | 'simulation';
  color: string;
}

export const SATELLITE_FLEET: SatelliteMission[] = [
  {
    id: 'landsat8',
    name: 'Landsat 8',
    noradId: 39084,
    agency: 'NASA / USGS',
    category: 'nasa',
    roleUk: 'Оптичний моніторинг поверхні суходолу та біомаси',
    roleEn: 'Optical land surface and vegetation monitoring',
    sensorUk: 'OLI (Operational Land Imager) + TIRS (Thermal Infrared)',
    sensorEn: 'OLI (Operational Land Imager) + TIRS (Thermal Infrared)',
    swathKm: 185,
    altitudeKm: 705,
    inclinationDeg: 98.2,
    tleLine1: '1 39084U 13008A   26314.50000000  .00000050  00000-0  20000-4 0  9991',
    tleLine2: '2 39084  98.2000 145.2000 0001200  95.0000 265.1000 14.57100000620001',
    productKey: 'HLS',
    status: 'operational',
    color: '#59D9F7',
  },
  {
    id: 'landsat9',
    name: 'Landsat 9',
    noradId: 49260,
    agency: 'NASA / USGS',
    category: 'nasa',
    roleUk: 'Високоточний супутниковий моніторинг NDVI та рослинності',
    roleEn: 'High-precision NDVI and vegetative health monitoring',
    sensorUk: 'OLI-2 (15-30m) + TIRS-2 (100m)',
    sensorEn: 'OLI-2 (15-30m) + TIRS-2 (100m)',
    swathKm: 185,
    altitudeKm: 705,
    inclinationDeg: 98.2,
    tleLine1: '1 49260U 21088A   26314.50000000  .00000060  00000-0  22000-4 0  9992',
    tleLine2: '2 49260  98.2000 235.4000 0001100 102.0000 258.2000 14.57100000210002',
    productKey: 'HLS',
    status: 'operational',
    color: '#70B86B',
  },
  {
    id: 'smap',
    name: 'SMAP (Soil Moisture Active Passive)',
    noradId: 40376,
    agency: 'NASA JPL',
    category: 'nasa',
    roleUk: 'Глобальне вимірювання вологості кореневого шару ґрунту',
    roleEn: 'Global soil moisture and freeze/thaw state measurement',
    sensorUk: 'L-band (1.41 GHz) Radiometer & Conical Scanning Antenna',
    sensorEn: 'L-band (1.41 GHz) Radiometer & Conical Scanning Antenna',
    swathKm: 1000,
    altitudeKm: 685,
    inclinationDeg: 98.1,
    tleLine1: '1 40376U 15003A   26314.50000000  .00000120  00000-0  35000-4 0  9993',
    tleLine2: '2 40376  98.1200 180.5000 0008500  60.0000 300.2000 14.63000000550003',
    productKey: 'SMAP',
    status: 'operational',
    color: '#00B4D8',
  },
  {
    id: 'gpm',
    name: 'GPM Core Observatory',
    noradId: 39574,
    agency: 'NASA / JAXA',
    category: 'nasa',
    roleUk: 'Глобальний радіолокаційний моніторинг опадів та снігу',
    roleEn: 'Global radar and microwave precipitation monitoring',
    sensorUk: 'DPR (Dual-frequency Precip Radar) + GMI (Microwave Imager)',
    sensorEn: 'DPR (Dual-frequency Precip Radar) + GMI (Microwave Imager)',
    swathKm: 900,
    altitudeKm: 407,
    inclinationDeg: 65.0,
    tleLine1: '1 39574U 14009A   26314.50000000  .00001500  00000-0  75000-4 0  9994',
    tleLine2: '2 39574  65.0000 120.3000 0001500 135.0000 225.1000 15.52000000590004',
    productKey: 'POWER',
    status: 'operational',
    color: '#48CAE4',
  },
  {
    id: 'iss_ecostress',
    name: 'ISS / ECOSTRESS',
    noradId: 25544,
    agency: 'NASA JPL (on ISS)',
    category: 'nasa',
    roleUk: 'Теплове картографування стресу рослин та евапотранспірації',
    roleEn: 'Thermal infrared mapping of plant water stress & evapotranspiration',
    sensorUk: 'TIR Radiometer (5 spectral bands, 70m resolution)',
    sensorEn: 'TIR Radiometer (5 spectral bands, 70m resolution)',
    swathKm: 400,
    altitudeKm: 420,
    inclinationDeg: 51.6,
    tleLine1: '1 25544U 98067A   26314.50000000  .00016717  00000-0  10270-3 0  9001',
    tleLine2: '2 25544  51.6400 208.1000 0005000 120.0000 240.0000 15.49000000450001',
    productKey: 'ECOSTRESS',
    status: 'operational',
    color: '#FFAA00',
  },
  {
    id: 'nisar',
    name: 'NISAR (NASA-ISRO SAR)',
    noradId: 58000,
    agency: 'NASA / ISRO',
    category: 'nasa',
    roleUk: 'Радарний моніторинг структури ґрунту та деформацій поверхні',
    roleEn: 'Dual-frequency SAR monitoring of soil roughness and biomass',
    sensorUk: 'L-band (24 cm) + S-band (9 cm) SweepSAR (12m reflector)',
    sensorEn: 'L-band (24 cm) + S-band (9 cm) SweepSAR (12m reflector)',
    swathKm: 242,
    altitudeKm: 747,
    inclinationDeg: 98.4,
    tleLine1: '1 58000U 24001A   26314.50000000  .00000080  00000-0  25000-4 0  9995',
    tleLine2: '2 58000  98.4000 310.2000 0001000  85.0000 275.0000 14.50000000120005',
    productKey: 'NISAR',
    status: 'simulation',
    color: '#B4FF63',
  },
];

// 24 representative Starlink constellation satellites across 4 orbital planes (altitude ~550 km, inc 53°)
export const STARLINK_CONSTELLATION: SatelliteMission[] = Array.from({ length: 24 }, (_, i) => {
  const planeIndex = Math.floor(i / 6);
  const slotIndex = i % 6;
  const raan = (planeIndex * 90.0).toFixed(4);
  const meanAnomaly = (slotIndex * 60.0).toFixed(4);
  const noradId = 44000 + i;

  return {
    id: `starlink_${i + 1}`,
    name: `Starlink-${100 + i}`,
    noradId,
    agency: 'SpaceX',
    category: 'starlink',
    roleUk: 'Супутниковий широкосмуговий інтернет для польових терміналів',
    roleEn: 'Broadband satellite connectivity for agricultural IoT gateways',
    sensorUk: 'Ku/Ka-band Phased Array + Optical Intersatellite Laser Links',
    sensorEn: 'Ku/Ka-band Phased Array + Optical Intersatellite Laser Links',
    swathKm: 580,
    altitudeKm: 550,
    inclinationDeg: 53.0,
    tleLine1: `1 ${noradId}U 19029A   26314.50000000  .00001200  00000-0  65000-4 0  90${i < 10 ? '0' + i : i}`,
    tleLine2: `2 ${noradId}  53.0500 ${raan.padStart(8, ' ')} 0001400  45.0000 ${meanAnomaly.padStart(8, ' ')} 15.060000001000`,
    status: 'operational',
    color: '#B4FF63',
  };
});

export interface SatellitePosition {
  latitude: number; // degrees -90 to +90
  longitude: number; // degrees -180 to +180
  altitudeKm: number;
  x: number; // 3D coordinates normalized for sphere radius R
  y: number;
  z: number;
}

/**
 * Propagates satellite TLE to calculate current geodetic position and 3D Cartesian coordinates
 * on a sphere of radius R.
 */
export function getSatellitePosition(sat: SatelliteMission, date: Date, earthRadius: number = 100): SatellitePosition {
  try {
    const satrec = satellite.twoline2satrec(sat.tleLine1, sat.tleLine2);
    const posVel = satellite.propagate(satrec, date);

    if (posVel && posVel.position && typeof posVel.position !== 'boolean') {
      const gmst = satellite.gstime(date);
      const posGd = satellite.eciToGeodetic(posVel.position, gmst);

      const latDeg = satellite.degreesLat(posGd.latitude);
      const lonDeg = satellite.degreesLong(posGd.longitude);
      const altKm = posGd.height;

      // Scale height: 100 units = 6371 km Earth radius
      const scaleRadius = earthRadius * (1 + altKm / 6371.0);
      const latRad = posGd.latitude;
      const lonRad = posGd.longitude;

      // Convert spherical (lat/lon) to 3D Cartesian
      const x = scaleRadius * Math.cos(latRad) * Math.sin(lonRad);
      const y = scaleRadius * Math.sin(latRad);
      const z = scaleRadius * Math.cos(latRad) * Math.cos(lonRad);

      return {
        latitude: latDeg,
        longitude: lonDeg,
        altitudeKm: altKm,
        x,
        y,
        z,
      };
    }
  } catch (e) {
    // Fallback orbital math if propagation fails
  }

  // Graceful circular orbit simulation fallback
  const epochSec = date.getTime() / 1000;
  const periodSec = (90 + (sat.altitudeKm / 100) * 2) * 60;
  const angle = (epochSec % periodSec) / periodSec * Math.PI * 2;
  const incRad = (sat.inclinationDeg * Math.PI) / 180;
  const r = earthRadius * (1 + sat.altitudeKm / 6371.0);

  const x = r * Math.cos(angle);
  const y = r * Math.sin(angle) * Math.sin(incRad);
  const z = r * Math.sin(angle) * Math.cos(incRad);

  return {
    latitude: (Math.asin(y / r) * 180) / Math.PI,
    longitude: (Math.atan2(x, z) * 180) / Math.PI,
    altitudeKm: sat.altitudeKm,
    x,
    y,
    z,
  };
}

/**
 * Calculates a complete 3D orbital loop trajectory (90 min period) for rendering orbit path lines.
 */
export function getOrbitPathPoints(sat: SatelliteMission, baseDate: Date, earthRadius: number = 100, samples: number = 64): [number, number, number][] {
  const points: [number, number, number][] = [];
  const periodMinutes = 95;
  const stepMs = (periodMinutes * 60 * 1000) / samples;

  for (let i = 0; i <= samples; i++) {
    const t = new Date(baseDate.getTime() + i * stepMs);
    const pos = getSatellitePosition(sat, t, earthRadius);
    points.push([pos.x, pos.y, pos.z]);
  }

  return points;
}
