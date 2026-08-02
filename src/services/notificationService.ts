import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RiskNotificationContent } from '../core/riskTransitionNotifications';
import type { NotificationPermissionStatus } from '../models/notifications';

export const RISK_NOTIFICATION_CHANNEL_ID = 'risk-changes';

interface NotificationDeliveryDependencies {
  platform: typeof Platform.OS;
  defaultImportance: Notifications.AndroidImportance;
  setNotificationHandler: typeof Notifications.setNotificationHandler;
  setNotificationChannelAsync: typeof Notifications.setNotificationChannelAsync;
  getPermissionsAsync: typeof Notifications.getPermissionsAsync;
  requestPermissionsAsync: typeof Notifications.requestPermissionsAsync;
  scheduleNotificationAsync: typeof Notifications.scheduleNotificationAsync;
  openSettings: typeof Linking.openSettings;
}

const defaultDependencies: NotificationDeliveryDependencies = {
  platform: Platform.OS,
  defaultImportance: Notifications.AndroidImportance.DEFAULT,
  setNotificationHandler: Notifications.setNotificationHandler,
  setNotificationChannelAsync: Notifications.setNotificationChannelAsync,
  getPermissionsAsync: Notifications.getPermissionsAsync,
  requestPermissionsAsync: Notifications.requestPermissionsAsync,
  scheduleNotificationAsync: Notifications.scheduleNotificationAsync,
  openSettings: Linking.openSettings,
};

defaultDependencies.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function normalizePermissionStatus(status: unknown): NotificationPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'undetermined') return 'unknown';
  return 'unavailable';
}

export async function ensureRiskNotificationChannel(
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<void> {
  if (dependencies.platform !== 'android') return;

  await dependencies.setNotificationChannelAsync(RISK_NOTIFICATION_CHANNEL_ID, {
    name: 'Risk changes',
    description: 'AirAware headline risk category changes.',
    importance: dependencies.defaultImportance,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  });
}

export async function getRiskNotificationPermissionStatus(
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<NotificationPermissionStatus> {
  try {
    const permission = await dependencies.getPermissionsAsync();
    return normalizePermissionStatus(permission.status);
  } catch (error) {
    console.warn('AirAware: notification permission status unavailable', error);
    return 'unavailable';
  }
}

export async function requestRiskNotificationPermission(
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<NotificationPermissionStatus> {
  try {
    await ensureRiskNotificationChannel(dependencies);
    const existing = await dependencies.getPermissionsAsync();

    if (existing.status === 'granted') {
      return 'granted';
    }

    const requested = await dependencies.requestPermissionsAsync();
    return normalizePermissionStatus(requested.status);
  } catch (error) {
    console.warn('AirAware: notification permission request failed', error);
    return 'unavailable';
  }
}

export async function deliverRiskTransitionNotification(
  notification: RiskNotificationContent,
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<boolean> {
  try {
    await ensureRiskNotificationChannel(dependencies);
    await dependencies.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: false,
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.warn('AirAware: risk transition notification failed', error);
    return false;
  }
}

export async function deliverRiskTestNotification(
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<boolean> {
  return deliverRiskTransitionNotification(
    {
      title: 'AirAware test notification',
      body: 'Risk transition notifications are working.',
    },
    dependencies,
  );
}

export async function openSystemNotificationSettings(
  dependencies: NotificationDeliveryDependencies = defaultDependencies,
): Promise<boolean> {
  try {
    await dependencies.openSettings();
    return true;
  } catch (error) {
    console.warn('AirAware: could not open notification settings', error);
    return false;
  }
}
