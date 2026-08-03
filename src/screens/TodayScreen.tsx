import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { ScoreCard } from '../components/ScoreCard';
import { SectionCard } from '../components/SectionCard';
import { StateView } from '../components/StateView';
import { GasMaskIcon } from '../components/icons/GasMaskIcon';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor, spacing } from '../theme/theme';
import {
  formatCategoryScore,
  formatCoordinates,
  formatShortTime,
  formatTimestamp,
} from '../utils/format';
import { contributorFromScore } from '../utils/contributorLabels';

function formatUpdateStatus(
  fetchedAt: string | null,
  stale: boolean,
  metadata: {
    airQualitySource?: 'fresh' | 'cached' | 'unavailable';
    weatherSource?: 'fresh' | 'cached' | 'unavailable';
  } | null,
): string {
  if (!stale) {
    return `Updated ${formatTimestamp(fetchedAt)}`;
  }

  const cachedParts = [
    metadata?.airQualitySource === 'cached' ? 'air quality' : null,
    metadata?.weatherSource === 'cached' ? 'weather' : null,
  ].filter((item): item is string => item !== null);

  if (cachedParts.length === 0 || cachedParts.length === 2) {
    return 'Cached data';
  }

  return `Cached ${cachedParts.join(', ')}`;
}

export function TodayScreen() {
  const hydrated = useAppStore((state) => state.hydrated);
  const loading = useAppStore((state) => state.loading);
  const stale = useAppStore((state) => state.stale);
  const error = useAppStore((state) => state.error);
  const shareMessage = useAppStore((state) => state.shareMessage);
  const location = useAppStore((state) => state.location);
  const settings = useAppStore((state) => state.settings);
  const environment = useAppStore((state) => state.environment);
  const refresh = useAppStore((state) => state.refresh);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const shareDailySummary = useAppStore((state) => state.shareDailySummary);
  const {
    environmentalScore,
    personalizedScore,
    environmentalBestOutdoorWindow,
    personalizedBestOutdoorWindow,
  } = useDerivedEnvironment();

  const startLocationRefresh = async () => {
    await updateSettings({ locationOnboardingComplete: true });
    await refresh();
  };

  if (!hydrated) return <StateView loading message="Loading AirAware..." />;

  const headlineCategory =
    settings.headlineScore === 'personalized' && personalizedScore.available
      ? personalizedScore.category
      : environmentalScore?.category;
  const locationLabel =
    environment?.placeName ??
    location.placeName ??
    formatCoordinates(environment?.coordinates ?? location.coordinates) ??
    'Location not set';
  const environmentalMainFactor = contributorFromScore(environmentalScore);
  const personalizedMainFactor = contributorFromScore(personalizedScore);
  const updateStatus = formatUpdateStatus(
    environment?.fetchedAt ?? null,
    stale,
    environment?.metadata ?? null,
  );
  const bestOutdoorWindow =
    settings.forecastScore === 'personalized' && personalizedBestOutdoorWindow
      ? personalizedBestOutdoorWindow
      : environmentalBestOutdoorWindow;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <GasMaskIcon
            size={36}
            color={headlineCategory ? riskColor(headlineCategory) : colors.unavailable}
          />
          <Text style={styles.brand}>AirAware</Text>
        </View>
        <Text style={styles.place}>{locationLabel}</Text>
      </View>

      {error ? <Text style={styles.notice}>{error}</Text> : null}

      {environmentalScore ? (
        <ScoreCard
          title="Environmental burden"
          score={environmentalScore.score}
          category={environmentalScore.category}
          details={[`Main factor: ${environmentalMainFactor.label ?? 'Unavailable'}`]}
        />
      ) : null}

      {personalizedScore.available ? (
        <ScoreCard
          title="Personalized risk"
          score={personalizedScore.score}
          category={personalizedScore.category}
          details={[`Main factor: ${personalizedMainFactor.label ?? 'Unavailable'}`]}
        />
      ) : null}

      {environment ? (
        <>
          {bestOutdoorWindow?.available ? (
            <SectionCard title="Best outdoor window">
              <Text style={styles.windowValue}>
                {formatShortTime(bestOutdoorWindow.startTime)}–
                {formatShortTime(bestOutdoorWindow.endTime)}
              </Text>
              <Text
                style={[
                  styles.body,
                  styles.windowScore,
                  { color: riskColor(bestOutdoorWindow.category) },
                ]}
              >
                {formatCategoryScore(bestOutdoorWindow.category, bestOutdoorWindow.averageScore)}
              </Text>
            </SectionCard>
          ) : null}

          <View style={styles.actions}>
            {shareMessage ? <Text style={styles.shareMessage}>{shareMessage}</Text> : null}
            <AppButton
              title={loading ? 'Refreshing...' : 'Refresh'}
              rightLabel={updateStatus}
              fullWidth
              onPress={refresh}
              disabled={loading}
            />
            <AppButton title="Share" onPress={shareDailySummary} />
          </View>
        </>
      ) : (
        <SectionCard title="Location required">
          <Text style={styles.body}>
            AirAware needs approximate location or manual coordinates to retrieve local
            environmental conditions. Your coordinates are sent only to Open-Meteo for local
            environmental data.
          </Text>
          <AppButton
            title="Continue and refresh"
            onPress={startLocationRefresh}
            disabled={loading}
          />
        </SectionCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  notice: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    color: '#604B00',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  windowValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  windowScore: {
    fontWeight: '800',
  },
  place: {
    color: colors.muted,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  screen: {
    backgroundColor: colors.background,
  },
  shareMessage: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
