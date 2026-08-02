import { NativeModules, Platform } from 'react-native';
import type { WidgetSnapshot } from '../models/widgets';

interface AirAwareWidgetNativeModule {
  saveSnapshot: (snapshotJson: string) => Promise<boolean>;
}

function nativeWidgetModule(): AirAwareWidgetNativeModule | null {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules.AirAwareWidgetModule as Partial<AirAwareWidgetNativeModule> | null;
  return typeof module?.saveSnapshot === 'function' ? (module as AirAwareWidgetNativeModule) : null;
}

export async function saveWidgetSnapshotToNative(snapshot: WidgetSnapshot): Promise<boolean> {
  const module = nativeWidgetModule();
  if (!module) return false;

  try {
    return await module.saveSnapshot(JSON.stringify(snapshot));
  } catch (error) {
    console.warn('AirAware: native widget snapshot save failed', error);
    return false;
  }
}
