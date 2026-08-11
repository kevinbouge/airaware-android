import fs from 'node:fs';
import path from 'node:path';
import {
  GOOGLE_PLAY_PRIVACY_DISCLOSURE,
  googlePlayPrivacyDisclosureText,
} from '../src/core/googlePlayCompliance';

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

describe('Google Play policy guardrails', () => {
  it('requests only approximate foreground location', () => {
    const appJson = readJson('app.json') as {
      expo?: {
        android?: {
          permissions?: string[];
        };
        plugins?: unknown[];
      };
    };
    const permissions = appJson.expo?.android?.permissions ?? [];
    const locationPlugin = appJson.expo?.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location',
    ) as ['expo-location', { locationWhenInUsePermission?: string }] | undefined;

    expect(permissions).toContain('ACCESS_COARSE_LOCATION');
    expect(permissions).not.toContain('ACCESS_FINE_LOCATION');
    expect(permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(permissions).not.toContain('FOREGROUND_SERVICE_LOCATION');
    expect(locationPlugin?.[1]?.locationWhenInUsePermission).toContain('approximate foreground');
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

  it('keeps required in-app privacy and health-boundary disclosures centralized', () => {
    const disclosure = googlePlayPrivacyDisclosureText();

    expect(GOOGLE_PLAY_PRIVACY_DISCLOSURE.length).toBeGreaterThanOrEqual(8);
    expect(disclosure).toContain('approximate foreground location');
    expect(disclosure).toContain('Open-Meteo');
    expect(disclosure).toContain('OpenStreetMap tile servers');
    expect(disclosure).toContain('OpenStreetMap Overpass API');
    expect(disclosure).toContain('OpenStreetMap contributors');
    expect(disclosure).toContain('RevenueCat');
    expect(disclosure).toContain('Google Play processes payments');
    expect(disclosure).toContain('Personal Allergy Profile');
    expect(disclosure).toContain('does not sell personal or sensitive user data');
    expect(disclosure).toContain('does not predict symptoms');
    expect(disclosure).toContain('does not request background location');
    expect(disclosure).toContain('clearing app storage or uninstalling');
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
