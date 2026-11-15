export type Lang = 'uk' | 'en';
export type Geometry = { type: 'Polygon'; coordinates: number[][][] };
export type Weights = { water: number; soil: number; resilience: number; economy: number };

export type Field = {
  country?:string;boundary_provenance?:string;crop_origin?:string;operator_name?:string;
  id: string;
  name: string;
  geometry: Geometry;
  area_ha: number;
  crop_history: string[];
  soil_type: string;
  soil_ph: number | null;
  irrigation: boolean;
  priorities: Weights;
  is_demo: boolean;
  updated_at: string;
};

export type Dataset = {
  id: string;
  source: string;
  product?: string;
  kind: string;
  start: string;
  end: string;
  coverage: number;
  missing_days: number;
  downloaded_at: string;
  spatial_resolution: string;
  monthly: {
    month: string;
    temperature: number | null;
    precipitation: number | null;
    days: number;
    valid_precipitation_days: number;
  }[];
  rows?: { date: string; temperature: number | null; precipitation: number | null }[];
  is_demo?: boolean;
};

export type Strategy = {
  id: string;
  crops: string[];
  score: number;
  criteria: Weights;
  contributions: Weights;
  water_need_mm: number;
  rainfall_gap_mm: number;
  ph_penalty: number;
  family_repeat_fraction: number;
  limitations: string[];
};

export type Evaluation = {
  recommended: string;
  strategies: Strategy[];
  weights: Weights;
  climate: {
    baseline_temperature_c: number;
    temperature_c: number;
    baseline_precipitation_mm: number;
    precipitation_mm: number;
    stress_index: number;
    seasons: string[];
    valid_days: number;
  };
  scenario: { conditional: boolean; temperature_delta: number; precipitation_delta: number };
  provenance: { start: string; end: string; coverage: number; downloaded_at: string; source?: string; product?: string; spatial_resolution?: string };
  explanation: { winner: string; margin: number; strongest_contribution: keyof Weights };
  model_version: string;
};

export type VegetationObservation = {
  id: string;
  field_id: string;
  scene_date: string;
  satellite: string;
  product: string;
  ndvi_mean: number;
  ndvi_min: number;
  ndvi_max: number;
  cloud_cover_pct: number;
  is_demo: boolean;
};

export type Device = {
  id: string;
  name: string;
  device_type: 'soil_moisture' | 'soil_temperature' | 'weather_station' | 'rain_gauge' | 'lora_gateway';
  serial_number: string;
  field_id: string | null;
  connectivity: 'starlink' | 'cellular_4g' | 'lorawan' | 'offline';
  battery_pct: number | null;
  status: 'online' | 'offline' | 'warning';
  last_seen_at: string | null;
  is_demo: boolean;
  created_at: string;
};

export type SensorMeasurement = {
  id: string;
  device_id: string;
  field_id: string | null;
  timestamp: string;
  metric: string;
  value: number;
  unit: string;
  is_demo: boolean;
};

export type AiExplanation = {
  field_name: string;
  recommended_id: string;
  recommended_title: string;
  score: number;
  margin: number;
  summary: string;
  runner_up_comparison: string;
  factors: string[];
  limitations: string[];
  next_actions: string[];
  data_sources: { name: string; product: string; period: string; coverage: string; spatial_resolution: string }[];
  is_llm_generated: boolean;
  model_version: string;
};

export type ResilienceStatus = {
  region: string;
  country: string;
  updated_at: string;
  air_alert: {
    status: string;
    is_active: boolean;
    source: string;
    api_configured: boolean;
    disclaimer: string;
  };
  connectivity: {
    starlink: { status: string; latency_ms: number; throughput_mbps: number; uptime_pct: number };
    cellular_4g: { status: string; signal_strength: string; carrier: string };
    local_mesh: { status: string; active_nodes: number };
  };
  backup_power: {
    primary_source: string;
    generator_status: string;
    generator_fuel_hours: number;
    battery_storage_kwh: number;
    battery_soc_pct: number;
  };
  contacts: { id: string; title: string; phone: string; description: string; url: string }[];
  checklist: { id: string; category: string; title: string; description: string; mandatory: boolean }[];
};
