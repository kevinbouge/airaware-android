import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface ReadingRowProps {
  label: string;
  value: string;
  detail?: string | undefined;
}

export function ReadingRow({ label, value, detail }: ReadingRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.values}>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'right',
  },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  values: {
    alignItems: 'flex-end',
    minWidth: 92,
  },
});
