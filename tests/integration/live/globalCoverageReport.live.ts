/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cdcWastewaterProvider } from '../../../src/api/health/cdcWastewater';
import { ecdcDengueProvider } from '../../../src/api/health/ecdcDengue';
import { eurostatExcessMortalityProvider } from '../../../src/api/health/eurostatExcessMortality';
import { owidExcessMortalityProvider } from '../../../src/api/health/owidExcessMortality';
import { phacWastewaterProvider } from '../../../src/api/health/phacWastewater';
import { rivmWastewaterProvider } from '../../../src/api/health/rivmWastewater';
import { safecastRadiologicalProvider } from '../../../src/api/health/safecastRadiological';
import { sumeauWastewaterProvider } from '../../../src/api/health/sumeauWastewater';
import { whoRespiratoryProvider } from '../../../src/api/health/whoRespiratory';
import { whoVectorDiseaseProvider } from '../../../src/api/health/whoVectorDisease';
import { buildAirQualityUrl, normalizeAirQuality } from '../../../src/api/openMeteoAirQuality';
import { buildWeatherUrl, normalizeWeather } from '../../../src/api/openMeteoWeather';
import { assembleEnvironment } from '../../../src/services/environmentAssembler';
import { resolveHealthGeography } from '../../../src/services/healthGeography';
import {
  environmentalCoverageResults,
  healthSignalCoverageResult,
} from '../../coverage/coverageAssertions';
import type { CoverageResult, GlobalCoverageReport } from '../../coverage/coverageTypes';
import {
  coverageReportToJson,
  coverageReportToMarkdown,
  summarizeCoverageResults,
} from '../../coverage/coverageReport';
import {
  GLOBAL_TEST_LOCATIONS,
  locationInfoFromGlobalLocation,
} from '../../coverage/globalLocations';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENCY = 3;
const REPORT_DIR = path.join(process.cwd(), 'coverage');
const execFileAsync = promisify(execFile);

interface LiveResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function acceptHeaderFrom(init: RequestInit | undefined): string {
  const headers = init?.headers;
  if (headers instanceof Headers) return headers.get('Accept') ?? 'application/json';
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === 'accept')?.[1] ?? 'application/json';
  }
  if (headers && typeof headers === 'object') {
    const record = headers as Record<string, string>;
    return record.Accept ?? record.accept ?? 'application/json';
  }
  return 'application/json';
}

async function liveFetch(url: string | URL, init?: RequestInit): Promise<LiveResponse> {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '--silent',
      '--show-error',
      '--fail',
      '--compressed',
      '--max-time',
      String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
      '--header',
      `Accept: ${acceptHeaderFrom(init)}`,
      url.toString(),
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );

  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(stdout),
    text: async () => stdout,
  };
}

