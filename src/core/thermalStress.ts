import type {
  HealthGeography,
  HealthSignal,
  HealthSignalObservation,
  ThermalStressCategory,
} from '../models/healthSignals';
import type { HourlyEnvironmentalReading, NormalizedEnvironment } from '../models/environment';
import {
  THERMAL_STRESS_FRESHNESS,
  calculateComparableTrend,
  calculateHealthSignalFreshness,
} from '../services/healthSignalFreshness';
import { isFiniteNumber } from '../utils/number';

const THERMAL_HISTORY_HOURS = 24;

type ThermalMetric = 'utci' | 'apparent-temperature';

interface UtciInputs {
  airTemperatureC: number | null | undefined;
  relativeHumidityPercent: number | null | undefined;
  windSpeed10mMs: number | null | undefined;
  meanRadiantTemperatureC: number | null | undefined;
}

export function apparentTemperatureThermalCategory(
  apparentTemperature: number | null | undefined,
): ThermalStressCategory | 'unknown' {
  if (!isFiniteNumber(apparentTemperature)) return 'unknown';
  if (apparentTemperature <= 0) return 'cold-strain';
  if (apparentTemperature >= 38) return 'very-high-heat-strain';
  if (apparentTemperature >= 32) return 'high-heat-strain';
  if (apparentTemperature >= 27) return 'moderate-heat-strain';
  return 'no-thermal-strain';
}

export function utciThermalStressCategory(
  utci: number | null | undefined,
): ThermalStressCategory | 'unknown' {
  if (!isFiniteNumber(utci)) return 'unknown';
  if (utci < -40) return 'extreme-cold-stress';
  if (utci < -27) return 'very-strong-cold-stress';
  if (utci < -13) return 'strong-cold-stress';
  if (utci < 0) return 'moderate-cold-stress';
  if (utci < 9) return 'slight-cold-stress';
  if (utci < 26) return 'no-thermal-stress';
  if (utci < 32) return 'moderate-heat-stress';
  if (utci < 38) return 'strong-heat-stress';
  if (utci < 46) return 'very-strong-heat-stress';
  return 'extreme-heat-stress';
}

function saturationVaporPressureHpa(temperatureC: number): number {
  const temperatureK = temperatureC + 273.15;
  const coefficients = [
    -2836.5744, -6028.076559, 19.54263612, -0.02737830188, 0.000016261698, 7.0229056e-10,
    -1.8680009e-13,
  ];
  const exponent =
    2.7150305 * Math.log1p(temperatureK) +
    coefficients.reduce(
      (sum, coefficient, index) => sum + coefficient * temperatureK ** (index - 2),
      0,
    );
  return Math.exp(exponent) * 0.01;
}

function waterVaporPressureKpa(airTemperatureC: number, relativeHumidityPercent: number): number {
  return (saturationVaporPressureHpa(airTemperatureC) * (relativeHumidityPercent / 100)) / 10;
}

