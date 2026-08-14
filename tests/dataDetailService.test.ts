import {
  dataDetailCacheKey,
  dataDetailHistoryDatesForNow,
  dataDetailLocalDateKey,
} from '../src/services/dataDetailService';

const coordinates = { latitude: 50.0755, longitude: 14.4378 };

describe('data detail service request windows', () => {
  it('uses the provider-local date for cache keys around positive UTC offsets', () => {
    expect(dataDetailLocalDateKey('2026-08-11T00:30:00+02:00')).toBe('2026-08-11');
    expect(
      dataDetailCacheKey({
        coordinates,
        variableId: 'pm25',
        rangeId: '24h',
        now: '2026-08-11T00:30:00+02:00',
      }),
    ).toBe('50.07550,14.43780:pm25:24h:2026-08-11');
    expect(
      dataDetailCacheKey({
        coordinates: { latitude: 50.07551, longitude: 14.43781 },
        variableId: 'pm25',
        rangeId: '24h',
        now: '2026-08-11T00:30:00+02:00',
      }),
    ).not.toBe(
      dataDetailCacheKey({
        coordinates: { latitude: 50.07559, longitude: 14.43789 },
        variableId: 'pm25',
        rangeId: '24h',
        now: '2026-08-11T00:30:00+02:00',
      }),
    );
  });

  it('uses the provider-local date for cache keys around negative UTC offsets', () => {
    expect(dataDetailLocalDateKey('2026-08-10T23:30:00-07:00')).toBe('2026-08-10');
  });

  it('builds Open-Meteo history date ranges in the provider-local calendar', () => {
    expect(dataDetailHistoryDatesForNow('2026-08-11T00:30:00+02:00', 12)).toEqual({
      startDate: '2026-08-09',
      endDate: '2026-08-11',
    });
  });
});
