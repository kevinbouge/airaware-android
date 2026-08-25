import { AppIcon } from './AppIcon';
import { GasMaskIcon } from './GasMaskIcon';
import type { AppIconName } from './appIconTypes';

export type TabIconName =
  'today' | 'data' | 'activities' | 'forecast' | 'profile' | 'pro' | 'settings';

interface TabIconProps {
  name: TabIconName;
  size?: number;
  color: string;
}

export function TabIcon({ name, size = 24, color }: TabIconProps) {
  if (name === 'today') {
    return (
      <GasMaskIcon
        size={Math.round(size * 1.15)}
        color={color}
        style={{ transform: [{ translateY: 3 }] }}
      />
    );
  }

  return <AppIcon name={name as AppIconName} size="navigation" color={color} />;
}
