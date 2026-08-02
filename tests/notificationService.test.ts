/* eslint-disable import/first */
jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    DEFAULT: 5,
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import {
  deliverRiskTestNotification,
  deliverRiskTransitionNotification,
  ensureRiskNotificationChannel,
  openSystemNotificationSettings,
  requestRiskNotificationPermission,
  RISK_NOTIFICATION_CHANNEL_ID,
} from '../src/services/notificationService';

const dependencies = {
  platform: 'android' as const,
  defaultImportance: Notifications.AndroidImportance.DEFAULT,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  openSettings: jest.fn().mockResolvedValue(undefined),
};

describe('notification service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dependencies.setNotificationChannelAsync.mockResolvedValue(null);
    dependencies.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    dependencies.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    dependencies.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('configures the Android risk changes channel without sound or vibration', async () => {
    await ensureRiskNotificationChannel(dependencies);

    expect(dependencies.setNotificationChannelAsync).toHaveBeenCalledWith(
      RISK_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Risk changes',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
      }),
    );
  });

  it('requests notification permission only through the explicit permission function', async () => {
    await requestRiskNotificationPermission(dependencies);

    expect(dependencies.setNotificationChannelAsync).toHaveBeenCalled();
    expect(dependencies.getPermissionsAsync).toHaveBeenCalled();
    expect(dependencies.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('does not prompt again when notification permission is already granted', async () => {
    dependencies.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(requestRiskNotificationPermission(dependencies)).resolves.toBe('granted');

    expect(dependencies.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('delivers immediate local notifications after ensuring the risk changes channel', async () => {
    await expect(
      deliverRiskTransitionNotification(
        {
          title: 'AirAware risk is now High',
          body: 'Environmental burden reached 68% in Prague.',
        },
        dependencies,
      ),
    ).resolves.toBe(true);

    expect(dependencies.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'AirAware risk is now High',
        body: 'Environmental burden reached 68% in Prague.',
        sound: false,
      },
      trigger: null,
    });
  });

  it('returns false instead of throwing on delivery failure', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    dependencies.scheduleNotificationAsync.mockRejectedValue(new Error('native failure'));

    await expect(
      deliverRiskTransitionNotification(
        {
          title: 'AirAware risk is now High',
          body: 'Environmental burden reached 68%.',
        },
        dependencies,
      ),
    ).resolves.toBe(false);
    warn.mockRestore();
  });

  it('sends the clearly labeled test notification through the same local channel', async () => {
    await expect(deliverRiskTestNotification(dependencies)).resolves.toBe(true);

    expect(dependencies.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'AirAware test notification',
        body: 'Risk transition notifications are working.',
        sound: false,
      },
      trigger: null,
    });
  });

  it('opens Android notification settings through an isolated boundary', async () => {
    await expect(openSystemNotificationSettings(dependencies)).resolves.toBe(true);

    expect(dependencies.openSettings).toHaveBeenCalledTimes(1);
  });
});
