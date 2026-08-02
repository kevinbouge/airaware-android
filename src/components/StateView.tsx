import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface StateViewProps {
  loading?: boolean;
  message: string;
}

export function StateView({ loading = false, message }: StateViewProps) {
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator /> : null}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    color: colors.muted,
    fontSize: 16,
    textAlign: 'center',
  },
});
