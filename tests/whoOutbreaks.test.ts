import {
  normalizeWhoOutbreakSignals,
  whoOutbreakProvider,
  whoOutbreaksUrl,
} from '../src/api/health/whoOutbreaks';
import { normalizeWhoRespiratorySignals } from '../src/api/health/whoRespiratory';
import { refreshHealthSignalsForLocation } from '../src/services/healthSignalService';
import type { LocationInfo } from '../src/models/environment';
import type { HealthGeography } from '../src/models/healthSignals';

const NOW = '2026-08-31T00:00:00Z';

const brazil: HealthGeography = {
  level: 'country',
  code: 'BR',
  name: 'Brazil',
  countryCode: 'BR',
  countryName: 'Brazil',
  providerCodes: { who: 'BRA' },
};

const kenya: HealthGeography = {
  level: 'country',
  code: 'KE',
  name: 'Kenya',
  countryCode: 'KE',
  countryName: 'Kenya',
  providerCodes: { who: 'KEN' },
};

function outbreakPayload(rows: Record<string, unknown>[]) {
  return { value: rows };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    Id: 'event-id',
    DonId: '2026-DON999',
    PublicationDateAndTime: '2026-08-28T12:00:00Z',
    LastModified: '2026-08-28T12:00:00Z',
    Title: 'Dengue - Brazil',
    ItemDefaultUrl: '/2026-DON999',
    Summary: 'Reported outbreak activity in Brazil.',
    ...overrides,
  };
}

describe('WHO Disease Outbreak News provider', () => {
  it('builds the documented public Disease Outbreak News endpoint URL', () => {
    expect(whoOutbreaksUrl()).toContain('/api/emergencies/diseaseoutbreaknews');
    expect(whoOutbreaksUrl()).toContain('%24orderby=PublicationDateAndTime+desc');
    expect(whoOutbreakProvider).toMatchObject({
      id: 'who-outbreaks',
      access: 'anonymous',
      coverage: 'global',
    });
  });

  it('normalizes geographically relevant country events without personal-risk semantics', () => {
    const signals = normalizeWhoOutbreakSignals({
      payload: outbreakPayload([event()]),
      geography: brazil,
      now: NOW,
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      domain: 'biological',
      type: 'outbreak-event',
      geography: { level: 'country', code: 'BR', countryCode: 'BR' },
      updatedAt: '2026-08-28T12:00:00Z',
      temporalClass: 'current',
      freshness: { status: 'fresh' },
      source: {
        provider: 'WHO Disease Outbreak News',
        dataset: 'diseaseoutbreaknews',
      },
      metadata: expect.objectContaining({
        eventId: '2026-DON999',
        disease: 'Dengue',
        title: 'Dengue - Brazil',
        sourceUrl: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON999',
        noPersonalRiskInference: true,
      }),
    });
  });

  it('matches explicit regional geography without relabeling it as local GPS context', () => {
    const region: HealthGeography = { level: 'region', code: 'AFRO', name: 'African Region' };
    const signals = normalizeWhoOutbreakSignals({
      payload: outbreakPayload([
        event({
          Title: 'Disease event - African Region',
          Summary: 'A regional public-health event in the African Region.',
        }),
      ]),
      geography: region,
      now: NOW,
    });

    expect(signals[0]).toMatchObject({
      geography: { level: 'region', code: 'AFRO', name: 'African Region' },
      temporalClass: 'current',
    });
  });

  it('excludes irrelevant geography and returns an explicit unavailable signal', () => {
    const signals = normalizeWhoOutbreakSignals({
      payload: outbreakPayload([
        event({
          Summary:
            'WHO assesses the risk at the global level as low while the reported event remains in Brazil.',
        }),
      ]),
      geography: kenya,
      now: NOW,
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      type: 'outbreak-event',
      category: 'unknown',
      temporalClass: 'current',
      metadata: expect.objectContaining({
        unavailable: true,
        reason: 'no-relevant-who-outbreak-events',
        semantics: 'Missing outbreak events are not interpreted as no disease activity.',
      }),
    });
  });

  it('handles missing disease labels safely and deduplicates duplicate events', () => {
    const signals = normalizeWhoOutbreakSignals({
      payload: outbreakPayload([
        event({ Title: 'Public health event Brazil' }),
        event({ Title: 'Public health event Brazil' }),
      ]),
      geography: brazil,
      now: NOW,
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]?.metadata?.disease).toBeUndefined();
    expect(signals[0]?.metadata?.title).toBe('Public health event Brazil');
  });

  it('isolates outbreak provider failures from respiratory results', async () => {
    const location: LocationInfo = {
      activeLocationId: 'manual-br',
      activeLocationName: 'Rio de Janeiro',
      coordinates: { latitude: -22.9068, longitude: -43.1729 },
      placeName: 'Rio de Janeiro',
      mode: 'manual',
      permissionStatus: 'unknown',
      countryCode: 'BR',
      countryName: 'Brazil',
    };
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: string | URL) => {
      const text = url.toString();
      if (text.includes('diseaseoutbreaknews')) {
        throw new Error('WHO outbreak unavailable');
      }
      if (text.includes('FLUMART')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            value: [
              {
                COUNTRY_CODE: 'BRA',
                COUNTRY_AREA_TERRITORY: 'Brazil',
                ISO_WEEKSTARTDATE: '2026-08-17',
                ISO_YEAR: 2026,
                ISO_WEEK: 34,
                SPEC_PROCESSED_NB: 100,
                INF_ALL: 12,
                RSV_PROCESSED: 100,
                RSV: 8,
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ value: [] }),
        text: async () => '',
      };
    }) as unknown as typeof fetch;

    try {
      const state = await refreshHealthSignalsForLocation({
        location,
        environment: null,
        force: true,
        now: NOW,
      });

      expect(state.signals.some((signal) => signal.type === 'influenza')).toBe(true);
      expect(state.signals.find((signal) => signal.type === 'outbreak-event')).toMatchObject({
        metadata: expect.objectContaining({ providerStatus: 'provider-error' }),
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('does not synthesize missing respiratory rows as low activity', () => {
    const signals = normalizeWhoRespiratorySignals({ value: [] }, { geography: brazil, now: NOW });

    expect(signals.map((signal) => signal.type)).toEqual(['influenza', 'covid-19', 'rsv']);
    signals.forEach((signal) => {
      expect(signal.category).toBe('unknown');
      expect(signal.category).not.toBe('low');
      expect(signal.metadata?.unavailable).toBe(true);
    });
  });
});
