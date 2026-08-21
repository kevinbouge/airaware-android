import { saveWidgetSnapshotToNative } from '../src/services/widgetNativeModule';
import type { WidgetSnapshot } from '../src/models/widgets';

const snapshot: WidgetSnapshot = {
  version: 1,
  generatedAt: '2026-08-01T12:00:00Z',
  entitlementKind: 'free',
  compactAvailable: true,
  advancedAvailable: false,
  forecastDayLimit: 3,
  activeLocationName: 'Current location',
  placeName: null,
  showPlaceName: true,
  stale: false,
  lastUpdatedAt: null,
  headlineScore: null,
  mainFactorLabel: null,
  uvCategoryLabel: null,
  bestOutdoorWindowLabel: null,
  forecastDays: [],
};

describe('widget native bridge', () => {
  it('is a safe no-op when the Android native module is unavailable', async () => {
    await expect(saveWidgetSnapshotToNative(snapshot)).resolves.toBe(false);
  });
});
