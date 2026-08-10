import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['airaware://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Today: 'today',
          Data: 'data',
          Forecast: 'forecast',
          Profile: 'profile',
          Settings: 'settings',
        },
      },
      DataDetail: 'data/:variableId',
    },
  },
};
