import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..');
const SOURCE_ROOT = join(PROJECT_ROOT, 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

function packageDependencies(): string[] {
  const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });
}

describe('export compliance guardrails', () => {
  it('does not include crypto, secure storage, billing, IAP, or payment SDK dependencies', () => {
    const dependencyNames = packageDependencies();
    const controlledDependencyPatterns = [
      /^expo-crypto$/,
      /^expo-secure-store$/,
      /^react-native-keychain$/,
      /^react-native-iap$/,
      /^react-native-purchases$/,
      /^@revenuecat\//,
      /^@stripe\//,
      /billing/i,
    ];

    expect(
      dependencyNames.filter((dependency) =>
        controlledDependencyPatterns.some((pattern) => pattern.test(dependency)),
      ),
    ).toEqual([]);
  });

  it('does not import custom cryptography or purchase SDK modules from source', () => {
    const source = sourceFiles(SOURCE_ROOT)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const controlledImportPattern =
      /from ['"](?:crypto|node:crypto|expo-crypto|expo-secure-store|react-native-keychain|react-native-iap|react-native-purchases|@revenuecat\/[^'"]+|@stripe\/[^'"]+)['"]/;

    expect(source).not.toMatch(controlledImportPattern);
  });
});
