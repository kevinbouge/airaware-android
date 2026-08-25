import { AppIcon } from './AppIcon';
import { APP_ICON_SIZES } from './appIconTypes';
import type { AppIconName } from './appIconTypes';
import { GasMaskIcon } from './GasMaskIcon';

export type TabIconName =
  'today' | 'data' | 'activities' | 'forecast' | 'profile' | 'pro' | 'settings';

interface TabIconProps {
  name: TabIconName;
  size?: number;
  color: string;
}

export function TabIcon({ name, color }: TabIconProps) {
  if (name === 'today') {
    return <GasMaskIcon size={APP_ICON_SIZES.tabBrand} color={color} />;
  }

  return <AppIcon name={name as AppIconName} size="navigation" color={color} />;
}
