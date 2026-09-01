import type { CoverageResult, GlobalCoverageReport } from './coverageTypes';
import { isCoverageFailure } from './coverageTypes';

const STATUS_SYMBOL: Record<CoverageResult['status'], string> = {
  available: '✓',
  partial: '~',
  'no-data': '—',
  unsupported: '—',
  aging: 'A',
  stale: 'S',
  'provider-error': '!',
};

export function summarizeCoverageResults(results: readonly CoverageResult[]) {
  const required = results.filter((result) => result.expectation === 'required');
  const expected = results.filter((result) => result.expectation === 'expected');
  const optional = results.filter((result) => result.expectation === 'optional');
  const providerErrors = results.filter((result) => result.status === 'provider-error');
  const failures = results.filter(isCoverageFailure);

  return {
    total: results.length,
    requiredPass: required.length - required.filter(isCoverageFailure).length,
    requiredFail: required.filter(isCoverageFailure).length,
    expectedAvailable: expected.filter((result) => result.status === 'available').length,
    expectedGaps: expected.filter((result) => result.status !== 'available').length,
    optionalAvailable: optional.filter((result) => result.status === 'available').length,
    optionalNoData: optional.filter(
      (result) => result.status === 'no-data' || result.status === 'unsupported',
    ).length,
    aging: results.filter((result) => result.status === 'aging').length,
    stale: results.filter((result) => result.status === 'stale').length,
    providerErrors: providerErrors.length,
    failures,
  };
}

export function coverageReportToMarkdown(report: GlobalCoverageReport): string {
  const summary = summarizeCoverageResults(report.results);
  const lines = [
    '# Global Coverage Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Locations tested: ${report.locations.length}`,
    '',
    '## Summary',
    '',
    `- Required checks passed: ${summary.requiredPass}`,
    `- Required checks failed: ${summary.requiredFail}`,
    `- Expected available: ${summary.expectedAvailable}`,
    `- Expected gaps: ${summary.expectedGaps}`,
    `- Optional available: ${summary.optionalAvailable}`,
    `- Optional no-data/unsupported: ${summary.optionalNoData}`,
    `- Aging signals: ${summary.aging}`,
    `- Stale signals: ${summary.stale}`,
    `- Provider errors: ${summary.providerErrors}`,
    '',
    '## Results',
    '',
    '| Location | Region | Domain | Signal | Expectation | Status | Freshness | Temporal | Provider | Method | Geography | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.results.map((result) =>
      [
        result.locationId,
        result.region ?? '',
        result.domain,
        result.signal,
        result.expectation,
        `${STATUS_SYMBOL[result.status]} ${result.status}`,
        result.freshness ?? '',
        result.temporalClass ?? '',
        result.provider ?? '',
        result.calculationMethod ?? '',
        result.reportingGeography ?? '',
        result.notes ?? '',
      ].join(' | '),
    ),
    '',
    'Legend: ✓ available, ~ partial, — no data or unsupported, A aging, S stale, ! provider error.',
    '',
  ];

  return lines.join('\n');
}

export function coverageReportToJson(report: GlobalCoverageReport): string {
  return JSON.stringify(report, null, 2);
}
