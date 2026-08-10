import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CurrentReadingsSections } from '../components/CurrentReadingsSections';
import {
  NearbyVegetationSection,
  NEARBY_VEGETATION_SECTION_ID,
} from '../components/NearbyVegetationSection';
import { StateView } from '../components/StateView';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, spacing } from '../theme/theme';
import type { EnvironmentalVariableId } from '../capabilities/types';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface DataNavigation {
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

export function DataScreen() {
  const navigation = useNavigation<DataNavigation>();
  const environment = useAppStore((state) => state.environment);
  const vegetation = useAppStore((state) => state.vegetation);
  const vegetationStale = useAppStore((state) => state.vegetationStale);
  const vegetationLoading = useAppStore((state) => state.vegetationLoading);
  const vegetationError = useAppStore((state) => state.vegetationError);
  const settings = useAppStore((state) => state.settings);
  const toggleCollapsedSection = useAppStore((state) => state.toggleCollapsedSection);
  const capabilities = useCapabilities();

  const toggleSection = (sectionId: string) => {
    void toggleCollapsedSection(sectionId);
  };
  const openVariable = (variableId: EnvironmentalVariableId) => {
    navigation.navigate('DataDetail', { variableId });
  };

  if (!environment) {
    return <StateView message="Environmental data is unavailable." />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CurrentReadingsSections
        capabilities={capabilities}
        collapsedSections={settings.collapsedSections}
        current={environment.current}
        onToggleSection={toggleSection}
        onOpenVariable={openVariable}
        beforeAdvancedSections={
          <NearbyVegetationSection
            vegetation={vegetation}
            stale={vegetationStale}
            loading={vegetationLoading}
            error={vegetationError}
            collapsed={settings.collapsedSections[NEARBY_VEGETATION_SECTION_ID] === true}
            onToggle={() => toggleSection(NEARBY_VEGETATION_SECTION_ID)}
          />
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
  },
});
