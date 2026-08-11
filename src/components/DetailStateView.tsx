import { StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';
import { StateView } from './StateView';
import { spacing } from '../theme/theme';

interface DetailStateViewProps {
  loading?: boolean;
  message: string;
  onBack: () => void;
}

export function DetailStateView({ loading = false, message, onBack }: DetailStateViewProps) {
  return (
    <View style={styles.container}>
      <StateView loading={loading} message={message} />
      <AppButton title="Back" fullWidth onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
