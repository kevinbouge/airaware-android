import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EnvironmentalVariableId } from '../capabilities/types';
import { colors, spacing } from '../theme/theme';

interface ReadingRowProps {
  label: string;
  value: string;
  detail?: string | undefined;
  variableId?: EnvironmentalVariableId | undefined;
  onPress?: ((variableId: EnvironmentalVariableId) => void) | undefined;
}

export function ReadingRow({ label, value, detail, variableId, onPress }: ReadingRowProps) {
  const content = (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.values}>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );

  if (!variableId || !onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() => onPress(variableId)}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
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
  pressable: {
    borderRadius: 8,
  },
  pressed: {
    backgroundColor: '#EEF3EF',
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
