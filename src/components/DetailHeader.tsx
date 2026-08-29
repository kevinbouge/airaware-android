import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';
import { AppIcon } from './icons/AppIcon';

interface DetailHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  icon?: ReactNode | undefined;
}

export function DetailHeader({ title, subtitle, onBack, icon }: DetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable
        accessibilityLabel={t('common.back')}
        accessibilityRole="button"
        hitSlop={spacing.sm}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
      >
        <AppIcon name="back" size="action" color={colors.primary} />
        <Text style={styles.backLabel}>{t('common.back')}</Text>
      </Pressable>
      <View style={styles.heading}>
        {icon}
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.md,
  },
  backLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.65,
  },
  heading: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
});