function utciPolynomialCelsius(t2m: number, mrt: number, va: number, wvp: number): number {
  const eMrt = mrt - t2m;
  const t2m2 = t2m * t2m;
  const t2m3 = t2m2 * t2m;
  const t2m4 = t2m3 * t2m;
  const t2m5 = t2m4 * t2m;
  const t2m6 = t2m5 * t2m;
  const va2 = va * va;
  const va3 = va2 * va;
  const va4 = va3 * va;
  const va5 = va4 * va;
  const va6 = va5 * va;
  const eMrt2 = eMrt * eMrt;
  const eMrt3 = eMrt2 * eMrt;
  const eMrt4 = eMrt3 * eMrt;
  const eMrt5 = eMrt4 * eMrt;
  const eMrt6 = eMrt5 * eMrt;
  const wvp2 = wvp * wvp;
  const wvp3 = wvp2 * wvp;
  const wvp4 = wvp3 * wvp;
  const wvp5 = wvp4 * wvp;
  const wvp6 = wvp5 * wvp;
  const varh2 = va * wvp2;
  const va2Rh = va2 * wvp;
  const va2EMrt = va2 * eMrt;
  const eMrtRh = eMrt * wvp;
  const eMrtRh2 = eMrt * wvp2;
  const eMrt2Rh = eMrt2 * wvp;
  const eMrt2Rh2 = eMrt2 * wvp2;
  const eMrtRh3 = eMrt * wvp3;
  const vaEMrt = va * eMrt;
  const vaEMrt2 = va * eMrt2;
  const vaRh = va * wvp;
  const t2mVa = t2m * va;
  const eMrt3Rh = eMrt3 * wvp;
  const eMrt4Rh = eMrt4 * wvp;

  // Bröde et al. UTCI approximation polynomial, translated from ECMWF thermofeel.
  return (
    t2m +
    6.07562052e-1 +
    -2.27712343e-2 * t2m +
    8.06470249e-4 * t2m2 +
    -1.54271372e-4 * t2m3 +
    -3.24651735e-6 * t2m4 +
    7.32602852e-8 * t2m5 +
    1.35959073e-9 * t2m6 +
    -2.2583652 * va +
    8.80326035e-2 * t2m * va +
    2.16844454e-3 * t2m2 * va +
    -1.53347087e-5 * t2m3 * va +
    -5.72983704e-7 * t2m4 * va +
    -2.55090145e-9 * t2m5 * va +
    -7.51269505e-1 * va2 +
    -4.08350271e-3 * t2m * va2 +
    -5.21670675e-5 * t2m2 * va2 +
    1.94544667e-6 * t2m3 * va2 +
    1.14099531e-8 * t2m4 * va2 +
    1.58137256e-1 * va3 +
    -6.57263143e-5 * t2m * va3 +
    2.22697524e-7 * t2m2 * va3 +
    -4.16117031e-8 * t2m3 * va3 +
    -1.27762753e-2 * va4 +
    9.66891875e-6 * t2m * va4 +
    2.52785852e-9 * t2m2 * va4 +
    4.56306672e-4 * va5 +
    -1.74202546e-7 * t2m * va5 +
    -5.91491269e-6 * va6 +
    3.98374029e-1 * eMrt +
    1.83945314e-4 * t2m * eMrt +
    -1.7375451e-4 * t2m2 * eMrt +
    -7.60781159e-7 * t2m3 * eMrt +
    3.77830287e-8 * t2m4 * eMrt +
    5.43079673e-10 * t2m5 * eMrt +
    -2.00518269e-2 * vaEMrt +
    8.92859837e-4 * t2m * vaEMrt +
    3.45433048e-6 * t2m2 * vaEMrt +
    -3.77925774e-7 * t2m3 * vaEMrt +
    -1.69699377e-9 * t2m4 * vaEMrt +
    1.69992415e-4 * va2EMrt +
    -4.99204314e-5 * t2m * va2EMrt +
    2.47417178e-7 * t2m2 * va2EMrt +
    1.07596466e-8 * t2m3 * va2EMrt +
    8.49242932e-5 * va3 * eMrt +
    1.35191328e-6 * t2m * va3 * eMrt +
    -6.21531254e-9 * t2m2 * va3 * eMrt +
    -4.99410301e-6 * va4 * eMrt +
    -1.89489258e-8 * t2m * va4 * eMrt +
    8.15300114e-8 * va5 * eMrt +
    7.5504309e-4 * eMrt2 +
    -5.65095215e-5 * t2m * eMrt2 +
    -4.52166564e-7 * t2m2 * eMrt2 +
    2.46688878e-8 * t2m3 * eMrt2 +
    2.42674348e-10 * t2m4 * eMrt2 +
    1.5454725e-4 * vaEMrt2 +
    5.2411097e-6 * t2m * vaEMrt2 +
    -8.75874982e-8 * t2m2 * vaEMrt2 +
    -1.50743064e-9 * t2m3 * vaEMrt2 +
    -1.56236307e-5 * va2 * eMrt2 +
    -1.33895614e-7 * t2m * va2 * eMrt2 +
    2.49709824e-9 * t2m2 * va2 * eMrt2 +
    6.51711721e-7 * va3 * eMrt2 +
    1.94960053e-9 * t2m * va3 * eMrt2 +
    -1.00361113e-8 * va4 * eMrt2 +
    -1.21206673e-5 * eMrt3 +
    -2.1820366e-7 * t2m * eMrt3 +
    7.51269482e-9 * t2m2 * eMrt3 +
    9.79063848e-11 * t2m3 * eMrt3 +
    1.25006734e-6 * va * eMrt3 +
    -1.81584736e-9 * t2mVa * eMrt3 +
    -3.52197671e-10 * t2m2 * va * eMrt3 +
    -3.3651463e-8 * va2 * eMrt3 +
    1.35908359e-10 * t2m * va2 * eMrt3 +
    4.1703262e-10 * va3 * eMrt3 +
    -1.30369025e-9 * eMrt4 +
    4.13908461e-10 * t2m * eMrt4 +
    9.22652254e-12 * t2m2 * eMrt4 +
    -5.08220384e-9 * va * eMrt4 +
    -2.24730961e-11 * t2mVa * eMrt4 +
    1.17139133e-10 * va2 * eMrt4 +
    6.62154879e-10 * eMrt5 +
    4.0386326e-13 * t2m * eMrt5 +
    1.95087203e-12 * va * eMrt5 +
    -4.73602469e-12 * eMrt6 +
    5.12733497 * wvp +
    -3.12788561e-1 * t2m * wvp +
    -1.96701861e-2 * t2m2 * wvp +
    9.9969087e-4 * t2m3 * wvp +
    9.51738512e-6 * t2m4 * wvp +
    -4.66426341e-7 * t2m5 * wvp +
    5.48050612e-1 * vaRh +
    -3.30552823e-3 * t2m * vaRh +
    -1.6411944e-3 * t2m2 * vaRh +
    -5.16670694e-6 * t2m3 * vaRh +
    9.52692432e-7 * t2m4 * vaRh +
    -4.29223622e-2 * va2Rh +
    5.00845667e-3 * t2m * va2Rh +
    1.00601257e-6 * t2m2 * va2Rh +
    -1.81748644e-6 * t2m3 * va2Rh +
    -1.25813502e-3 * va3 * wvp +
    -1.79330391e-4 * t2m * va3 * wvp +
    2.34994441e-6 * t2m2 * va3 * wvp +
    1.29735808e-4 * va4 * wvp +
    1.2906487e-6 * t2m * va4 * wvp +
    -2.28558686e-6 * va5 * wvp +
    -3.69476348e-2 * eMrtRh +
    1.62325322e-3 * t2m * eMrtRh +
    -3.1427968e-5 * t2m2 * eMrtRh +
    2.59835559e-6 * t2m3 * eMrtRh +
    -4.77136523e-8 * t2m4 * eMrtRh +
    8.6420339e-3 * va * eMrtRh +
    -6.87405181e-4 * t2mVa * eMrtRh +
    -9.13863872e-6 * t2m2 * va * eMrtRh +
    5.15916806e-7 * t2m3 * va * eMrtRh +
    -3.59217476e-5 * va2 * eMrtRh +
    3.28696511e-5 * t2m * va2 * eMrtRh +
    -7.10542454e-7 * t2m2 * va2 * eMrtRh +
    -1.243823e-5 * va3 * eMrtRh +
    -7.385844e-9 * t2m * va3 * eMrtRh +
    2.20609296e-7 * va4 * eMrtRh +
    -7.3246918e-4 * eMrt2Rh +
    -1.87381964e-5 * t2m * eMrt2Rh +
    4.80925239e-6 * t2m2 * eMrt2Rh +
    -8.7549204e-8 * t2m3 * eMrt2Rh +
    2.7786293e-5 * va * eMrt2Rh +
    -5.06004592e-6 * t2mVa * eMrt2Rh +
    1.14325367e-7 * t2m2 * va * eMrt2Rh +
    2.53016723e-6 * va2 * eMrt2Rh +
    -1.72857035e-8 * t2m * va2 * eMrt2Rh +
    -3.95079398e-8 * va3 * eMrt2Rh +
    -3.59413173e-7 * eMrt3Rh +
    7.04388046e-7 * t2m * eMrt3Rh +
    -1.89309167e-8 * t2m2 * eMrt3Rh +
    -4.79768731e-7 * va * eMrt3Rh +
    7.96079978e-9 * t2mVa * eMrt3Rh +
    1.62897058e-9 * va2 * eMrt3Rh +
    3.94367674e-8 * eMrt4Rh +
    -1.18566247e-9 * t2m * eMrt4Rh +
    3.34678041e-10 * va * eMrt4Rh +
    -1.15606447e-10 * eMrt5 * wvp +
    -2.80626406 * wvp2 +
    5.48712484e-1 * t2m * wvp2 +
    -3.9942841e-3 * t2m2 * wvp2 +
    -9.54009191e-4 * t2m3 * wvp2 +
    1.93090978e-5 * t2m4 * wvp2 +
    -3.08806365e-1 * varh2 +
    1.16952364e-2 * t2m * varh2 +
    4.95271903e-4 * t2m2 * varh2 +
    -1.90710882e-5 * t2m3 * varh2 +
    2.10787756e-3 * va2 * wvp2 +
    -6.98445738e-4 * t2m * va2 * wvp2 +
    2.30109073e-5 * t2m2 * va2 * wvp2 +
    4.1785659e-4 * va3 * wvp2 +
    -1.27043871e-5 * t2m * va3 * wvp2 +
    -3.04620472e-6 * va4 * wvp2 +
    5.14507424e-2 * eMrtRh2 +
    -4.32510997e-3 * t2m * eMrtRh2 +
    8.99281156e-5 * t2m2 * eMrtRh2 +
    -7.14663943e-7 * t2m3 * eMrtRh2 +
    -2.66016305e-4 * va * eMrtRh2 +
    2.63789586e-4 * t2mVa * eMrtRh2 +
    -7.01199003e-6 * t2m2 * va * eMrtRh2 +
    -1.06823306e-4 * va2 * eMrtRh2 +
    3.61341136e-6 * t2m * va2 * eMrtRh2 +
    2.29748967e-7 * va3 * eMrtRh2 +
    3.04788893e-4 * eMrt2Rh2 +
    -6.42070836e-5 * t2m * eMrt2Rh2 +
    1.16257971e-6 * t2m2 * eMrt2Rh2 +
    7.68023384e-6 * va * eMrt2Rh2 +
    -5.47446896e-7 * t2mVa * eMrt2Rh2 +
    -3.5993791e-8 * va2 * eMrt2Rh2 +
    -4.36497725e-6 * eMrt3 * wvp2 +
    1.68737969e-7 * t2m * eMrt3 * wvp2 +
    2.67489271e-8 * va * eMrt3 * wvp2 +
    3.23926897e-9 * eMrt4 * wvp2 +
    -3.53874123e-2 * wvp3 +
    -2.2120119e-1 * t2m * wvp3 +
    1.55126038e-2 * t2m2 * wvp3 +
    -2.63917279e-4 * t2m3 * wvp3 +
    4.53433455e-2 * va * wvp3 +
    -4.32943862e-3 * t2mVa * wvp3 +
    1.45389826e-4 * t2m2 * va * wvp3 +
    2.1750861e-4 * va2 * wvp3 +
    -6.66724702e-5 * t2m * va2 * wvp3 +
    3.3321714e-5 * va3 * wvp3 +
    -2.26921615e-3 * eMrtRh3 +
    3.80261982e-4 * t2m * eMrtRh3 +
    -5.45314314e-9 * t2m2 * eMrtRh3 +
    -7.96355448e-4 * va * eMrtRh3 +
    2.53458034e-5 * t2mVa * eMrtRh3 +
    -6.31223658e-6 * va2 * eMrtRh3 +
    3.02122035e-4 * eMrt2 * wvp3 +
    -4.77403547e-6 * t2m * eMrt2 * wvp3 +
    1.73825715e-6 * va * eMrt2 * wvp3 +
    -4.09087898e-7 * eMrt3 * wvp3 +
    6.14155345e-1 * wvp4 +
    -6.16755931e-2 * t2m * wvp4 +
    1.33374846e-3 * t2m2 * wvp4 +
    3.55375387e-3 * va * wvp4 +
    -5.13027851e-4 * t2mVa * wvp4 +
    1.02449757e-4 * va2 * wvp4 +
    -1.48526421e-3 * eMrt * wvp4 +
    -4.11469183e-5 * t2m * eMrt * wvp4 +
    -6.80434415e-6 * va * eMrt * wvp4 +
    -9.77675906e-6 * eMrt2 * wvp4 +
    8.82773108e-2 * wvp5 +
    -3.01859306e-3 * t2m * wvp5 +
    1.04452989e-3 * va * wvp5 +
    2.47090539e-4 * eMrt * wvp5 +
    1.48348065e-3 * wvp6
  );
}

