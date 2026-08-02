import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TodayScreen } from '../screens/TodayScreen';
import { ForecastScreen } from '../screens/ForecastScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TabIcon, type TabIconName } from '../components/icons/TabIcon';
import { useDerivedEnvironment } from '../hooks/useDerivedEnvironment';
import { useAppStore } from '../state/useAppStore';
import { colors, riskColor } from '../theme/theme';

export type RootTabParamList = {
  Today: undefined;
  Forecast: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function iconNameForRoute(routeName: keyof RootTabParamList): TabIconName {
  switch (routeName) {
    case 'Today':
      return 'today';
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
  const { environmentalScore, personalizedScore } = useDerivedEnvironment();
  const headlineCategory =
    headlineScore === 'personalized' && personalizedScore.available
      ? personalizedScore.category
      : environmentalScore?.category;
  const todayIconColor = headlineCategory ? riskColor(headlineCategory) : colors.unavailable;

  return (
    <NavigationContainer>
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
        <Tab.Screen name="Forecast" component={ForecastScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
