import { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TodayScreen } from '../screens/TodayScreen';
import { DataScreen } from '../screens/DataScreen';
import { ForecastScreen } from '../screens/ForecastScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TabIcon, type TabIconName } from '../components/icons/TabIcon';
import { profileForCapabilities } from '../capabilities/variables';
import { calculatePersonalizedScore } from '../core/profileScoring';
import { calculateEnvironmentalScore } from '../core/scoring';
import { useCapabilities } from '../hooks/useCapabilities';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor } from '../theme/theme';
import { linking } from './linking';

export type RootTabParamList = {
  Today: undefined;
  Data: undefined;
  Forecast: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function iconNameForRoute(routeName: keyof RootTabParamList): TabIconName {
  switch (routeName) {
    case 'Today':
      return 'today';
    case 'Data':
      return 'data';
    case 'Forecast':
      return 'forecast';
    case 'Profile':
      return 'profile';
    case 'Settings':
      return 'settings';
  }
}

export function AppNavigator() {
  const headlineScore = useAppStore((state) => state.settings.headlineScore);
  const environment = useAppStore((state) => state.environment);
  const profile = useAppStore((state) => state.profile);
  const capabilities = useCapabilities();
  const current = environment?.current ?? null;
  const headlineCategory = useMemo(() => {
    if (!current) return null;

    const environmentalScore = calculateEnvironmentalScore(current);
    if (headlineScore !== 'personalized') {
      return environmentalScore.category;
    }

    const personalizedScore = calculatePersonalizedScore(
      current,
      profileForCapabilities(capabilities, profile),
    );

    return personalizedScore.available ? personalizedScore.category : environmentalScore.category;
  }, [capabilities, current, headlineScore, profile]);
  const todayIconColor = headlineCategory ? riskColor(headlineCategory) : colors.unavailable;

  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Today') {
              return <TabIcon name="today" size={size} color={todayIconColor} />;
            }

            return <TabIcon name={iconNameForRoute(route.name)} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Data" component={DataScreen} />
        <Tab.Screen name="Forecast" component={ForecastScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