export function calculateUtci(input: UtciInputs): number | null {
  const { airTemperatureC, relativeHumidityPercent, windSpeed10mMs, meanRadiantTemperatureC } =
    input;
  if (
    !isFiniteNumber(airTemperatureC) ||
    !isFiniteNumber(relativeHumidityPercent) ||
    !isFiniteNumber(windSpeed10mMs) ||
    !isFiniteNumber(meanRadiantTemperatureC)
  ) {
    return null;
  }
  if (relativeHumidityPercent < 0 || relativeHumidityPercent > 100) return null;
  if (airTemperatureC < -50 || airTemperatureC > 50) return null;
  if (meanRadiantTemperatureC - airTemperatureC < -30) return null;
  if (meanRadiantTemperatureC - airTemperatureC > 70) return null;
  if (windSpeed10mMs < 0.5 || windSpeed10mMs > 17) return null;

  const vaporPressure = waterVaporPressureKpa(airTemperatureC, relativeHumidityPercent);
  if (!isFiniteNumber(vaporPressure) || vaporPressure < 0 || vaporPressure > 5) return null;

  const utci = utciPolynomialCelsius(
    airTemperatureC,
    meanRadiantTemperatureC,
    windSpeed10mMs,
    vaporPressure,
  );
  return isFiniteNumber(utci) ? Math.round(utci * 10) / 10 : null;
}

