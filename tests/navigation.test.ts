import { linking } from '../src/navigation/linking';

type RootTabName = keyof typeof linking.config.screens;

describe('navigation', () => {
  it('includes the Data tab and deep link', () => {
    const routes: RootTabName[] = ['Today', 'Data', 'Forecast', 'Profile', 'Settings'];

    expect(Object.keys(linking.config.screens)).toEqual(routes);
    expect(linking.config.screens.Data).toBe('data');
  });
});