function providerError(input: {
  provider: string;
  locationId: string;
  domain: CoverageResult['domain'];
  signal: string;
  expectation: CoverageResult['expectation'];
  error: unknown;
}): CoverageResult {
  let notes = 'Unknown provider error';
  if (input.error instanceof Error) {
    notes = input.error.message;
  } else if (input.error !== undefined) {
    notes = String(input.error);
  }

  return {
    locationId: input.locationId,
    domain: input.domain,
    signal: input.signal,
    expectation: input.expectation,
    status: 'provider-error',
    provider: input.provider,
    notes,
  };
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const response = await liveFetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function environmentalLiveResults(location: (typeof GLOBAL_TEST_LOCATIONS)[number]) {
  try {
    const coordinates = { latitude: location.latitude, longitude: location.longitude };
    const [airQualityPayload, weatherPayload] = await Promise.all([
      fetchJsonWithTimeout(buildAirQualityUrl(coordinates)),
      fetchJsonWithTimeout(buildWeatherUrl(coordinates)),
    ]);
    const environment = assembleEnvironment({
      coordinates,
      placeName: location.name,
      airQuality: normalizeAirQuality(
        airQualityPayload as Parameters<typeof normalizeAirQuality>[0],
      ),
      weather: normalizeWeather(weatherPayload as Parameters<typeof normalizeWeather>[0]),
    });

    return environmentalCoverageResults({ location, environment });
  } catch (error) {
    return [
      providerError({
        provider: 'Open-Meteo',
        locationId: location.id,
        domain: 'environmental',
        signal: 'core-environmental',
        expectation: 'required',
        error,
      }),
    ] satisfies CoverageResult[];
  }
}

function unsupportedProviderResult(providerId: string, locationId: string): CoverageResult {
  if (providerId === 'eurostat-excess-mortality' || providerId === 'owid-excess-mortality') {
    return {
      locationId,
      domain: 'population-health',
      signal: 'excess-mortality',
      expectation: 'unsupported',
      status: 'unsupported',
      provider: providerId,
    };
  }

  if (providerId === 'ecdc-dengue') {
    return {
      locationId,
      domain: 'biological',
      signal: 'dengue',
      expectation: 'unsupported',
      status: 'unsupported',
      provider: providerId,
    };
  }

  if (
    providerId === 'cdc-wastewater' ||
    providerId === 'phac-wastewater' ||
    providerId === 'sumeau-wastewater' ||
    providerId === 'rivm-wastewater'
  ) {
    return {
      locationId,
      domain: 'biological',
      signal: 'wastewater',
      expectation: 'unsupported',
      status: 'unsupported',
      provider: providerId,
    };
  }

  return {
    locationId,
    domain: 'biological',
    signal: 'provider',
    expectation: 'unsupported',
    status: 'unsupported',
    provider: providerId,
  };
}

function providerDomain(providerId: string): CoverageResult['domain'] {
  if (providerId === 'safecast-radiological') return 'radiological';
  if (providerId === 'eurostat-excess-mortality' || providerId === 'owid-excess-mortality') {
    return 'population-health';
  }
  return 'biological';
}

function providerExpectation(providerId: string): CoverageResult['expectation'] {
  return providerId === 'who-respiratory' || providerId === 'owid-excess-mortality'
    ? 'expected'
    : 'optional';
}

async function healthProviderLiveResults(location: (typeof GLOBAL_TEST_LOCATIONS)[number]) {
  const locationInfo = locationInfoFromGlobalLocation(location);
  const geography = resolveHealthGeography({ location: locationInfo });
  const coordinates = { latitude: location.latitude, longitude: location.longitude };
  const now = new Date().toISOString();
  const context = { geography, coordinates, locationName: location.name, now };
  const results: CoverageResult[] = [];
  const providers = [
    whoRespiratoryProvider,
    cdcWastewaterProvider,
    phacWastewaterProvider,
    sumeauWastewaterProvider,
    rivmWastewaterProvider,
    ecdcDengueProvider,
    whoVectorDiseaseProvider,
    eurostatExcessMortalityProvider,
    owidExcessMortalityProvider,
    safecastRadiologicalProvider,
  ];

  for (const provider of providers) {
    if (!provider.supports(context)) {
      results.push(unsupportedProviderResult(provider.id, location.id));
      continue;
    }

    try {
      const result = await provider.fetchSignals(context);
      result.signals.forEach((signal) => {
        results.push(
          healthSignalCoverageResult({
            location,
            signal,
            domain: signal.domain === 'radiological' ? 'radiological' : signal.domain,
            signalName: signal.type,
          }),
        );
      });
    } catch (error) {
      results.push(
        providerError({
          provider: provider.id,
          locationId: location.id,
          domain: providerDomain(provider.id),
          signal: provider.id,
          expectation: providerExpectation(provider.id),
          error,
        }),
      );
    }
  }

  return results;
}

describe('live global coverage report', () => {
  jest.setTimeout(180_000);

  beforeAll(() => {
    global.fetch = liveFetch as unknown as typeof fetch;
  });

  it('generates live global coverage reports without gating optional gaps', async () => {
    const perLocation = await mapWithConcurrency(GLOBAL_TEST_LOCATIONS, async (location) => {
      const [environmental, health] = await Promise.all([
        environmentalLiveResults(location),
        healthProviderLiveResults(location),
      ]);
      return [...environmental, ...health];
    });
    const report: GlobalCoverageReport = {
      generatedAt: new Date().toISOString(),
      locations: [...GLOBAL_TEST_LOCATIONS],
      results: perLocation.flat(),
    };
    const summary = summarizeCoverageResults(report.results);

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, 'global-coverage-report.json'),
      coverageReportToJson(report),
    );
    fs.writeFileSync(
      path.join(REPORT_DIR, 'global-coverage-report.md'),
      coverageReportToMarkdown(report),
    );

    process.stdout.write(`${coverageReportToMarkdown(report)}\n`);
    expect(summary.requiredFail).toBe(0);
  });
});