function thermalGeography(environment: NormalizedEnvironment): HealthGeography {
  return {
    level: 'local',
    code: `thermal:${environment.coordinates.latitude.toFixed(2)}:${environment.coordinates.longitude.toFixed(2)}`,
    name: environment.placeName ?? 'Active location',
    countryCode: undefined,
    countryName: undefined,
  };
}

function thermalMetricAt(reading: Pick<HourlyEnvironmentalReading, 'weather' | 'extended'>): {
  metric: ThermalMetric;
  value: number | null;
  measure: string;
  sourceMeasure: string;
  status: ThermalStressCategory | 'unknown';
} {
  const utci = calculateUtci({
    airTemperatureC: reading.weather.temperature,
    relativeHumidityPercent: reading.weather.relativeHumidity,
    windSpeed10mMs: reading.weather.windSpeed,
    meanRadiantTemperatureC: reading.extended?.weather.meanRadiantTemperature,
  });
  if (utci !== null) {
    return {
      metric: 'utci',
      value: utci,
      measure: 'Universal Thermal Climate Index',
      sourceMeasure: 'utci',
      status: utciThermalStressCategory(utci),
    };
  }

  const apparentTemperature = reading.extended?.weather.apparentTemperature ?? null;
  return {
    metric: 'apparent-temperature',
    value: apparentTemperature,
    measure: 'Open-Meteo apparent_temperature',
    sourceMeasure: 'apparent_temperature',
    status: apparentTemperatureThermalCategory(apparentTemperature),
  };
}

