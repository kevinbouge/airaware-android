import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['airaware://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Today: 'today',
          Profile: 'profile',
          Pro: 'pro',
          Settings: 'settings',
        },
      },
      EnvironmentalBurdenDetail: 'environmental-burden',
      PersonalizedRiskDetail: 'personalized-risk',
      DataDetail: 'data/:variableId',
      ActivityDomainDetail: 'activities/:domainId',
      ActivityDetail: 'activities/:domainId/:profileId',
      HealthSignalDetail: 'health/:signalId',
    },
  },
};
