import { StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';

interface OptionButtonProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}

export function OptionButton({
  label,
  selected,
  disabled = false,
  grow = false,
  onPress,
}: OptionButtonProps) {
  return (
    <View style={grow ? styles.growingOption : undefined}>
      <AppButton
        title={label}
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