function thermalHistory(environment: NormalizedEnvironment): HealthSignalObservation[] {
  const currentTime = Date.parse(environment.current.timestamp ?? environment.fetchedAt);

  return environment.hourly
    .filter((hour) => {
      const time = Date.parse(hour.timestamp);
      return (
        Number.isFinite(time) &&
        (!Number.isFinite(currentTime) || time >= currentTime) &&
        isFiniteNumber(thermalMetricAt(hour).value)
      );
    })
    .slice(0, THERMAL_HISTORY_HOURS)
    .map((hour) => {
      const metric = thermalMetricAt(hour);
      return {
        observedAt: hour.timestamp,
        updatedAt: environment.fetchedAt,
        measure: metric.measure,
        value: metric.value as number,
        unit: '°C',
        source: {
          provider: 'Open-Meteo',
          dataset: 'Weather Forecast API',
          measure: metric.sourceMeasure,
        },
        status: metric.status,
      };
    });
}

function bestLowerStressWindow(history: HealthSignalObservation[]): string | undefined {
  const lowest = history
    .filter((observation) => isFiniteNumber(observation.value) && observation.observedAt)
    .sort((left, right) => left.value - right.value)[0];

  return lowest?.observedAt;
}

export function thermalStressSignalFromEnvironment(input: {
  environment: NormalizedEnvironment | null;
  now: string;
}): HealthSignal | null {
  const environment = input.environment;
  if (!environment) return null;

  const metric = thermalMetricAt(environment.current);
  if (!isFiniteNumber(metric.value)) return null;

  const geography = thermalGeography(environment);
  const history = thermalHistory(environment);
  const comparableFuture = history
    .filter((item) => item.source?.measure === metric.sourceMeasure)
    .slice(1, Math.min(4, history.length));
  const futureAverage =
    comparableFuture.length > 0
      ? comparableFuture.reduce((sum, item) => sum + item.value, 0) / comparableFuture.length
      : null;
  const trend = calculateComparableTrend({
    current: futureAverage,
    previous: metric.value,
    minimumAbsoluteChange: 2,
  });

  return {
    id: `${geography.code}:thermal-stress`,
    domain: 'environmental',
    type: 'thermal-stress',
    geography,
    observedAt: environment.current.timestamp ?? environment.fetchedAt,
    updatedAt: environment.fetchedAt,
    value: metric.value,
    unit: '°C',
    category: metric.status,
    trend,
    source: {
      provider: 'Open-Meteo',
      dataset: 'Weather Forecast API',
      measure: metric.sourceMeasure,
    },
    freshness: calculateHealthSignalFreshness({
      updatedAt: environment.fetchedAt,
      now: input.now,
      policy: THERMAL_STRESS_FRESHNESS,
    }),
    temporalClass: 'current',
    history,
    metadata: {
      metric: metric.metric,
      calculationMethod: metric.metric,
      utciAvailable: metric.metric === 'utci',
      utciUnavailableReason:
        metric.metric === 'utci' ? undefined : 'validated-mean-radiant-temperature-unavailable',
      bestLowerStressTime: bestLowerStressWindow(history),
    },
  };
}
