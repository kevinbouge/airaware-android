import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/theme';

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string | undefined;
  contentTopSpacing?: number | undefined;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: (() => void) | undefined;
}

export function SectionCard({
  title,
  subtitle,
  contentTopSpacing,
  children,
  collapsible = false,
  collapsed = false,
  onToggle,
}: SectionCardProps) {
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {collapsible ? <Text style={styles.arrow}>{collapsed ? '›' : '⌄'}</Text> : null}
    </View>
  ) : null;

  return (
    <View style={styles.card}>
      {collapsible ? (
        <Pressable
          accessibilityHint={collapsed ? 'Expand section' : 'Collapse section'}
          accessibilityLabel={title}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          onPress={onToggle}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {!collapsed ? (
        <View
          style={[
            styles.content,
            !header ? styles.contentWithoutHeader : null,
            header && contentTopSpacing !== undefined ? { marginTop: contentTopSpacing } : null,
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  content: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contentWithoutHeader: {
    marginTop: 0,
  },
  arrow: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
});
