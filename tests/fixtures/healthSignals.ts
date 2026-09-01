import type { HealthSignal } from '../../src/models/healthSignals';

export function createHealthSignal(overrides: Partial<HealthSignal> = {}): HealthSignal {
  return {
    id: 'signal',
    domain: 'biological',
    type: 'influenza',
    geography: { level: 'country', code: 'CZ', name: 'Czech Republic', countryCode: 'CZ' },
    updatedAt: '2026-08-25T00:00:00Z',
    value: 4.2,
    unit: '%',
    category: 'unknown',
    trend: 'unknown',
    source: { provider: 'WHO GISRS / FluNet' },
    freshness: { status: 'fresh' },
    ...overrides,
  };
}
