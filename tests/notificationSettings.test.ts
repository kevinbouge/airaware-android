import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_ENTITLEMENT, PRO_LIFETIME_ENTITLEMENT } from '../src/capabilities/entitlements';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../src/models/profile';

/* eslint-disable import/first */
jest.mock('../src/services/notificationService', () => ({
  deliverRiskTransitionNotification: jest.fn().mockResolvedValue(true),
  deliverRiskTestNotification: jest.fn().mockResolvedValue(true),
  getRiskNotificationPermissionStatus: jest.fn().mockResolvedValue('granted'),
  openSystemNotificationSettings: jest.fn().mockResolvedValue(true),
  requestRiskNotificationPermission: jest.fn(),
}));

import {
  deliverRiskTestNotification,
  getRiskNotificationPermissionStatus,
  openSystemNotificationSettings,
  requestRiskNotificationPermission,
} from '../src/services/notificationService';
import { loadSettings } from '../src/storage/storage';
import { flushPendingSettingsSave, useAppStore } from '../src/state/useAppStore';

describe('notification settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAppStore.setState({
      hydrated: false,
      loading: false,
      sharing: false,
      stale: false,
      error: null,
      shareMessage: null,
      notificationMessage: null,
      notificationPermissionStatus: 'unknown',
      settings: DEFAULT_SETTINGS,
      profile: DEFAULT_PROFILE,
      entitlement: FREE_ENTITLEMENT,
      environment: null,
      riskNotificationTransitionState: null,
      environmentalEvents: [],
      environmentalEventNotificationState: null,
    });
    jest.clearAllMocks();
  });

  it('does not request notification permission during hydration', async () => {
    await useAppStore.getState().hydrate();

    expect(requestRiskNotificationPermission).not.toHaveBeenCalled();
  });

  it('requests notification permission only when transition notifications are enabled', async () => {
    jest.mocked(requestRiskNotificationPermission).mockResolvedValue('granted');

    await useAppStore.getState().updateSettings({ riskTransitionNotificationsEnabled: true });

    expect(requestRiskNotificationPermission).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().settings.riskTransitionNotificationsEnabled).toBe(true);
  });

  it('keeps transition notifications disabled when permission is denied', async () => {
    jest.mocked(requestRiskNotificationPermission).mockResolvedValue('denied');

    await useAppStore.getState().updateSettings({ riskTransitionNotificationsEnabled: true });

    expect(useAppStore.getState().settings.riskTransitionNotificationsEnabled).toBe(false);
    expect(useAppStore.getState().notificationPermissionStatus).toBe('denied');
    expect(useAppStore.getState().notificationMessage).toContain('denied');
  });

  it('does not repeatedly request runtime permission after denial', async () => {
    useAppStore.setState({ notificationPermissionStatus: 'denied' });
    jest.mocked(getRiskNotificationPermissionStatus).mockResolvedValue('denied');

    await useAppStore.getState().updateSettings({ riskTransitionNotificationsEnabled: true });

    expect(requestRiskNotificationPermission).not.toHaveBeenCalled();
    expect(getRiskNotificationPermissionStatus).toHaveBeenCalled();
    expect(useAppStore.getState().settings.riskTransitionNotificationsEnabled).toBe(false);
    expect(useAppStore.getState().notificationMessage).toContain('Open Android settings');
  });

  it('opens Android notification settings when requested', async () => {
    await useAppStore.getState().openNotificationSettings();

    expect(openSystemNotificationSettings).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().notificationMessage).toContain('opened');
  });

  it('sends a test notification only when permission is granted', async () => {
    jest.mocked(getRiskNotificationPermissionStatus).mockResolvedValue('granted');

    await useAppStore.getState().sendTestRiskNotification();

    expect(deliverRiskTestNotification).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().notificationMessage).toBe('Test notification sent.');
  });

  it('does not mutate transition state when sending a test notification', async () => {
    const transitionState = {
      version: 1 as const,
      previousCategory: 'moderate' as const,
      previousScoreType: 'environmental' as const,
      locationKey: '50.076,14.438',
      profileFingerprint: null,
      lastObservationKey: 'observation-1',
      lastDeliveredObservationKey: null,
      evaluatedAt: '2026-08-01T12:00:00Z',
    };
    useAppStore.setState({ riskNotificationTransitionState: transitionState });
    jest.mocked(getRiskNotificationPermissionStatus).mockResolvedValue('granted');

    await useAppStore.getState().sendTestRiskNotification();

    expect(useAppStore.getState().riskNotificationTransitionState).toBe(transitionState);
  });

  it('flushes pending settings saves before the app can be suspended', async () => {
    await useAppStore.getState().updateSettings({ summaryLocation: 'hidden' });
    await flushPendingSettingsSave();

    await expect(loadSettings()).resolves.toEqual(
      expect.objectContaining({ summaryLocation: 'hidden' }),
    );
  });

  it('surfaces a recoverable error when settings cannot be persisted', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setItemMock = jest.mocked(AsyncStorage.setItem);
    const originalSetItem = setItemMock.getMockImplementation();
    setItemMock.mockImplementation((key, value) => {
      if (key === 'airaware.settings.v1') {
        return Promise.reject(new Error('storage full'));
      }

      return originalSetItem?.(key, value) ?? Promise.resolve();
    });

    try {
      await useAppStore.getState().updateSettings({ summaryLocation: 'hidden' });
      await flushPendingSettingsSave();
    } finally {
      if (originalSetItem) {
        setItemMock.mockImplementation(originalSetItem);
      }
      warnSpy.mockRestore();
    }

    expect(useAppStore.getState().settings.summaryLocation).toBe('hidden');
    expect(useAppStore.getState().error).toContain('could not save');
  });

  it('preserves concurrent settings changes while notification permission is pending', async () => {
    let nestedSettingsUpdate: Promise<void> | null = null;
    jest.mocked(requestRiskNotificationPermission).mockImplementation(async () => {
      nestedSettingsUpdate = useAppStore.getState().updateSettings({ summaryLocation: 'hidden' });
      return 'granted';
    });

    await useAppStore.getState().updateSettings({ riskTransitionNotificationsEnabled: true });
    await nestedSettingsUpdate;

    expect(useAppStore.getState().settings.riskTransitionNotificationsEnabled).toBe(true);
    expect(useAppStore.getState().settings.summaryLocation).toBe('hidden');
  });

  it('keeps environmental event notifications disabled for Free users', async () => {
    await useAppStore.getState().updateSettings({
      environmentalEventNotifications: {
        ...DEFAULT_SETTINGS.environmentalEventNotifications,
        saharanDust: true,
      },
    });

    expect(requestRiskNotificationPermission).not.toHaveBeenCalled();
    expect(useAppStore.getState().settings.environmentalEventNotifications.saharanDust).toBe(false);
    expect(useAppStore.getState().notificationMessage).toContain('AirAware Pro');
  });

  it('requests permission when Pro users enable environmental event notifications', async () => {
    useAppStore.setState({ entitlement: PRO_LIFETIME_ENTITLEMENT });
    jest.mocked(requestRiskNotificationPermission).mockResolvedValue('granted');

    await useAppStore.getState().updateSettings({
      environmentalEventNotifications: {
        ...DEFAULT_SETTINGS.environmentalEventNotifications,
        pollen: true,
      },
    });

    expect(requestRiskNotificationPermission).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().settings.environmentalEventNotifications.pollen).toBe(true);
  });

  it('disables environmental event notifications when permission is denied', async () => {
    useAppStore.setState({ entitlement: PRO_LIFETIME_ENTITLEMENT });
    jest.mocked(requestRiskNotificationPermission).mockResolvedValue('denied');

    await useAppStore.getState().updateSettings({
      environmentalEventNotifications: {
        ...DEFAULT_SETTINGS.environmentalEventNotifications,
        wildfirePollution: true,
      },
    });

    expect(useAppStore.getState().settings.environmentalEventNotifications.wildfirePollution).toBe(
      false,
    );
    expect(useAppStore.getState().notificationMessage).toContain('denied');
  });

  it('does not turn off risk notifications when an event-alert permission request is denied', async () => {
    useAppStore.setState({
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      settings: {
        ...DEFAULT_SETTINGS,
        riskTransitionNotificationsEnabled: true,
      },
    });
    jest.mocked(requestRiskNotificationPermission).mockResolvedValue('denied');

    await useAppStore.getState().updateSettings({
      environmentalEventNotifications: {
        ...DEFAULT_SETTINGS.environmentalEventNotifications,
        pollen: true,
      },
    });

    expect(useAppStore.getState().settings.riskTransitionNotificationsEnabled).toBe(true);
    expect(useAppStore.getState().settings.environmentalEventNotifications.pollen).toBe(false);
  });

  it('clears environmental notification messages after all event alerts are disabled', async () => {
    useAppStore.setState({
      entitlement: PRO_LIFETIME_ENTITLEMENT,
      notificationMessage: 'Environmental alerts are available with AirAware Pro.',
      settings: {
        ...DEFAULT_SETTINGS,
        environmentalEventNotifications: {
          ...DEFAULT_SETTINGS.environmentalEventNotifications,
          pollen: true,
        },
      },
    });

    await useAppStore.getState().updateSettings({
      environmentalEventNotifications: DEFAULT_SETTINGS.environmentalEventNotifications,
    });

    expect(useAppStore.getState().notificationMessage).toBeNull();
  });

  it('preserves rapid collapsed-section toggles from the latest settings state', async () => {
    await Promise.all([
      useAppStore.getState().toggleCollapsedSection('data.pollen'),
      useAppStore.getState().toggleCollapsedSection('data.airQuality'),
    ]);

    expect(useAppStore.getState().settings.collapsedSections).toEqual(
      expect.objectContaining({
        'data.pollen': true,
        'data.airQuality': true,
      }),
    );
  });

  it('does not send a test notification without permission', async () => {
    jest.mocked(getRiskNotificationPermissionStatus).mockResolvedValue('denied');

    await useAppStore.getState().sendTestRiskNotification();

    expect(deliverRiskTestNotification).not.toHaveBeenCalled();
    expect(useAppStore.getState().notificationMessage).toContain('denied');
  });
});
