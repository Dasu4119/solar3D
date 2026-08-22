export interface SiteWeatherResult {
  provider: "open-meteo-era5";
  sourceId: string;
  latitude: number;
  longitude: number;
  periodStart: string;
  periodEnd: string;
  years: number;
  annualIrradianceKwhM2: number;
  retrievedAt: string;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function completedWeatherPeriod(reference = new Date()): { start: string; end: string; years: number } {
  const endYear = reference.getUTCFullYear() - 1;
  const startYear = endYear - 4;
  return {
    start: `${startYear}-01-01`,
    end: `${endYear}-12-31`,
    years: 5,
  };
}

export async function fetchSiteWeather(latitude: number, longitude: number, fetchImpl: typeof fetch = fetch): Promise<SiteWeatherResult> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("latitude must be between -90 and 90");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("longitude must be between -180 and 180");

  const period = completedWeatherPeriod();
  const url = new URL("https://archive-api.open-meteo.com/v1/era5");
  url.searchParams.set("latitude", latitude.toFixed(6));
  url.searchParams.set("longitude", longitude.toFixed(6));
  url.searchParams.set("start_date", period.start);
  url.searchParams.set("end_date", period.end);
  url.searchParams.set("daily", "shortwave_radiation_sum");
  url.searchParams.set("timezone", "UTC");

  const response = await fetchImpl(url.toString());
  if (!response.ok) throw new Error(`Site weather provider returned HTTP ${response.status}`);
  const payload = await response.json();
  const values = Array.isArray(payload?.daily?.shortwave_radiation_sum)
    ? payload.daily.shortwave_radiation_sum.filter((value: unknown): value is number => Number.isFinite(Number(value))).map(Number)
    : [];
  if (!values.length) throw new Error("Site weather provider returned no solar-radiation observations");

  const annualIrradianceKwhM2 = values.reduce((sum, value) => sum + value, 0) / period.years;
  if (!Number.isFinite(annualIrradianceKwhM2) || annualIrradianceKwhM2 <= 0) {
    throw new Error("Site weather provider returned an invalid annual irradiance value");
  }

  return {
    provider: "open-meteo-era5",
    sourceId: `era5:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${period.start}:${period.end}`,
    latitude,
    longitude,
    periodStart: period.start,
    periodEnd: period.end,
    years: period.years,
    annualIrradianceKwhM2: Number(annualIrradianceKwhM2.toFixed(1)),
    retrievedAt: isoDate(new Date()),
  };
}
