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

  it('does not include ads, analytics, tracking, billing, or account SDK dependencies', () => {
    const dependencies = Object.keys(packageDependencies());
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
      /billing/i,
      /iap/i,
      /purchases/i,
      /revenuecat/i,
      /stripe/i,
    ];

    expect(
      dependencies.filter((dependency) =>
        disallowedDependencyPatterns.some((pattern) => pattern.test(dependency)),
      ),
    ).toEqual([]);
  });

  it('keeps required in-app privacy and health-boundary disclosures centralized', () => {
    const disclosure = googlePlayPrivacyDisclosureText();

    expect(GOOGLE_PLAY_PRIVACY_DISCLOSURE.length).toBeGreaterThanOrEqual(8);
    expect(disclosure).toContain('approximate foreground location');
    expect(disclosure).toContain('Open-Meteo');
    expect(disclosure).toContain('OpenStreetMap tile servers');
    expect(disclosure).toContain('Personal Allergy Profile');
    expect(disclosure).toContain('does not sell personal or sensitive user data');
    expect(disclosure).toContain('does not predict symptoms');
    expect(disclosure).toContain('does not request background location');
    expect(disclosure).toContain('clearing app storage or uninstalling');
  });
});
