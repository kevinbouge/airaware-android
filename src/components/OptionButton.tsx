import { StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';
import type { AppIconName } from './icons/appIconTypes';

interface OptionButtonProps {
  label: string;
  iconName?: AppIconName | undefined;
  selected: boolean;
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}

export function OptionButton({
  label,
  iconName,
  selected,
  disabled = false,
  grow = false,
  onPress,
}: OptionButtonProps) {
  return (
    <View style={grow ? styles.growingOption : undefined}>
      <AppButton
        title={label}
        iconName={iconName}
        onPress={onPress}
        selected={selected}
        disabled={disabled}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  growingOption: {
    flex: 1,
  },
});
