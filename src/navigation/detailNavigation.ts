import type { RootStackParamList } from './AppNavigator';

export interface DetailBackNavigation {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate: <RouteName extends keyof RootStackParamList>(
    routeName: RouteName,
    params: RootStackParamList[RouteName],
  ) => void;
}

export function goBackOrToday(navigation: DetailBackNavigation) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  navigation.navigate('MainTabs', { screen: 'Today' });
}
