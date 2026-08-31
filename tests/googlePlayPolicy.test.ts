import fs from 'node:fs';
import path from 'node:path';
import {
  GOOGLE_PLAY_PRIVACY_DISCLOSURE,
  googlePlayPrivacyDisclosureText,
} from '../src/core/googlePlayCompliance';
import { APP_DISCLAIMER_LINES, appDisclaimerText } from '../src/core/appDisclaimers';

const root = process.cwd();

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')) as Record<
    string,
    unknown
  >;
}

function packageDependencies(): Record<string, string> {
  const packageJson = readJson('package.json') as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function optionalText(relativePath: string): string | null {
  const fullPath = path.join(root, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
}

function nativePermissionLines(manifest: string, permission: string): string[] {
  return manifest
    .split('\n')
    .filter(
      (line) => line.includes('<uses-permission') && line.includes(`android:name="${permission}"`),
    );
}

function activeNativePermissionLines(manifest: string, permission: string): string[] {
  return nativePermissionLines(manifest, permission).filter(
    (line) => !line.includes('tools:node="remove"'),
  );
}

function removedNativePermissionLines(manifest: string, permission: string): string[] {
  return nativePermissionLines(manifest, permission).filter((line) =>
    line.includes('tools:node="remove"'),
  );
}

function buildGradleBlock(source: string, blockName: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${blockName} {`);

  if (start < 0) {
    return '';
  }

  const blockLines: string[] = [];
  let depth = 0;

  for (const line of lines.slice(start)) {
    blockLines.push(line);
    depth += line.split('{').length - 1;
    depth -= line.split('}').length - 1;

    if (blockLines.length > 1 && depth <= 0) {
      break;
    }
  }

  return blockLines.join('\n');
}

describe('Google Play policy guardrails', () => {
  it('requests only approximate foreground location', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        android?: {
          blockedPermissions?: string[];
          permissions?: string[];
        };
        plugins?: unknown[];
      };
    };
    const permissions = appJson.expo?.android?.permissions ?? [];
    const blockedPermissions = appJson.expo?.android?.blockedPermissions ?? [];
    const nativeManifest = optionalText('android/app/src/main/AndroidManifest.xml');
    const locationPlugin = appJson.expo?.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location',
    ) as ['expo-location', { locationWhenInUsePermission?: string }] | undefined;

    expect(permissions).toContain('ACCESS_COARSE_LOCATION');
    expect(permissions).not.toContain('ACCESS_FINE_LOCATION');
    expect(permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(permissions).not.toContain('FOREGROUND_SERVICE_LOCATION');
    expect(blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ]),
    );
    if (nativeManifest) {
      expect(
        activeNativePermissionLines(nativeManifest, 'android.permission.ACCESS_COARSE_LOCATION'),
      ).toHaveLength(1);
      [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ].forEach((permission) => {
        expect(activeNativePermissionLines(nativeManifest, permission)).toEqual([]);
        expect(removedNativePermissionLines(nativeManifest, permission)).toHaveLength(1);
      });
    }
    expect(locationPlugin?.[1]?.locationWhenInUsePermission).toContain('approximate foreground');
  });

  it('does not request unrelated Android storage or overlay permissions', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        android?: {
          blockedPermissions?: string[];
        };
      };
    };
    const blockedPermissions = appJson.expo?.android?.blockedPermissions ?? [];
    const nativeManifest = optionalText('android/app/src/main/AndroidManifest.xml');
    const disallowedPermissions = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ];

    expect(blockedPermissions).toEqual(expect.arrayContaining(disallowedPermissions));
    if (nativeManifest) {
      disallowedPermissions.forEach((permission) => {
        expect(activeNativePermissionLines(nativeManifest, permission)).toEqual([]);
        expect(removedNativePermissionLines(nativeManifest, permission)).toHaveLength(1);
      });
    }
  });

  it('keeps debug-only manifests free of overlay permissions', () => {
    [
      'android/app/src/debug/AndroidManifest.xml',
      'android/app/src/debugOptimized/AndroidManifest.xml',
    ]
      .map(optionalText)
      .filter((manifest): manifest is string => manifest !== null)
      .forEach((manifest) => {
        expect(
          activeNativePermissionLines(manifest, 'android.permission.SYSTEM_ALERT_WINDOW'),
        ).toEqual([]);
      });
  });

  it('keeps Android local data out of platform backup', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        android?: {
          allowBackup?: boolean;
        };
      };
    };
    const nativeManifest = optionalText('android/app/src/main/AndroidManifest.xml');

    expect(appJson.expo?.android?.allowBackup).toBe(false);
    if (nativeManifest) {
      expect(nativeManifest).toContain('android:allowBackup="false"');
    }
  });

  it('does not sign release builds with the debug keystore', () => {
    const buildGradle = optionalText('android/app/build.gradle') ?? '';
    const releaseBlock = buildGradleBlock(buildGradle, 'release');

    expect(releaseBlock).not.toContain('signingConfig signingConfigs.debug');
  });

  it('does not advertise automatic dark-mode support before a dynamic theme exists', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        userInterfaceStyle?: string;
      };
    };

    expect(appJson.expo?.userInterfaceStyle).toBe('light');
  });

  it('includes only approved billing SDK dependencies and no ads, analytics, tracking, or account SDKs', () => {
    const dependencies = Object.keys(packageDependencies());
    const approvedBillingDependencies = ['react-native-purchases'];
    const disallowedDependencyPatterns = [
      /firebase/i,
      /analytics/i,
      /ads/i,
      /admob/i,
      /appsflyer/i,
      /adjust/i,
      /onesignal/i,
      /facebook/i,
      /google-signin/i,
      /iap/i,
      /stripe/i,
    ];
    const billingLikeDependencies = dependencies.filter(
      (dependency) =>
        /billing/i.test(dependency) || /iap/i.test(dependency) || /purchases/i.test(dependency),
    );

    expect(
      dependencies.filter((dependency) =>
        disallowedDependencyPatterns.some((pattern) => pattern.test(dependency)),
      ),
    ).toEqual([]);
    expect(billingLikeDependencies.sort()).toEqual(approvedBillingDependencies.sort());
  });

  it('keeps required in-app privacy disclosures centralized', () => {
    const disclosure = googlePlayPrivacyDisclosureText();

    expect(GOOGLE_PLAY_PRIVACY_DISCLOSURE.length).toBeGreaterThanOrEqual(8);
    expect(disclosure).toContain('approximate foreground location');
    expect(disclosure).toContain('Open-Meteo');
    expect(disclosure).toContain('OpenStreetMap tile servers');
    expect(disclosure).toContain('OpenStreetMap Overpass API');
    expect(disclosure).toContain('OpenStreetMap contributors');
    expect(disclosure).toContain('public surveillance and monitoring providers');
    expect(disclosure).toContain('Safecast');
    expect(disclosure).toContain('RevenueCat');
    expect(disclosure).toContain('Google Play processes payments');
    expect(disclosure).toContain('Personal Allergy Profile');
    expect(disclosure).toContain('does not sell personal or sensitive user data');
    expect(disclosure).not.toContain('does not predict symptoms');
    expect(disclosure).toContain('does not request background location');
    expect(disclosure).toContain('clearing app storage or uninstalling');
  });

  it('keeps app disclaimers centralized separately from privacy copy', () => {
    const disclaimers = appDisclaimerText();

    expect(APP_DISCLAIMER_LINES.length).toBeGreaterThanOrEqual(4);
    expect(disclaimers).toContain(
      'reports environmental conditions and public population-level health context only',
    );
    expect(disclaimers).toContain('does not predict symptoms');
    expect(disclaimers).toContain('delayed public surveillance or monitoring data');
    expect(disclaimers).toContain('Personal Allergy Profile');
    expect(disclaimers).toContain('Activity profiles provide environmental guidance only');
    expect(disclaimers).toContain('OpenStreetMap context');
  });

  it('does not bundle obvious RevenueCat or Google Play server credentials', () => {
    const checkedFiles = [
      'README.md',
      '.env.example',
      'app.json',
      'package.json',
      'src/services/billingGateway.ts',
      'src/core/googlePlayCompliance.ts',
    ];
    const source = checkedFiles.map(readText).join('\n');

    expect(source).not.toMatch(/REVENUECAT_(SECRET|V2)_API_KEY\s*=/i);
    expect(source).not.toMatch(/-----BEGIN PRIVATE KEY-----/);
    expect(source).not.toMatch(/"type"\s*:\s*"service_account"/);
    expect(source).not.toMatch(/test_RA[a-zA-Z0-9]+/);
  });
});
