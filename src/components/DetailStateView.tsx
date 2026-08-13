import { StyleSheet, View } from 'react-native';
import { DetailHeader } from './DetailHeader';
import { StateView } from './StateView';
import { colors, spacing } from '../theme/theme';

interface DetailStateViewProps {
  loading?: boolean;
  message: string;
  onBack: () => void;
  title?: string;
}

export function DetailStateView({
  loading = false,
  message,
  onBack,
  title = 'Details',
}: DetailStateViewProps) {
  return (
    <View style={styles.container}>
      <DetailHeader title={title} onBack={onBack} />
      <View style={styles.state}>
        <StateView loading={loading} message={message} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  state: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
