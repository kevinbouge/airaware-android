import {
  RESPIRATORY_SURVEILLANCE_FRESHNESS,
  calculateHealthSignalFreshness,
  healthSignalTemporalClass,
  isCurrentContextEligible,
  resolveBestHealthSignalCandidate,
} from '../src/services/healthSignalFreshness';
import {
  backgroundPublicHealthContextRows,
  currentPublicHealthContextRows,
} from '../src/core/healthSignalPresentation';
import { createHealthSignal } from './fixtures/healthSignals';

const NOW = '2026-08-31T00:00:00Z';

describe('health signal temporal classification and current eligibility', () => {
  it('classifies current-capable and background-only signals explicitly', () => {
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'influenza' }))).toBe('current');
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'wastewater-covid-19' }))).toBe(
      'current',
    );
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'outbreak-event' }))).toBe(
      'current',
    );
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'chikungunya' }))).toBe('current');
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'ambient-dose-rate' }))).toBe(
      'current',
    );
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'excess-mortality' }))).toBe(
      'background',
    );
    expect(healthSignalTemporalClass(createHealthSignal({ type: 'malaria' }))).toBe('background');
  });

  it('uses weekly respiratory freshness boundaries for current eligibility', () => {
    expect(
      calculateHealthSignalFreshness({
        updatedAt: '2026-08-21T00:00:00Z',
        now: NOW,
        policy: RESPIRATORY_SURVEILLANCE_FRESHNESS,
      }).status,
    ).toBe('fresh');
    expect(
      calculateHealthSignalFreshness({
        updatedAt: '2026-08-20T23:59:59Z',
        now: NOW,
        policy: RESPIRATORY_SURVEILLANCE_FRESHNESS,
      }).status,
    ).toBe('aging');
    expect(
      calculateHealthSignalFreshness({
        updatedAt: '2026-08-10T00:00:00Z',
        now: NOW,
        policy: RESPIRATORY_SURVEILLANCE_FRESHNESS,
      }).status,
    ).toBe('aging');
    expect(
      calculateHealthSignalFreshness({
        updatedAt: '2026-08-09T23:59:59Z',
        now: NOW,
        policy: RESPIRATORY_SURVEILLANCE_FRESHNESS,
      }).status,
    ).toBe('stale');
  });

  it('excludes stale and background signals from current context rows while retaining background rows', () => {
    const freshInfluenza = createHealthSignal({
      id: 'influenza:fresh',
      type: 'influenza',
      freshness: { status: 'fresh' },
      temporalClass: 'current',
    });
    const staleRsv = createHealthSignal({
      id: 'rsv:stale',
      type: 'rsv',
      freshness: { status: 'stale' },
      temporalClass: 'current',
    });
    const mortality = createHealthSignal({
      id: 'mortality:background',
      domain: 'population-health',
      type: 'excess-mortality',
      temporalClass: 'background',
    });

    expect(isCurrentContextEligible(freshInfluenza)).toBe(true);
    expect(isCurrentContextEligible(staleRsv)).toBe(false);
    expect(isCurrentContextEligible(mortality)).toBe(false);
    expect(
      currentPublicHealthContextRows([freshInfluenza, staleRsv, mortality]).map(
        (row) => row.signal.id,
      ),
    ).toEqual(['influenza:fresh']);
    expect(
      backgroundPublicHealthContextRows([freshInfluenza, staleRsv, mortality]).map(
        (row) => row.signal.id,
      ),
    ).toEqual(['mortality:background']);
  });
});

describe('health provider arbitration', () => {
  it('prefers a fresher regional observation over a stale global observation', () => {
    const regional = createHealthSignal({
      id: 'regional',
      geography: { level: 'subregion', name: 'Metro Vancouver', countryCode: 'CA' },
      source: { provider: 'PHAC' },
      freshness: { status: 'fresh' },
    });
    const global = createHealthSignal({
      id: 'global',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'stale' },
    });

    expect(resolveBestHealthSignalCandidate([global, regional])?.id).toBe('regional');
  });

  it('prefers a fresh global observation over an aging regional observation', () => {
    const regional = createHealthSignal({
      id: 'regional',
      geography: { level: 'subregion', name: 'Metro Vancouver', countryCode: 'CA' },
      source: { provider: 'PHAC' },
      freshness: { status: 'aging' },
    });
    const global = createHealthSignal({
      id: 'global',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'fresh' },
    });

    expect(resolveBestHealthSignalCandidate([regional, global])?.id).toBe('global');
  });

  it('prefers a fresh regional observation over a fresh global observation', () => {
    const regional = createHealthSignal({
      id: 'regional',
      geography: { level: 'subregion', name: 'Metro Vancouver', countryCode: 'CA' },
      source: { provider: 'PHAC' },
      freshness: { status: 'fresh' },
    });
    const global = createHealthSignal({
      id: 'global',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'fresh' },
    });

    expect(resolveBestHealthSignalCandidate([global, regional])?.id).toBe('regional');
  });

  it('falls back to global observations when no supported regional candidate exists', () => {
    const global = createHealthSignal({
      id: 'global',
      source: { provider: 'WHO GISRS / FluNet' },
      freshness: { status: 'fresh' },
    });

    expect(resolveBestHealthSignalCandidate([global])?.id).toBe('global');
    expect(resolveBestHealthSignalCandidate([])).toBeNull();
  });
});
