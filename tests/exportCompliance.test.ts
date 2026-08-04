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
  it('does not include crypto, secure storage, unapproved billing, IAP, or payment SDK dependencies', () => {
    const dependencyNames = packageDependencies();
    const approvedBillingDependencies = ['react-native-purchases', 'react-native-purchases-ui'];
    const controlledDependencyPatterns = [
      /^expo-crypto$/,
      /^expo-secure-store$/,
      /^react-native-keychain$/,
      /^react-native-iap$/,
      /^@revenuecat\//,
      /^@stripe\//,
      /billing/i,
    ];
    const billingDependencies = dependencyNames.filter((dependency) =>
      /^react-native-purchases(?:-ui)?$/.test(dependency),
    );

    expect(
      dependencyNames
        .filter((dependency) => !approvedBillingDependencies.includes(dependency))
        .filter((dependency) =>
          controlledDependencyPatterns.some((pattern) => pattern.test(dependency)),
        ),
    ).toEqual([]);
    expect(billingDependencies.sort()).toEqual(approvedBillingDependencies.sort());
  });

  it('keeps RevenueCat imports isolated in the billing layer', () => {
    const filesWithPurchaseImports = sourceFiles(SOURCE_ROOT).filter((file) =>
      readFileSync(file, 'utf8').includes('react-native-purchases'),
    );
    expect(filesWithPurchaseImports).toEqual([join(SOURCE_ROOT, 'services', 'billingGateway.ts')]);
  });

  it('does not import custom cryptography or unapproved purchase SDK modules from source', () => {
    const source = sourceFiles(SOURCE_ROOT)
      .filter((file) => file !== join(SOURCE_ROOT, 'services', 'billingGateway.ts'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const controlledImportPattern =
      /from ['"](?:crypto|node:crypto|expo-crypto|expo-secure-store|react-native-keychain|react-native-iap|@revenuecat\/[^'"]+|@stripe\/[^'"]+)['"]/;

    expect(source).not.toMatch(controlledImportPattern);
  });
});
