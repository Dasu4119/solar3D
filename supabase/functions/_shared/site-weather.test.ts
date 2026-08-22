import { describe, expect, it } from "vitest";
import { completedWeatherPeriod, fetchSiteWeather } from "./site-weather";

describe("site weather adapter", () => {
  it("uses five completed calendar years", () => {
    expect(completedWeatherPeriod(new Date("2026-08-22T00:00:00Z"))).toEqual({
      start: "2021-01-01",
      end: "2025-12-31",
      years: 5,
    });
  });

  it("converts ERA5 daily shortwave radiation to annual irradiance", async () => {
    const response = new Response(JSON.stringify({
      daily: {
        shortwave_radiation_sum: Array.from({ length: 5 }, () => 1000),
      },
    }), { status: 200 });
    const result = await fetchSiteWeather(16.3067, 80.4365, async () => response);
    expect(result.provider).toBe("open-meteo-era5");
    expect(result.annualIrradianceKwhM2).toBe(1000);
    expect(result.periodStart).toBe("2021-01-01");
    expect(result.periodEnd).toBe("2025-12-31");
  });

  it("rejects invalid coordinates", async () => {
    await expect(fetchSiteWeather(91, 80, async () => new Response("{}"))).rejects.toThrow("latitude");
    await expect(fetchSiteWeather(16, 181, async () => new Response("{}"))).rejects.toThrow("longitude");
  });

  it("rejects provider responses without observations", async () => {
    await expect(fetchSiteWeather(16, 80, async () => new Response(JSON.stringify({ daily: {} }), { status: 200 })))
      .rejects.toThrow("no solar-radiation observations");
  });
});
