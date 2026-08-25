import {
  getAndroidCoarseLocationPermissionStatus,
  requestAndroidCoarseLocationPermission,
} from '../src/services/locationService';

function permissionDependencies() {
  const foregroundPermission: {
    status: string;
    granted: boolean;
    canAskAgain: boolean;
    expires: string;
  } = {
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
    expires: 'never',
  };

  return {
    checkCoarsePermission: jest.fn(async () => false),
    requestCoarsePermission: jest.fn(async () => 'granted'),
    getForegroundPermission: jest.fn(async () => foregroundPermission),
    grantedResult: 'granted',
  };
}

describe('Android coarse location permissions', () => {
  it('uses an existing coarse Android grant without prompting again', async () => {
    const dependencies = permissionDependencies();
    dependencies.checkCoarsePermission.mockResolvedValue(true);

    await expect(getAndroidCoarseLocationPermissionStatus(dependencies)).resolves.toBe('granted');

    expect(dependencies.getForegroundPermission).not.toHaveBeenCalled();
  });

  it('returns unknown when coarse permission can still be requested', async () => {
    const dependencies = permissionDependencies();

    await expect(getAndroidCoarseLocationPermissionStatus(dependencies)).resolves.toBe('unknown');

    expect(dependencies.checkCoarsePermission).toHaveBeenCalledTimes(1);
    expect(dependencies.getForegroundPermission).toHaveBeenCalledTimes(1);
  });

  it('preserves blocked Android denial state', async () => {
    const dependencies = permissionDependencies();
    dependencies.getForegroundPermission.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });

    await expect(getAndroidCoarseLocationPermissionStatus(dependencies)).resolves.toBe('denied');
  });

  it('requests only coarse Android location permission', async () => {
    const dependencies = permissionDependencies();

    await expect(requestAndroidCoarseLocationPermission(dependencies)).resolves.toBe('granted');

    expect(dependencies.requestCoarsePermission).toHaveBeenCalledTimes(1);
  });
});
